-- Implements FR-INVENTORY-001~004 and AC-RESOURCE-001.
-- Inventory balance changes are append-only transaction operations with audited row locks.

alter table public.inventory_transaction
  drop constraint if exists inventory_transaction_transaction_type_check;
alter table public.inventory_transaction
  add constraint inventory_transaction_transaction_type_check
  check (transaction_type in ('INBOUND', 'OUTBOUND', 'RETURN', 'SCRAP'));

create index if not exists idx_inventory_tx_item_time_id
  on public.inventory_transaction(item_id, occurred_at desc, id desc);

alter table public.inventory_item enable row level security;
alter table public.inventory_transaction enable row level security;
drop policy if exists inventory_manage_by_permission on public.inventory_item;
drop policy if exists inventory_read_by_permission on public.inventory_item;
drop policy if exists inventory_transaction_read_by_permission on public.inventory_transaction;
create policy inventory_read_by_permission
on public.inventory_item for select to authenticated
using (public.has_permission('resource.read'));
create policy inventory_transaction_read_by_permission
on public.inventory_transaction for select to authenticated
using (public.has_permission('resource.read'));

revoke all on table public.inventory_item from anon, authenticated;
revoke all on table public.inventory_transaction from anon, authenticated;
grant select on table public.inventory_item to authenticated;
grant select on table public.inventory_transaction to authenticated;

create or replace function public.guard_inventory_item_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('lims.inventory_write', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'Inventory item writes must use the inventory transaction API' using errcode = '42501';
end;
$$;

drop trigger if exists inventory_item_write_guard on public.inventory_item;
create trigger inventory_item_write_guard
before insert or update or delete on public.inventory_item
for each row execute function public.guard_inventory_item_write();

create or replace function public.guard_inventory_transaction_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;
  raise exception 'Inventory transactions are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists inventory_transaction_immutable on public.inventory_transaction;
create trigger inventory_transaction_immutable
before update or delete on public.inventory_transaction
for each row execute function public.guard_inventory_transaction_immutable();

create or replace function public.create_inventory_item(_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  item_row public.inventory_item%rowtype;
  item_code_value varchar(32) := nullif(trim(_payload->>'item_code'), '');
  type_value varchar(32) := nullif(trim(_payload->>'type'), '');
  name_value varchar(128) := nullif(trim(_payload->>'name'), '');
  unit_value varchar(16) := nullif(trim(_payload->>'unit'), '');
  status_value varchar(16) := coalesce(nullif(upper(trim(_payload->>'status')), ''), 'ACTIVE');
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('resource.manage') then
    raise exception 'Inventory permission denied' using errcode = '42501';
  end if;
  if item_code_value is null or type_value is null or name_value is null or unit_value is null then
    raise exception 'Item code, type, name and unit are required' using errcode = '22023';
  end if;
  if status_value not in ('ACTIVE', 'INACTIVE') then
    raise exception 'New inventory items must be ACTIVE or INACTIVE' using errcode = '22023';
  end if;
  if _payload ? 'quantity' then
    raise exception 'Inventory quantity is transaction-managed' using errcode = '22023';
  end if;

  perform set_config('lims.inventory_write', 'on', true);
  insert into public.inventory_item (
    item_code, type, name, batch_no, manufacturer, quantity, unit, expiry_date,
    storage_condition, location, status
  ) values (
    item_code_value,
    type_value,
    name_value,
    nullif(trim(_payload->>'batch_no'), ''),
    nullif(trim(_payload->>'manufacturer'), ''),
    0,
    unit_value,
    nullif(trim(_payload->>'expiry_date'), '')::date,
    nullif(trim(_payload->>'storage_condition'), ''),
    nullif(trim(_payload->>'location'), ''),
    status_value
  ) returning * into item_row;

  perform public.record_audit_event(
    'resource.manage', 'inventory_item', item_row.id::text, 'CREATE', null, to_jsonb(item_row)
  );
  return to_jsonb(item_row);
end;
$$;

create or replace function public.update_inventory_item(_item_id bigint, _payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  before_row public.inventory_item%rowtype;
  after_row public.inventory_item%rowtype;
  status_value varchar(16);
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('resource.manage') then
    raise exception 'Inventory permission denied' using errcode = '42501';
  end if;
  select * into before_row from public.inventory_item where id = _item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  if _payload ? 'id' or _payload ? 'item_code' or _payload ? 'quantity' or _payload ? 'created_at' or _payload ? 'updated_at' then
    raise exception 'Inventory identity, quantity and timestamps are immutable here' using errcode = '22023';
  end if;
  if before_row.status in ('EXPIRED', 'DEPLETED') and _payload ? 'status' then
    raise exception 'Inventory status is managed by transaction or reminder flows' using errcode = '55000';
  end if;

  status_value := case when _payload ? 'status' then upper(trim(_payload->>'status')) else before_row.status end;
  if status_value not in ('ACTIVE', 'INACTIVE', 'EXPIRED', 'DEPLETED') then
    raise exception 'Invalid inventory item status' using errcode = '22023';
  end if;
  if _payload ? 'status' and status_value in ('EXPIRED', 'DEPLETED') then
    raise exception 'Expired and depleted status are managed by system flows' using errcode = '55000';
  end if;
  if not (_payload ? 'type' or _payload ? 'name' or _payload ? 'batch_no' or _payload ? 'manufacturer'
      or _payload ? 'unit' or _payload ? 'expiry_date' or _payload ? 'storage_condition'
      or _payload ? 'location' or _payload ? 'status') then
    raise exception 'No editable inventory fields supplied' using errcode = '22023';
  end if;

  perform set_config('lims.inventory_write', 'on', true);
  update public.inventory_item
  set type = case when _payload ? 'type' then nullif(trim(_payload->>'type'), '') else before_row.type end,
      name = case when _payload ? 'name' then nullif(trim(_payload->>'name'), '') else before_row.name end,
      batch_no = case when _payload ? 'batch_no' then nullif(trim(_payload->>'batch_no'), '') else before_row.batch_no end,
      manufacturer = case when _payload ? 'manufacturer' then nullif(trim(_payload->>'manufacturer'), '') else before_row.manufacturer end,
      unit = case when _payload ? 'unit' then nullif(trim(_payload->>'unit'), '') else before_row.unit end,
      expiry_date = case when _payload ? 'expiry_date' then nullif(trim(_payload->>'expiry_date'), '')::date else before_row.expiry_date end,
      storage_condition = case when _payload ? 'storage_condition' then nullif(trim(_payload->>'storage_condition'), '') else before_row.storage_condition end,
      location = case when _payload ? 'location' then nullif(trim(_payload->>'location'), '') else before_row.location end,
      status = status_value
  where id = before_row.id
  returning * into after_row;

  perform public.record_audit_event(
    'resource.manage', 'inventory_item', after_row.id::text, 'UPDATE', to_jsonb(before_row), to_jsonb(after_row)
  );
  return to_jsonb(after_row);
end;
$$;

create or replace function public.record_inventory_transaction(_item_id bigint, _payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  item_row public.inventory_item%rowtype;
  transaction_row public.inventory_transaction%rowtype;
  transaction_type_value varchar(16) := upper(trim(_payload->>'transaction_type'));
  quantity_value numeric := nullif(trim(_payload->>'quantity'), '')::numeric;
  balance_before numeric;
  status_before varchar(16);
  balance_after numeric;
  status_after varchar(16);
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('resource.manage') then
    raise exception 'Inventory permission denied' using errcode = '42501';
  end if;
  select * into item_row from public.inventory_item where id = _item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  if transaction_type_value not in ('INBOUND', 'OUTBOUND', 'RETURN', 'SCRAP') or quantity_value is null or quantity_value <= 0 then
    raise exception 'Invalid inventory transaction type or quantity' using errcode = '22023';
  end if;
  if transaction_type_value in ('OUTBOUND', 'SCRAP') and quantity_value > item_row.quantity then
    raise exception 'Insufficient inventory quantity' using errcode = '55000';
  end if;

  balance_before := item_row.quantity;
  status_before := item_row.status;
  balance_after := case
    when transaction_type_value in ('INBOUND', 'RETURN') then item_row.quantity + quantity_value
    else item_row.quantity - quantity_value
  end;
  status_after := case
    when balance_after = 0 then 'DEPLETED'
    when item_row.status = 'DEPLETED' then 'ACTIVE'
    else item_row.status
  end;

  insert into public.inventory_transaction (
    item_id, task_id, transaction_type, quantity, operator_id, remark
  ) values (
    item_row.id,
    null,
    transaction_type_value,
    quantity_value,
    operator_id,
    nullif(trim(_payload->>'remark'), '')
  ) returning * into transaction_row;

  perform set_config('lims.inventory_write', 'on', true);
  update public.inventory_item
  set quantity = balance_after, status = status_after
  where id = item_row.id;
  select * into item_row from public.inventory_item where id = _item_id;

  perform public.record_audit_event(
    'resource.manage', 'inventory_item', item_row.id::text, 'STOCK_UPDATE',
    jsonb_build_object('quantity', balance_before, 'status', status_before),
    jsonb_build_object('quantity', item_row.quantity, 'status', item_row.status, 'transactionId', transaction_row.id)
  );
  perform public.record_audit_event(
    'resource.manage', 'inventory_transaction', transaction_row.id::text, 'CREATE', null, to_jsonb(transaction_row)
  );
  return to_jsonb(transaction_row);
end;
$$;

revoke all on function public.create_inventory_item(jsonb) from public;
revoke all on function public.update_inventory_item(bigint, jsonb) from public;
revoke all on function public.record_inventory_transaction(bigint, jsonb) from public;
grant execute on function public.create_inventory_item(jsonb) to authenticated;
grant execute on function public.update_inventory_item(bigint, jsonb) to authenticated;
grant execute on function public.record_inventory_transaction(bigint, jsonb) to authenticated;
