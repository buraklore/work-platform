-- ════════════════════════════════════════════════════════════════════════════
-- M1 core schema. Supabase-compatible (auth.users is provided by
-- Supabase; tests/setup/supabase-shim.sql provides them for local tests).
--
-- Access model: the application connects as `postgres` via Drizzle and, for every
-- user request, runs `set local role app_user` + `request.jwt.claims` inside a
-- transaction (src/lib/db/with-user.ts). RLS policies target `app_user`.
-- The `authenticated` / `anon` roles get NO table privileges, so the auto-generated
-- PostgREST API cannot be used to bypass service-layer rules (plan limits, rate limits).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin noinherit;
  end if;
end $$;
grant app_user to current_user;

create schema if not exists app;
revoke all on schema app from public;

-- Current user id from the JWT claims set by the server (src/lib/db/with-user.ts).
-- Same semantics as Supabase's auth.uid(), but without depending on privileges on
-- the auth schema, which app_user deliberately does not have.
create or replace function app.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

-- ── Enums ───────────────────────────────────────────────────────────────────
create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
create type public.project_role as enum ('admin', 'member', 'viewer');
create type public.project_visibility as enum ('team', 'private');
create type public.status_category as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.invitation_kind as enum ('link', 'email');
create type public.project_view as enum ('list', 'board');

-- ── Turkish search normalisation (mirrors src/lib/text/tr.ts#trNormalize) ────
create or replace function public.tr_normalize(t text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(translate(coalesce(t, ''), 'İIıĞğÜüŞşÖöÇçÂâÎîÛû', 'iiigguussooccaaiiuu'))
$$;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text,
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  timezone text not null default 'Europe/Istanbul',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  last_workspace_id uuid,
  marketing_consent_at timestamptz,
  onboarding_completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_name_trgm on public.profiles using gin (public.tr_normalize(full_name) gin_trgm_ops);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46})[a-z0-9]$'),
  logo_url text,
  use_case text check (use_case in ('personal', 'startup', 'agency', 'marketing', 'software', 'team', 'other')),
  plan text not null default 'free',
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user on public.workspace_members (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  color text not null default '#3B4FE4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  visibility public.project_visibility not null default 'team',
  default_view public.project_view not null default 'list',
  is_sample boolean not null default false,
  is_personal boolean not null default false,
  position text not null default 'a0' collate "C",
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_personal or visibility = 'private')
);
create index projects_workspace on public.projects (workspace_id) where deleted_at is null;
create unique index projects_one_personal on public.projects (workspace_id, created_by) where is_personal;
create index projects_name_trgm on public.projects using gin (public.tr_normalize(name) gin_trgm_ops);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user on public.project_members (user_id);

create table public.project_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  category public.status_category not null,
  color text not null default '#8A8FA3' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position text not null collate "C",
  created_at timestamptz not null default now()
);
create index project_statuses_project on public.project_statuses (project_id, position);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status_id uuid not null references public.project_statuses (id) on delete restrict,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  description jsonb,
  priority public.task_priority not null default 'normal',
  due_date date,
  due_time time,
  position text not null collate "C",
  created_by uuid not null references public.profiles (id),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_time is null or due_date is not null),
  check (parent_task_id is null or parent_task_id <> id)
);
create index tasks_project_status_pos on public.tasks (project_id, status_id, position) where deleted_at is null;
create index tasks_workspace_due on public.tasks (workspace_id, due_date) where deleted_at is null;
create index tasks_parent on public.tasks (parent_task_id) where parent_task_id is not null;
create index tasks_title_trgm on public.tasks using gin (public.tr_normalize(title) gin_trgm_ops);
create index tasks_deleted on public.tasks (deleted_at) where deleted_at is not null;

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user on public.task_assignees (user_id, workspace_id);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#8A8FA3' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create unique index labels_unique_name on public.labels (workspace_id, public.tr_normalize(name));

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (task_id, label_id)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  is_done boolean not null default false,
  position text not null collate "C",
  created_at timestamptz not null default now()
);
create index checklist_items_task on public.checklist_items (task_id, position);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  verb text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_workspace_created on public.activities (workspace_id, created_at desc);
create index activities_task on public.activities (task_id, created_at desc) where task_id is not null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  kind public.invitation_kind not null,
  email text,
  role public.workspace_role not null check (role in ('admin', 'member', 'guest')),
  project_role public.project_role,
  token_hash text not null unique,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'email' or email is not null)
);
create index invitations_workspace on public.invitations (workspace_id, created_at desc);

create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  provider text,
  provider_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  name text not null check (name ~ '^[a-z_]{2,64}$'),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_name_created on public.analytics_events (name, created_at desc);

create table public.user_view_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  view public.project_view not null default 'list',
  filters jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table public.cron_runs (
  job text primary key,
  last_run_at timestamptz not null,
  last_result jsonb not null default '{}'::jsonb
);

-- ── Generic triggers ────────────────────────────────────────────────────────
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger workspaces_touch before update on public.workspaces for each row execute function app.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function app.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function app.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function app.touch_updated_at();

-- Profiles are created for every new auth user.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)), 120)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ── Tenant integrity: child rows always inherit workspace_id from their parent ──
-- (so a forged workspace_id in a request can never cross tenants)
-- Postgres fires same-event triggers in NAME order: inheritance triggers are named
-- "t10_*" and guards "t20_*" so guards always see the inherited workspace_id.

create or replace function app.inherit_ws_from_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select p.workspace_id into new.workspace_id from public.projects p where p.id = new.project_id;
  if new.workspace_id is null then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger t10_project_members_ws before insert or update of project_id on public.project_members
  for each row execute function app.inherit_ws_from_project();
create trigger t10_project_statuses_ws before insert or update of project_id on public.project_statuses
  for each row execute function app.inherit_ws_from_project();

create or replace function app.inherit_ws_from_task()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select t.workspace_id into new.workspace_id from public.tasks t where t.id = new.task_id;
  if new.workspace_id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger t10_task_assignees_ws before insert on public.task_assignees
  for each row execute function app.inherit_ws_from_task();
create trigger t10_task_labels_ws before insert on public.task_labels
  for each row execute function app.inherit_ws_from_task();
create trigger t10_checklist_items_ws before insert on public.checklist_items
  for each row execute function app.inherit_ws_from_task();

-- Tasks: workspace from project, status must belong to the project, one level of
-- subtasks, completed_at follows the status category.
create or replace function app.tasks_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_category public.status_category;
  v_parent record;
begin
  select p.workspace_id into new.workspace_id from public.projects p where p.id = new.project_id;
  if new.workspace_id is null then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

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

create trigger tasks_integrity before insert or update of project_id, status_id, parent_task_id, completed_at
  on public.tasks for each row execute function app.tasks_integrity();

-- Moving a parent task moves its subtasks along (keeps the one-project invariant).
create or replace function app.tasks_cascade_move()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_first_status uuid;
begin
  if new.project_id is distinct from old.project_id then
    select s.id into v_first_status from public.project_statuses s
     where s.project_id = new.project_id and s.category = 'todo' order by s.position limit 1;
    update public.tasks c
       set project_id = new.project_id,
           status_id = coalesce(
             (select s2.id from public.project_statuses s2
               where s2.project_id = new.project_id
                 and s2.category = (select s3.category from public.project_statuses s3 where s3.id = c.status_id)
               order by s2.position limit 1),
             v_first_status)
     where c.parent_task_id = new.id;
  end if;
  return null;
end $$;

create trigger tasks_cascade_move after update of project_id on public.tasks
  for each row execute function app.tasks_cascade_move();

-- Assignees must be members of the workspace; labels must be from the same workspace.
create or replace function app.task_assignee_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workspace_members m
     where m.workspace_id = new.workspace_id and m.user_id = new.user_id
  ) then
    raise exception 'assignee is not a workspace member' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger t20_task_assignee_guard before insert on public.task_assignees
  for each row execute function app.task_assignee_guard();

create or replace function app.task_label_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.labels l where l.id = new.label_id and l.workspace_id = new.workspace_id) then
    raise exception 'label belongs to another workspace' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger t20_task_label_guard before insert on public.task_labels
  for each row execute function app.task_label_guard();

-- Projects can never change workspace; workspace ids are immutable on children.
create or replace function app.immutable_workspace_id()
returns trigger language plpgsql as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger projects_ws_immutable before update of workspace_id on public.projects
  for each row execute function app.immutable_workspace_id();
create trigger workspace_members_ws_immutable before update of workspace_id on public.workspace_members
  for each row execute function app.immutable_workspace_id();

-- Personal projects keep their shape.
create or replace function app.personal_project_guard()
returns trigger language plpgsql as $$
begin
  if old.is_personal and (new.is_personal is distinct from old.is_personal
      or new.visibility <> 'private' or new.deleted_at is not null or new.archived_at is not null) then
    raise exception 'personal project cannot be changed this way' using errcode = '23514';
  end if;
  if not old.is_personal and new.is_personal then
    raise exception 'cannot turn a project into a personal project' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger projects_personal_guard before update on public.projects
  for each row execute function app.personal_project_guard();
