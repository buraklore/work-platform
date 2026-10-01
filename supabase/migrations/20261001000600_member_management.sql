-- Removing someone from a workspace also removes their personal project there: nobody else
-- can ever open it, and its open tasks would otherwise count against the workspace's
-- active-task limit forever. (Re-joining creates a fresh personal project.)
create or replace function app.member_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.project_members where workspace_id = old.workspace_id and user_id = old.user_id;
  delete from public.task_assignees where workspace_id = old.workspace_id and user_id = old.user_id;
  delete from public.projects where workspace_id = old.workspace_id and created_by = old.user_id and is_personal;
  return old;
end $$;

-- A promotion out of / demotion into the guest role must respect plan limits and keep the
-- personal project rule (members have one, guests do not need one).
create or replace function app.change_member_role(p_ws uuid, p_user uuid, p_role public.workspace_role, p_limits jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.workspace_role := app.ws_role(p_ws);
  v_current public.workspace_role;
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  if v_actor is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_actor not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = app.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  select m.role into v_current from public.workspace_members m where m.workspace_id = p_ws and m.user_id = p_user;
  if v_current is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_current = p_role then return; end if;

  perform pg_advisory_xact_lock(hashtext('members:' || p_ws::text));
  select w.plan into v_plan from public.workspaces w where w.id = p_ws;
  if v_current = 'guest' and p_role <> 'guest' then
    v_limit := (p_limits -> v_plan ->> 'members')::integer;
    select count(*) into v_count from public.workspace_members m where m.workspace_id = p_ws and m.role <> 'guest';
    if v_limit is not null and v_count >= v_limit then raise exception 'limit:members' using errcode = 'P0001'; end if;
  elsif v_current <> 'guest' and p_role = 'guest' then
    v_limit := (p_limits -> v_plan ->> 'guests')::integer;
    select count(*) into v_count from public.workspace_members m where m.workspace_id = p_ws and m.role = 'guest';
    if v_limit is not null and v_count >= v_limit then raise exception 'limit:guests' using errcode = 'P0001'; end if;
  end if;

  -- member_guard (as the caller) still enforces: only the owner grants/revokes admin.
  update public.workspace_members set role = p_role where workspace_id = p_ws and user_id = p_user;
  if p_role <> 'guest' then perform app.ensure_personal_project(p_ws, p_user); end if;
  insert into public.activities (workspace_id, actor_id, verb, data)
  values (p_ws, app.uid(), 'member.role_changed', jsonb_build_object('userId', p_user, 'from', v_current, 'to', p_role));
end $$;
grant execute on function app.change_member_role(uuid, uuid, public.workspace_role, jsonb) to app_user;
