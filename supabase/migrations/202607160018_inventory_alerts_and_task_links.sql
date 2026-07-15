-- Implements FR-INVENTORY-005~006 on top of 202607160017.
-- Alerts are computed from current inventory state; usage links stay in the immutable transaction.

alter table public.inventory_item
  add column if not exists low_stock_threshold numeric(18, 6) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_item'::regclass
      and conname = 'inventory_item_low_stock_threshold_check'
  ) then
    execute 'alter table public.inventory_item add constraint inventory_item_low_stock_threshold_check check (low_stock_threshold >= 0)';
  end if;
end;
$$;

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
  threshold_value numeric := coalesce(nullif(trim(_payload->>'low_stock_threshold'), '')::numeric, 0);
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
  if threshold_value < 0 then
    raise exception 'Low stock threshold must be non-negative' using errcode = '22023';
  end if;
  if _payload ? 'quantity' then
    raise exception 'Inventory quantity is transaction-managed' using errcode = '22023';
  end if;

  perform set_config('lims.inventory_write', 'on', true);
  insert into public.inventory_item (
    item_code, type, name, batch_no, manufacturer, quantity, unit, expiry_date,
    storage_condition, location, status, low_stock_threshold
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
    status_value,
    threshold_value
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
  threshold_value numeric;
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
  threshold_value := case when _payload ? 'low_stock_threshold' then nullif(trim(_payload->>'low_stock_threshold'), '')::numeric else before_row.low_stock_threshold end;
  if threshold_value is null or threshold_value < 0 then
    raise exception 'Low stock threshold must be non-negative' using errcode = '22023';
  end if;
  if not (_payload ? 'type' or _payload ? 'name' or _payload ? 'batch_no' or _payload ? 'manufacturer'
      or _payload ? 'unit' or _payload ? 'expiry_date' or _payload ? 'storage_condition'
      or _payload ? 'location' or _payload ? 'status' or _payload ? 'low_stock_threshold') then
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
      status = status_value,
      low_stock_threshold = threshold_value
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
  task_id_value bigint := nullif(trim(_payload->>'task_id'), '')::bigint;
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
  if task_id_value is not null then
    if transaction_type_value <> 'OUTBOUND' then
      raise exception 'Only OUTBOUND inventory usage can link an experiment task' using errcode = '22023';
    end if;
    if not public.has_permission('task.read') then
      raise exception 'Task permission denied' using errcode = '42501';
    end if;
    if not exists (select 1 from public.experiment_task where id = task_id_value and status <> 'ARCHIVED') then
      raise exception 'Experiment task not found or archived' using errcode = '23514';
    end if;
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
    task_id_value,
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
    jsonb_build_object('quantity', item_row.quantity, 'status', item_row.status, 'transactionId', transaction_row.id, 'taskId', transaction_row.task_id)
  );
  perform public.record_audit_event(
    'resource.manage', 'inventory_transaction', transaction_row.id::text, 'CREATE', null, to_jsonb(transaction_row)
  );
  return to_jsonb(transaction_row);
end;
$$;

create or replace function public.get_inventory_alerts(_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('resource.read') then
    raise exception 'Inventory permission denied' using errcode = '42501';
  end if;
  if _days is null or _days < 0 or _days > 365 then
    raise exception 'Inventory alert window must be between 0 and 365 days' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(alert_row) order by alert_row.severity_rank, alert_row.days_until_expiry nulls last, alert_row.item_code, alert_row.alert_type)
    from (
      select
        id as item_id, item_code, name as item_name, 'LOW_STOCK'::text as alert_type,
        case when quantity = 0 then 'CRITICAL' else 'WARNING' end::text as severity,
        case when quantity = 0 then 0 else 1 end as severity_rank,
        quantity, low_stock_threshold, expiry_date, null::integer as days_until_expiry,
        unit, location
      from public.inventory_item
      where status <> 'INACTIVE' and low_stock_threshold > 0 and quantity <= low_stock_threshold
      union all
      select
        id as item_id, item_code, name as item_name,
        case when expiry_date < current_date then 'EXPIRED' else 'EXPIRING' end::text as alert_type,
        case when expiry_date < current_date then 'CRITICAL' else 'WARNING' end::text as severity,
        case when expiry_date < current_date then 0 else 1 end as severity_rank,
        quantity, low_stock_threshold, expiry_date, (expiry_date - current_date)::integer as days_until_expiry,
        unit, location
      from public.inventory_item
      where status <> 'INACTIVE' and expiry_date is not null and expiry_date <= current_date + _days
    ) alert_row
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_inventory_alerts(integer) from public;
grant execute on function public.get_inventory_alerts(integer) to authenticated;
