-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security. Every tenant table is protected; policies target app_user.
-- Helper functions are SECURITY DEFINER so policies can consult membership tables
-- without recursive RLS evaluation.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Access helpers ──────────────────────────────────────────────────────────
create or replace function app.ws_role(p_ws uuid)
returns public.workspace_role
language sql stable security definer set search_path = '' as $$
  select m.role
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id and w.deleted_at is null
   where m.workspace_id = p_ws and m.user_id = app.uid()
$$;

create or replace function app.is_ws_member(p_ws uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select app.ws_role(p_ws) is not null
$$;

-- Effective project role for the current user: 'admin' | 'member' | 'viewer' | null.
--   * personal projects: only their creator
--   * workspace owner/admin: admin of every shared project
--   * explicit project membership wins next (a guest only ever gets access this way)
--   * team-visible projects: every workspace member can edit
create or replace function app.project_access(p_project uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select case
           when p.is_personal then case when p.created_by = app.uid() then 'admin' end
           when m.role in ('owner', 'admin') then 'admin'
           when pm.role is not null then pm.role::text
           when p.visibility = 'team' and m.role = 'member' then 'member'
         end
    from public.projects p
    join public.workspaces w on w.id = p.workspace_id and w.deleted_at is null
    join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = app.uid()
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = app.uid()
   where p.id = p_project
$$;

create or replace function app.task_access(p_task uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select app.project_access(t.project_id) from public.tasks t where t.id = p_task
$$;

create or replace function app.shares_workspace(p_other uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.workspace_members a
      join public.workspace_members b on b.workspace_id = a.workspace_id
     where a.user_id = app.uid() and b.user_id = p_other
  )
$$;

create or replace function app.shares_project(p_other uuid, p_ws uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.project_members a
      join public.project_members b on b.project_id = a.project_id
     where a.user_id = app.uid() and b.user_id = p_other and a.workspace_id = p_ws
  )
$$;

-- ── Membership guards ───────────────────────────────────────────────────────
create or replace function app.member_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.workspace_role;
begin
  if app.uid() is null or current_setting('app.bypass_member_guard', true) = 'on' then
    return coalesce(new, old);
  end if;
  select m.role into v_actor from public.workspace_members m
   where m.workspace_id = coalesce(new.workspace_id, old.workspace_id) and m.user_id = app.uid();

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.role = 'owner' or old.role = 'owner' then
      raise exception 'ownership can only change through a transfer' using errcode = '42501';
    end if;
    if (old.role = 'admin' or new.role = 'admin') and v_actor is distinct from 'owner' then
      raise exception 'only the owner can grant or revoke admin' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE
  if old.role = 'owner' then
    raise exception 'the owner cannot leave; transfer ownership first' using errcode = '42501';
  end if;
  if old.user_id <> app.uid() and old.role = 'admin' and v_actor is distinct from 'owner' then
    raise exception 'only the owner can remove an admin' using errcode = '42501';
  end if;
  return old;
end $$;

create trigger workspace_members_guard before update or delete on public.workspace_members
  for each row execute function app.member_guard();

-- Removing someone from a workspace removes their project memberships and assignments.
create or replace function app.member_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.project_members where workspace_id = old.workspace_id and user_id = old.user_id;
  delete from public.task_assignees where workspace_id = old.workspace_id and user_id = old.user_id;
  return old;
end $$;
create trigger workspace_members_cleanup after delete on public.workspace_members
  for each row execute function app.member_cleanup();

create or replace function app.project_member_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.workspace_members m
                  where m.workspace_id = new.workspace_id and m.user_id = new.user_id) then
    raise exception 'user is not a workspace member' using errcode = '23514';
  end if;
  if exists (select 1 from public.projects p where p.id = new.project_id and p.is_personal and p.created_by <> new.user_id) then
    raise exception 'personal projects cannot be shared' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger t20_project_members_guard before insert or update on public.project_members
  for each row execute function app.project_member_guard();

-- ── Enable RLS everywhere ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.checklist_items enable row level security;
alter table public.activities enable row level security;
alter table public.invitations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.user_view_prefs enable row level security;
alter table public.cron_runs enable row level security;

-- ── Policies ────────────────────────────────────────────────────────────────
create policy profiles_select on public.profiles for select to app_user
  using (id = app.uid() or app.shares_workspace(id));
create policy profiles_update on public.profiles for update to app_user
  using (id = app.uid()) with check (id = app.uid());

create policy workspaces_select on public.workspaces for select to app_user
  using (app.is_ws_member(id));
create policy workspaces_update on public.workspaces for update to app_user
  using (app.ws_role(id) in ('owner', 'admin')) with check (app.ws_role(id) in ('owner', 'admin'));

create policy workspace_members_select on public.workspace_members for select to app_user
  using (
    app.is_ws_member(workspace_id)
    and (app.ws_role(workspace_id) <> 'guest' or user_id = app.uid() or app.shares_project(user_id, workspace_id))
  );
create policy workspace_members_update on public.workspace_members for update to app_user
  using (app.ws_role(workspace_id) in ('owner', 'admin'))
  with check (app.ws_role(workspace_id) in ('owner', 'admin'));
create policy workspace_members_delete on public.workspace_members for delete to app_user
  using (app.ws_role(workspace_id) in ('owner', 'admin') or user_id = app.uid());

create policy projects_select on public.projects for select to app_user
  using (app.project_access(id) is not null);
create policy projects_update on public.projects for update to app_user
  using (app.project_access(id) = 'admin') with check (app.project_access(id) = 'admin');

create policy project_members_select on public.project_members for select to app_user
  using (app.project_access(project_id) is not null);
create policy project_members_insert on public.project_members for insert to app_user
  with check (app.project_access(project_id) = 'admin');
create policy project_members_update on public.project_members for update to app_user
  using (app.project_access(project_id) = 'admin') with check (app.project_access(project_id) = 'admin');
create policy project_members_delete on public.project_members for delete to app_user
  using (app.project_access(project_id) = 'admin');

create policy project_statuses_select on public.project_statuses for select to app_user
  using (app.project_access(project_id) is not null);
create policy project_statuses_insert on public.project_statuses for insert to app_user
  with check (app.project_access(project_id) = 'admin');
create policy project_statuses_update on public.project_statuses for update to app_user
  using (app.project_access(project_id) = 'admin') with check (app.project_access(project_id) = 'admin');
create policy project_statuses_delete on public.project_statuses for delete to app_user
  using (app.project_access(project_id) = 'admin');

create policy tasks_select on public.tasks for select to app_user
  using (app.project_access(project_id) is not null);
create policy tasks_insert on public.tasks for insert to app_user
  with check (app.project_access(project_id) in ('admin', 'member') and created_by = app.uid());
create policy tasks_update on public.tasks for update to app_user
  using (app.project_access(project_id) in ('admin', 'member'))
  with check (app.project_access(project_id) in ('admin', 'member'));

create policy task_assignees_select on public.task_assignees for select to app_user
  using (app.task_access(task_id) is not null);
create policy task_assignees_insert on public.task_assignees for insert to app_user
  with check (app.task_access(task_id) in ('admin', 'member'));
create policy task_assignees_delete on public.task_assignees for delete to app_user
  using (app.task_access(task_id) in ('admin', 'member'));

create policy task_labels_select on public.task_labels for select to app_user
  using (app.task_access(task_id) is not null);
create policy task_labels_insert on public.task_labels for insert to app_user
  with check (app.task_access(task_id) in ('admin', 'member'));
create policy task_labels_delete on public.task_labels for delete to app_user
  using (app.task_access(task_id) in ('admin', 'member'));

create policy checklist_items_select on public.checklist_items for select to app_user
  using (app.task_access(task_id) is not null);
create policy checklist_items_insert on public.checklist_items for insert to app_user
  with check (app.task_access(task_id) in ('admin', 'member'));
create policy checklist_items_update on public.checklist_items for update to app_user
  using (app.task_access(task_id) in ('admin', 'member'))
  with check (app.task_access(task_id) in ('admin', 'member'));
create policy checklist_items_delete on public.checklist_items for delete to app_user
  using (app.task_access(task_id) in ('admin', 'member'));

create policy labels_select on public.labels for select to app_user
  using (app.is_ws_member(workspace_id));
create policy labels_insert on public.labels for insert to app_user
  with check (app.ws_role(workspace_id) in ('owner', 'admin', 'member'));
create policy labels_update on public.labels for update to app_user
  using (app.ws_role(workspace_id) in ('owner', 'admin', 'member'))
  with check (app.ws_role(workspace_id) in ('owner', 'admin', 'member'));
create policy labels_delete on public.labels for delete to app_user
  using (app.ws_role(workspace_id) in ('owner', 'admin'));

create policy activities_select on public.activities for select to app_user
  using (
    case when project_id is not null then app.project_access(project_id) is not null
         else app.ws_role(workspace_id) in ('owner', 'admin') end
  );
create policy activities_insert on public.activities for insert to app_user
  with check (
    actor_id = app.uid() and app.is_ws_member(workspace_id)
    and (project_id is null or app.project_access(project_id) is not null)
  );

create policy invitations_select on public.invitations for select to app_user
  using (app.ws_role(workspace_id) in ('owner', 'admin'));
create policy invitations_insert on public.invitations for insert to app_user
  with check (
    app.ws_role(workspace_id) in ('owner', 'admin')
    and invited_by = app.uid()
    and (role <> 'admin' or app.ws_role(workspace_id) = 'owner')
  );
create policy invitations_update on public.invitations for update to app_user
  using (app.ws_role(workspace_id) in ('owner', 'admin'))
  with check (app.ws_role(workspace_id) in ('owner', 'admin'));

create policy subscriptions_select on public.subscriptions for select to app_user
  using (app.is_ws_member(workspace_id));

create policy analytics_events_insert on public.analytics_events for insert to app_user
  with check (user_id = app.uid() and (workspace_id is null or app.is_ws_member(workspace_id)));

create policy user_view_prefs_all on public.user_view_prefs for all to app_user
  using (user_id = app.uid() and app.project_access(project_id) is not null)
  with check (user_id = app.uid() and app.project_access(project_id) is not null);

-- cron_runs: no policy for app_user → no access.

-- ── Transactional bootstrap functions (called by the service layer) ─────────
create or replace function app.seed_default_statuses(p_project uuid, p_with_review boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_statuses (project_id, name, category, color, position) values
    (p_project, 'Yapılacak', 'todo', '#8A8FA3', 'a0'),
    (p_project, 'Devam Ediyor', 'in_progress', '#3B4FE4', 'a1');
  if p_with_review then
    insert into public.project_statuses (project_id, name, category, color, position)
    values (p_project, 'İncelemede', 'in_progress', '#C98A0B', 'a2');
  end if;
  insert into public.project_statuses (project_id, name, category, color, position)
  values (p_project, 'Tamamlandı', 'done', '#12998F', 'a3');
end $$;

create or replace function app.ensure_personal_project(p_ws uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select p.id into v_id from public.projects p
   where p.workspace_id = p_ws and p.created_by = p_user and p.is_personal;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.projects (workspace_id, name, color, visibility, is_personal, position, created_by)
  values (p_ws, 'Kişisel', '#6B6F80', 'private', true, 'a0', p_user)
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, p_user, 'admin');
  perform app.seed_default_statuses(v_id, false);
  return v_id;
end $$;

create or replace function app.create_workspace(
  p_id uuid, p_name text, p_slug text, p_use_case text, p_owned_free_limit integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext('owned_ws:' || v_uid::text));
  select count(*) into v_count
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id and m.user_id = v_uid and m.role = 'owner'
   where w.deleted_at is null and w.plan = 'free';
  if p_owned_free_limit is not null and v_count >= p_owned_free_limit then
    raise exception 'limit:owned_workspaces' using errcode = 'P0001';
  end if;

  insert into public.workspaces (id, name, slug, use_case, created_by)
  values (p_id, btrim(p_name), p_slug, p_use_case, v_uid);
  insert into public.workspace_members (workspace_id, user_id, role) values (p_id, v_uid, 'owner');
  insert into public.subscriptions (workspace_id) values (p_id);
  perform app.ensure_personal_project(p_id, v_uid);
  update public.profiles set last_workspace_id = p_id where id = v_uid;
  return p_id;
end $$;

create or replace function app.create_project(
  p_id uuid, p_ws uuid, p_name text, p_color text, p_visibility public.project_visibility,
  p_description text, p_position text, p_project_limit integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.uid();
  v_role public.workspace_role := app.ws_role(p_ws);
  v_count integer;
begin
  if v_role is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_role = 'guest' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('projects:' || p_ws::text));
  select count(*) into v_count from public.projects p
   where p.workspace_id = p_ws and not p.is_personal and p.deleted_at is null and p.archived_at is null;
  if p_project_limit is not null and v_count >= p_project_limit then
    raise exception 'limit:projects' using errcode = 'P0001';
  end if;

  insert into public.projects (id, workspace_id, name, color, visibility, description, position, created_by)
  values (p_id, p_ws, btrim(p_name), p_color, p_visibility, coalesce(p_description, ''), p_position, v_uid);
  insert into public.project_members (project_id, user_id, role) values (p_id, v_uid, 'admin');
  perform app.seed_default_statuses(p_id, true);
  return p_id;
end $$;

create or replace function app.invite_preview(p_token_hash text)
returns table (workspace_name text, workspace_slug text, inviter_name text, role public.workspace_role, state text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_inv public.invitations%rowtype;
begin
  select * into v_inv from public.invitations i where i.token_hash = p_token_hash;
  if not found then
    return query select null::text, null::text, null::text, null::public.workspace_role, 'invalid'::text;
    return;
  end if;
  return query
    select w.name, w.slug, p.full_name, v_inv.role,
      case
        when w.deleted_at is not null then 'invalid'
        when exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = app.uid()) then 'already_member'
        when v_inv.revoked_at is not null then 'revoked'
        when v_inv.expires_at < now() then 'expired'
        when v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses then 'used'
        else 'valid'
      end
      from public.workspaces w
      join public.profiles p on p.id = v_inv.invited_by
     where w.id = v_inv.workspace_id;
end $$;

-- p_limits: plan limits from src/config/plans.ts, e.g. {"free": {"members": 5, "guests": 10}}.
-- A missing key means "unlimited". Passed in so TypeScript stays the single source of truth.
create or replace function app.accept_invite(p_token_hash text, p_limits jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_count integer;
  v_plan text;
  v_member_limit integer;
  v_guest_limit integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_inv from public.invitations i where i.token_hash = p_token_hash for update;
  if not found or v_inv.revoked_at is not null or v_inv.expires_at < now()
     or (v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses)
     or exists (select 1 from public.workspaces w where w.id = v_inv.workspace_id and w.deleted_at is not null) then
    raise exception 'invite:invalid' using errcode = 'P0001';
  end if;
  if v_inv.kind = 'email' then
    select lower(p.email) into v_email from public.profiles p where p.id = v_uid;
    if v_email is distinct from lower(v_inv.email) then
      raise exception 'invite:email_mismatch' using errcode = 'P0001';
    end if;
  end if;

  if exists (select 1 from public.workspace_members m where m.workspace_id = v_inv.workspace_id and m.user_id = v_uid) then
    return v_inv.workspace_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('members:' || v_inv.workspace_id::text));
  select w.plan into v_plan from public.workspaces w where w.id = v_inv.workspace_id;
  v_member_limit := (p_limits -> v_plan ->> 'members')::integer;
  v_guest_limit := (p_limits -> v_plan ->> 'guests')::integer;
  if v_inv.role = 'guest' then
    select count(*) into v_count from public.workspace_members m
     where m.workspace_id = v_inv.workspace_id and m.role = 'guest';
    if v_guest_limit is not null and v_count >= v_guest_limit then
      raise exception 'limit:guests' using errcode = 'P0001';
    end if;
  else
    select count(*) into v_count from public.workspace_members m
     where m.workspace_id = v_inv.workspace_id and m.role <> 'guest';
    if v_member_limit is not null and v_count >= v_member_limit then
      raise exception 'limit:members' using errcode = 'P0001';
    end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_inv.workspace_id, v_uid, v_inv.role);
  if v_inv.project_id is not null then
    insert into public.project_members (project_id, user_id, role)
    values (v_inv.project_id, v_uid, coalesce(v_inv.project_role, 'member'))
    on conflict do nothing;
  end if;
  update public.invitations
     set use_count = use_count + 1, accepted_at = coalesce(accepted_at, now())
   where id = v_inv.id;
  if v_inv.role <> 'guest' then
    perform app.ensure_personal_project(v_inv.workspace_id, v_uid);
  end if;
  update public.profiles set last_workspace_id = v_inv.workspace_id where id = v_uid;
  insert into public.activities (workspace_id, actor_id, verb, data)
  values (v_inv.workspace_id, v_uid, 'member.joined', jsonb_build_object('role', v_inv.role));
  return v_inv.workspace_id;
end $$;

-- ── Privileges ──────────────────────────────────────────────────────────────
grant usage on schema public to app_user;
grant usage on schema app to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
revoke all on public.cron_runs from app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema app to app_user;
revoke execute on function app.seed_default_statuses(uuid, boolean) from app_user;
revoke execute on function app.ensure_personal_project(uuid, uuid) from app_user;

-- The Supabase REST roles get nothing: all data access goes through the server.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end $$;
