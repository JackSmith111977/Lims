-- Implements: FR-SAMPLE-001~003, AC-SAMPLE-001, NFR-SEC-001~002.
-- T-203 extends the shared audit RPC for sample registration and sample-task links.

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
    'auth.user.manage',
    'auth.role.manage',
    'settings.manage',
    'resource.manage',
    'project.manage',
    'task.manage',
    'sample.manage'
  ) then
    raise exception 'Unsupported audit permission' using errcode = '22023';
  end if;

  if not public.has_permission(_required_permission) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.audit_log (
    operator_id,
    object_type,
    object_id,
    action,
    before_json,
    after_json
  )
  values (
    auth.uid(),
    _object_type,
    _object_id,
    _action,
    _before_json,
    _after_json
  );
end;
$$;

grant execute on function public.record_audit_event(varchar, varchar, varchar, varchar, jsonb, jsonb) to authenticated;
