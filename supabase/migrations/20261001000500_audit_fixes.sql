-- ════════════════════════════════════════════════════════════════════════════
-- Full-system audit fixes (1 Oct 2026). Each block is covered by
-- tests/integration/audit.test.ts.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Project access for an arbitrary user (not only the caller) ───────────
create or replace function app.project_access_of(p_project uuid, p_user uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select case
           when p.is_personal then case when p.created_by = p_user then 'admin' end
           when m.role in ('owner', 'admin') then 'admin'
           when pm.role is not null then pm.role::text
           when p.visibility = 'team' and m.role = 'member' then 'member'
         end
    from public.projects p
    join public.workspaces w on w.id = p.workspace_id and w.deleted_at is null
    join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = p_user
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = p_user
   where p.id = p_project
$$;

create or replace function app.project_access(p_project uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select app.project_access_of(p_project, app.uid())
$$;

-- ── 2. An assignee must be able to see the task ─────────────────────────────
-- (generalises 0400: personal projects, private projects, guests on team projects)
create or replace function app.task_assignee_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
  v_personal boolean;
begin
  if not exists (
    select 1 from public.workspace_members m
     where m.workspace_id = new.workspace_id and m.user_id = new.user_id
  ) then
    raise exception 'assignee is not a workspace member' using errcode = '23514';
  end if;
  select t.project_id, p.is_personal into v_project, v_personal
    from public.tasks t join public.projects p on p.id = t.project_id where t.id = new.task_id;
  if app.project_access_of(v_project, new.user_id) is null then
    raise exception '%', case when v_personal then 'personal_project_assignee' else 'assignee_no_access' end
      using errcode = '23514';
  end if;
  return new;
end $$;

-- Moving a task (subtasks follow via tasks_cascade_move) must keep every assignee able to see it.
create or replace function app.tasks_personal_move_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_personal boolean;
begin
  if exists (
    select 1 from public.task_assignees a
     where a.task_id = new.id and app.project_access_of(new.project_id, a.user_id) is null
  ) then
    select p.is_personal into v_personal from public.projects p where p.id = new.project_id;
    raise exception '%', case when v_personal then 'personal_project_assignee' else 'assignee_no_access' end
      using errcode = '23514';
  end if;
  return new;
end $$;

-- When someone loses access to a project, their assignments there go too
-- (same rule as leaving the workspace: no assignment the assignee cannot see).
create or replace function app.prune_assignees(p_project uuid, p_user uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.task_assignees a
   using public.tasks t
   where t.id = a.task_id and t.project_id = p_project
     and (p_user is null or a.user_id = p_user)
     and app.project_access_of(p_project, a.user_id) is null;
end $$;

create or replace function app.on_project_member_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.prune_assignees(old.project_id, old.user_id);
  return old;
end $$;
create trigger project_members_prune after delete on public.project_members
  for each row execute function app.on_project_member_removed();

create or replace function app.on_project_visibility_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.prune_assignees(new.id);
  return new;
end $$;
create trigger projects_visibility_prune after update of visibility on public.projects
  for each row when (old.visibility is distinct from new.visibility)
  execute function app.on_project_visibility_changed();

create or replace function app.on_workspace_role_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
begin
  for v_project in select p.id from public.projects p where p.workspace_id = new.workspace_id loop
    perform app.prune_assignees(v_project, new.user_id);
  end loop;
  return new;
end $$;
create trigger workspace_members_role_prune after update of role on public.workspace_members
  for each row when (old.role is distinct from new.role)
  execute function app.on_workspace_role_changed();

-- ── 3. Tenant integrity: rows never change workspace ────────────────────────
create or replace function app.tasks_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_category public.status_category;
  v_parent record;
  v_ws uuid;
begin
  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable' using errcode = '23514';
  end if;
  select p.workspace_id into v_ws from public.projects p where p.id = new.project_id;
  if v_ws is null then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if tg_op = 'UPDATE' and v_ws is distinct from old.workspace_id then
    raise exception 'a task cannot move to another workspace' using errcode = '23514';
  end if;
  new.workspace_id := v_ws;

  select s.category into v_category from public.project_statuses s
   where s.id = new.status_id and s.project_id = new.project_id;
  if v_category is null then
    raise exception 'status does not belong to project' using errcode = '23514';
  end if;

  if new.parent_task_id is not null then
    select t.project_id, t.parent_task_id into v_parent from public.tasks t where t.id = new.parent_task_id;
    if v_parent is null or v_parent.project_id <> new.project_id then
      raise exception 'parent task must be in the same project' using errcode = '23514';
    end if;
    if v_parent.parent_task_id is not null then
      raise exception 'subtasks can only be one level deep' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.tasks c where c.parent_task_id = new.id) then
      raise exception 'a task with subtasks cannot become a subtask' using errcode = '23514';
    end if;
  end if;

  if v_category = 'done' then
    if new.completed_at is null then new.completed_at := now(); end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger tasks_integrity on public.tasks;
create trigger tasks_integrity before insert or update of workspace_id, project_id, status_id, parent_task_id, completed_at
  on public.tasks for each row execute function app.tasks_integrity();

-- Children: re-parenting may not cross workspaces either.
create or replace function app.inherit_ws_from_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select p.workspace_id into v_ws from public.projects p where p.id = new.project_id;
  if v_ws is null then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if tg_op = 'UPDATE' and v_ws is distinct from old.workspace_id then
    raise exception 'cannot move to another workspace' using errcode = '23514';
  end if;
  new.workspace_id := v_ws;
  return new;
end $$;

create or replace function app.immutable_task_id()
returns trigger language plpgsql as $$
begin
  if new.task_id is distinct from old.task_id then
    raise exception 'task_id is immutable' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger checklist_items_task_immutable before update of task_id on public.checklist_items
  for each row execute function app.immutable_task_id();

do $$
declare
  t text;
begin
  foreach t in array array['project_members', 'project_statuses', 'task_assignees', 'task_labels',
                           'checklist_items', 'labels', 'activities', 'invitations']
  loop
    execute format(
      'create trigger %I before update of workspace_id on public.%I for each row execute function app.immutable_workspace_id()',
      t || '_ws_immutable', t);
  end loop;
end $$;

-- ── 4. Guests can never administer a project ────────────────────────────────
create or replace function app.project_member_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.workspace_role;
begin
  select m.role into v_role from public.workspace_members m
   where m.workspace_id = new.workspace_id and m.user_id = new.user_id;
  if v_role is null then
    raise exception 'user is not a workspace member' using errcode = '23514';
  end if;
  if exists (select 1 from public.projects p where p.id = new.project_id and p.is_personal and p.created_by <> new.user_id) then
    raise exception 'personal projects cannot be shared' using errcode = '23514';
  end if;
  if v_role = 'guest' and new.role = 'admin' then
    raise exception 'guest_project_admin' using errcode = '23514';
  end if;
  return new;
end $$;

-- ── 5. Guests only see the profiles of people they work with ────────────────
create or replace function app.can_see_profile(p_other uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.workspace_members a
      join public.workspace_members b on b.workspace_id = a.workspace_id and b.user_id = p_other
      join public.workspaces w on w.id = a.workspace_id and w.deleted_at is null
     where a.user_id = app.uid()
       and (a.role <> 'guest' or app.shares_project(p_other, a.workspace_id))
  )
$$;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to app_user
  using (id = app.uid() or app.can_see_profile(id));

-- ── 6. Consent record (KVKK) and provider profile data ──────────────────────
alter table public.profiles add column terms_accepted_at timestamptz;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, avatar_url, terms_accepted_at)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)), 120),
    nullif(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture'), ''),
    -- set by our sign-up form (the checkbox is required) through Supabase user metadata
    case when (v_meta ->> 'terms_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Keep the profile email in sync when it changes in Supabase Auth.
create or replace function app.handle_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, email) where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function app.handle_user_updated();

-- ── 7. Privileges for objects created by future migrations ──────────────────
grant execute on function app.project_access_of(uuid, uuid) to app_user;
grant execute on function app.can_see_profile(uuid) to app_user;
revoke execute on function app.prune_assignees(uuid, uuid) from app_user;
alter default privileges in schema public grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public grant usage, select on sequences to app_user;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter default privileges in schema public revoke all on tables from anon';
    execute 'alter default privileges in schema public revoke all on sequences from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter default privileges in schema public revoke all on tables from authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from authenticated';
  end if;
end $$;
