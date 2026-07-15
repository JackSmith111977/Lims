-- Implements FR-EQUIP-003~006 and AC-RESOURCE-001.
-- Maintenance/calibration records are append-only and calibration dates update the instrument atomically.

alter table public.instrument_maintenance
  add column if not exists cycle_days integer;

alter table public.instrument_maintenance
  drop constraint if exists instrument_maintenance_type_check;
alter table public.instrument_maintenance
  add constraint instrument_maintenance_type_check
  check (maintenance_type in ('MAINTENANCE', 'REPAIR', 'INSPECTION', 'CALIBRATION'));
alter table public.instrument_maintenance
  drop constraint if exists instrument_maintenance_cycle_check;
alter table public.instrument_maintenance
  add constraint instrument_maintenance_cycle_check
  check (cycle_days is null or cycle_days > 0);

create index if not exists idx_instrument_maintenance_due
  on public.instrument_maintenance(next_due_on, instrument_id);

alter table public.instrument_maintenance enable row level security;
drop policy if exists instrument_maintenance_read_by_permission on public.instrument_maintenance;
drop policy if exists instrument_maintenance_manage_by_permission on public.instrument_maintenance;
create policy instrument_maintenance_read_by_permission
on public.instrument_maintenance for select to authenticated
using (public.has_permission('resource.read'));

revoke all on table public.instrument_maintenance from anon, authenticated;
grant select on table public.instrument_maintenance to authenticated;

create or replace function public.guard_instrument_maintenance_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;
  raise exception 'Instrument maintenance records are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists instrument_maintenance_immutable on public.instrument_maintenance;
create trigger instrument_maintenance_immutable
before update or delete on public.instrument_maintenance
for each row execute function public.guard_instrument_maintenance_immutable();

create or replace function public.record_instrument_maintenance(_instrument_id bigint, _payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  instrument_row public.instrument%rowtype;
  maintenance_row public.instrument_maintenance%rowtype;
  maintenance_type_value varchar(32) := upper(trim(_payload->>'maintenance_type'));
  occurred_on_value date := nullif(trim(_payload->>'occurred_on'), '')::date;
  next_due_on_value date := nullif(trim(_payload->>'next_due_on'), '')::date;
  cycle_days_value integer := nullif(trim(_payload->>'cycle_days'), '')::integer;
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('resource.manage') then
    raise exception 'Instrument maintenance permission denied' using errcode = '42501';
  end if;
  select * into instrument_row from public.instrument where id = _instrument_id for update;
  if not found then raise exception 'Instrument not found' using errcode = 'P0002'; end if;
  if instrument_row.status = 'SCRAPPED' then raise exception 'Scrapped instruments cannot receive maintenance records' using errcode = '55000'; end if;
  if maintenance_type_value not in ('MAINTENANCE', 'REPAIR', 'INSPECTION', 'CALIBRATION') or occurred_on_value is null then
    raise exception 'Invalid maintenance type or occurred date' using errcode = '22023';
  end if;
  if instrument_row.commissioned_at is not null and occurred_on_value < instrument_row.commissioned_at then
    raise exception 'Maintenance date cannot precede commissioning' using errcode = '22023';
  end if;
  if next_due_on_value is not null and next_due_on_value < occurred_on_value then
    raise exception 'Next due date cannot precede occurrence date' using errcode = '22023';
  end if;
  if maintenance_type_value = 'CALIBRATION' and (cycle_days_value is null or cycle_days_value <= 0 or next_due_on_value is null) then
    raise exception 'Calibration requires cycle and next due date' using errcode = '22023';
  end if;
  if cycle_days_value is not null and next_due_on_value <> occurred_on_value + cycle_days_value then
    raise exception 'Next due date does not match cycle' using errcode = '22023';
  end if;

  insert into public.instrument_maintenance (
    instrument_id, maintenance_type, occurred_on, operator_id, result, cycle_days, next_due_on, attachment_id, remark
  ) values (
    instrument_row.id,
    maintenance_type_value,
    occurred_on_value,
    operator_id,
    nullif(trim(_payload->>'result'), ''),
    cycle_days_value,
    next_due_on_value,
    null,
    nullif(trim(_payload->>'remark'), '')
  ) returning * into maintenance_row;

  if maintenance_type_value = 'CALIBRATION' then
    perform set_config('lims.instrument_write', 'on', true);
    update public.instrument
    set next_calibration_at = next_due_on_value
    where id = instrument_row.id;
    perform public.record_audit_event(
      'resource.manage', 'instrument', instrument_row.id::text, 'CALIBRATION_UPDATE',
      jsonb_build_object('nextCalibrationAt', instrument_row.next_calibration_at),
      jsonb_build_object('nextCalibrationAt', next_due_on_value)
    );
  end if;

  perform public.record_audit_event(
    'resource.manage', 'instrument_maintenance', maintenance_row.id::text, 'CREATE', null, to_jsonb(maintenance_row)
  );
  return to_jsonb(maintenance_row);
end;
$$;

revoke all on function public.record_instrument_maintenance(bigint, jsonb) from public;
grant execute on function public.record_instrument_maintenance(bigint, jsonb) to authenticated;
