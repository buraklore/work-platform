-- Plan usage counters. SECURITY DEFINER because limits must count rows the caller
-- cannot see (e.g. tasks in private projects), but only for members of the workspace.
create or replace function app.workspace_usage(p_ws uuid)
returns table (members integer, guests integer, projects integer, active_tasks integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if app.ws_role(p_ws) is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query select
    (select count(*)::integer from public.workspace_members m where m.workspace_id = p_ws and m.role <> 'guest'),
    (select count(*)::integer from public.workspace_members m where m.workspace_id = p_ws and m.role = 'guest'),
    (select count(*)::integer from public.projects p
      where p.workspace_id = p_ws and not p.is_personal and p.deleted_at is null and p.archived_at is null),
    (select count(*)::integer from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.workspace_id = p_ws and t.deleted_at is null and t.completed_at is null and p.deleted_at is null);
end $$;

grant execute on function app.workspace_usage(uuid) to app_user;
