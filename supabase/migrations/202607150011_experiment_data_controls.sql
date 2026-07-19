-- Enforces FR-DATA-001~005, AC-DATA-001, NFR-DATA-002~003 and NFR-SEC-002.

alter table public.experiment_data
  drop constraint if exists experiment_data_data_type_check;

alter table public.experiment_data
  add constraint experiment_data_data_type_check
  check (data_type in ('RAW', 'PROCESSED', 'RESULT'));

alter table public.experiment_data
  drop constraint if exists experiment_data_value_shape_check;

alter table public.experiment_data
  add constraint experiment_data_value_shape_check
  check (
    (data_type = 'RAW' and raw_value is not null and processed_value is null)
    or (data_type in ('PROCESSED', 'RESULT') and raw_value is null and processed_value is not null)
  );

create or replace function public.guard_experiment_data_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.recorded_by <> auth.uid() then
    raise exception 'Recorded by must match the authenticated user' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.experiment_task
    where id = new.task_id
      and status in ('APPROVED', 'ARCHIVED')
  ) then
    raise exception 'Task does not accept new data' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.task_sample
    where task_id = new.task_id and sample_id = new.sample_id
  ) then
    raise exception 'Sample is not linked to task' using errcode = '23503';
  end if;

  if new.instrument_id is not null and exists (
    select 1
    from public.instrument
    where id = new.instrument_id and status = 'SCRAPPED'
  ) then
    raise exception 'Instrument is scrapped' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists experiment_data_insert_guard on public.experiment_data;
create trigger experiment_data_insert_guard
before insert on public.experiment_data
for each row execute function public.guard_experiment_data_insert();

drop policy if exists data_manage_by_permission on public.experiment_data;
drop policy if exists data_insert_by_permission on public.experiment_data;
create policy data_insert_by_permission
on public.experiment_data for insert to authenticated
with check (public.has_permission('data.manage'));

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
    'resource.manage', 'project.manage', 'task.read', 'task.manage', 'task.assign',
    'sample.manage', 'data.manage'
  ) then
    raise exception 'Unsupported audit permission' using errcode = '22023';
  end if;

  if not public.has_permission(_required_permission) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.audit_log (
    operator_id, object_type, object_id, action, before_json, after_json
  ) values (
    auth.uid(), _object_type, _object_id, _action, _before_json, _after_json
  );
end;
$$;

grant execute on function public.record_audit_event(varchar, varchar, varchar, varchar, jsonb, jsonb) to authenticated;
revoke execute on function public.guard_experiment_data_insert() from public;
