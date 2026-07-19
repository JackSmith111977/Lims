-- Allow project and task registration services to use the append-only audit function.
-- Implements: FR-TASK-001~002, NFR-SEC-002.

create or replace function public.record_audit_event(
  _required_permission varchar,
  _object_type varchar,
  _object_id varchar,
  _action varchar,
  _before_json jsonb default null,
  _after_json jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _required_permission not in (
    'auth.user.manage', 'auth.role.manage', 'settings.manage',
    'resource.manage', 'project.manage', 'task.manage'
  ) then
    raise exception 'unsupported audit permission';
  end if;

  if not public.has_permission(_required_permission) then
    raise exception 'permission denied';
  end if;

  insert into public.audit_log (
    operator_id, object_type, object_id, action, before_json, after_json
  ) values (
    auth.uid(), _object_type, _object_id, _action, _before_json, _after_json
  );
end;
$$;

grant execute on function public.record_audit_event(varchar, varchar, varchar, varchar, jsonb, jsonb) to authenticated;

drop policy if exists method_read_for_task on public.experiment_method;
create policy method_read_for_task
on public.experiment_method for select to authenticated
using (public.has_permission('task.read') or public.has_permission('resource.read'));
