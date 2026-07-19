-- Implements FR-EQUIP-001~003, FR-EQUIP-006, AC-RESOURCE-001 and NFR-SEC-002.
-- Instrument writes are restricted to audited transaction RPCs; service-role cleanup remains available.

create or replace function public.guard_instrument_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('lims.instrument_write', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'Instrument writes must use the instrument transaction API' using errcode = '42501';
end;
$$;

drop trigger if exists instrument_write_guard on public.instrument;
create trigger instrument_write_guard
before insert or update or delete on public.instrument
for each row execute function public.guard_instrument_write();

alter table public.instrument enable row level security;
drop policy if exists instrument_manage_by_permission on public.instrument;
drop policy if exists instrument_read_by_permission on public.instrument;
create policy instrument_read_by_permission
on public.instrument for select to authenticated
using (public.has_permission('resource.read'));

revoke all on table public.instrument from anon, authenticated;
grant select on table public.instrument to authenticated;

create or replace function public.create_instrument(_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  instrument_row public.instrument%rowtype;
  instrument_code_value varchar(32) := nullif(trim(_payload->>'instrument_code'), '');
  name_value varchar(128) := nullif(trim(_payload->>'name'), '');
  type_value varchar(64) := nullif(trim(_payload->>'type'), '');
  status_value varchar(16) := coalesce(nullif(upper(trim(_payload->>'status')), ''), 'ACTIVE');
  owner_id_value uuid := nullif(trim(_payload->>'owner_id'), '')::uuid;
  commissioned_at_value date := nullif(trim(_payload->>'commissioned_at'), '')::date;
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('resource.manage') then
    raise exception 'Instrument permission denied' using errcode = '42501';
  end if;
  if instrument_code_value is null or length(instrument_code_value) > 32 or name_value is null or length(name_value) > 128 or type_value is null or length(type_value) > 64 then
    raise exception 'Instrument code, name and type are required' using errcode = '22023';
  end if;
  if status_value not in ('ACTIVE', 'INACTIVE') then
    raise exception 'New instruments must be ACTIVE or INACTIVE' using errcode = '22023';
  end if;
  if owner_id_value is not null and not exists (select 1 from public.sys_user where id = owner_id_value and status = 'ACTIVE') then
    raise exception 'Instrument owner must be active' using errcode = '22023';
  end if;

  perform set_config('lims.instrument_write', 'on', true);
  insert into public.instrument (
    instrument_code, name, type, model, manufacturer, location, owner_id, status, commissioned_at
  ) values (
    instrument_code_value,
    name_value,
    type_value,
    nullif(trim(_payload->>'model'), ''),
    nullif(trim(_payload->>'manufacturer'), ''),
    nullif(trim(_payload->>'location'), ''),
    owner_id_value,
    status_value,
    commissioned_at_value
  ) returning * into instrument_row;

  perform public.record_audit_event(
    'resource.manage', 'instrument', instrument_row.id::text, 'CREATE', null, to_jsonb(instrument_row)
  );
  return to_jsonb(instrument_row);
end;
$$;

create or replace function public.update_instrument(_instrument_id bigint, _payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  before_row public.instrument%rowtype;
  after_row public.instrument%rowtype;
  status_value varchar(16);
  owner_id_value uuid;
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('resource.manage') then
    raise exception 'Instrument permission denied' using errcode = '42501';
  end if;
  select * into before_row from public.instrument where id = _instrument_id for update;
  if not found then raise exception 'Instrument not found' using errcode = 'P0002'; end if;
  if _payload ? 'instrument_code' or _payload ? 'commissioned_at' or _payload ? 'next_calibration_at' then
    raise exception 'Instrument identity and lifecycle dates are immutable here' using errcode = '22023';
  end if;

  status_value := case when _payload ? 'status' then upper(trim(_payload->>'status')) else before_row.status end;
  if status_value not in ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SCRAPPED') then
    raise exception 'Invalid instrument status' using errcode = '22023';
  end if;
  if before_row.status = 'SCRAPPED' and status_value <> 'SCRAPPED' then
    raise exception 'Scrapped instruments cannot be restored' using errcode = '55000';
  end if;
  if _payload ? 'owner_id' then
    owner_id_value := nullif(trim(_payload->>'owner_id'), '')::uuid;
    if owner_id_value is not null and not exists (select 1 from public.sys_user where id = owner_id_value and status = 'ACTIVE') then
      raise exception 'Instrument owner must be active' using errcode = '22023';
    end if;
  else
    owner_id_value := before_row.owner_id;
  end if;

  perform set_config('lims.instrument_write', 'on', true);
  update public.instrument
  set name = case when _payload ? 'name' then nullif(trim(_payload->>'name'), '') else before_row.name end,
      type = case when _payload ? 'type' then nullif(trim(_payload->>'type'), '') else before_row.type end,
      model = case when _payload ? 'model' then nullif(trim(_payload->>'model'), '') else before_row.model end,
      manufacturer = case when _payload ? 'manufacturer' then nullif(trim(_payload->>'manufacturer'), '') else before_row.manufacturer end,
      location = case when _payload ? 'location' then nullif(trim(_payload->>'location'), '') else before_row.location end,
      owner_id = owner_id_value,
      status = status_value
  where id = before_row.id
  returning * into after_row;

  perform public.record_audit_event(
    'resource.manage', 'instrument', after_row.id::text, 'UPDATE', to_jsonb(before_row), to_jsonb(after_row)
  );
  return to_jsonb(after_row);
end;
$$;

revoke all on function public.create_instrument(jsonb) from public;
revoke all on function public.update_instrument(bigint, jsonb) from public;
grant execute on function public.create_instrument(jsonb) to authenticated;
grant execute on function public.update_instrument(bigint, jsonb) to authenticated;
