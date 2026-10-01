-- A personal project is private to its owner, so a task in it can only be assigned to the
-- owner. Assigning anyone else would make the task invisible to the person it was given to
-- (found in the end-to-end run: "Cuma Mehmet'e logoyu tasarlat" landed in the sender's
-- personal project). The app picks a team project for delegation; the database refuses
-- the invisible case outright.

create or replace function app.task_assignee_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workspace_members m
     where m.workspace_id = new.workspace_id and m.user_id = new.user_id
  ) then
    raise exception 'assignee is not a workspace member' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
     where t.id = new.task_id and p.is_personal and p.created_by <> new.user_id
  ) then
    raise exception 'personal_project_assignee' using errcode = '23514';
  end if;
  return new;
end $$;

-- Moving a task (with its subtasks) into a personal project keeps only the owner's assignment.
create or replace function app.tasks_personal_move_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.projects p
      join public.task_assignees a on a.task_id = new.id
     where p.id = new.project_id and p.is_personal and a.user_id <> p.created_by
  ) then
    raise exception 'personal_project_assignee' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger t20_tasks_personal_move_guard after update of project_id on public.tasks
  for each row when (old.project_id is distinct from new.project_id)
  execute function app.tasks_personal_move_guard();
