-- Implements: FR-SAMPLE-004~006, AC-SAMPLE-002, BR-003, BR-005, NFR-SEC-002.
-- T-204 keeps sample status and sample_flow writes atomic and server-controlled.

create policy sample_flow_read_by_permission
on public.sample_flow for select to authenticated
using (public.has_permission('sample.read'));

create or replace function public.transition_sample_flow(
  _sample_id bigint,
  _node varchar,
  _location varchar default null,
  _handover_to uuid default null,
  _remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sample_row public.sample%rowtype;
  operator_id uuid := auth.uid();
  target_status varchar(16);
  flow_id bigint;
  occurred_at timestamptz := now();
begin
  if operator_id is null
     or not exists (
       select 1 from public.sys_user
       where id = operator_id and status = 'ACTIVE'
     )
     or not public.has_permission('sample.manage') then
    raise exception 'Flow permission denied' using errcode = '42501';
  end if;

  select * into sample_row
  from public.sample
  where id = _sample_id
  for update;

  if not found then
    raise exception 'Sample not found' using errcode = 'P0002';
  end if;

  if _node not in ('COLLECT', 'DISTRIBUTE', 'TRANSFER', 'PROCESS', 'ARCHIVE', 'DISPOSE') then
    raise exception 'Invalid flow node' using errcode = '22023';
  end if;

  if _handover_to is not null
     and not exists (
       select 1 from public.sys_user
       where id = _handover_to and status = 'ACTIVE'
     ) then
    raise exception 'Handover user inactive' using errcode = '22023';
  end if;

  case _node
    when 'COLLECT', 'DISTRIBUTE' then
      if sample_row.status <> 'REGISTERED' then
        raise exception 'Invalid sample flow transition' using errcode = '22023';
      end if;
      target_status := sample_row.status;
    when 'TRANSFER' then
      if sample_row.status not in ('REGISTERED', 'PROCESSING', 'PROCESSED') then
        raise exception 'Invalid sample flow transition' using errcode = '22023';
      end if;
      target_status := sample_row.status;
    when 'PROCESS' then
      if sample_row.status = 'REGISTERED' then
        target_status := 'PROCESSING';
      elsif sample_row.status = 'PROCESSING' then
        target_status := 'PROCESSED';
      else
        raise exception 'Invalid sample flow transition' using errcode = '22023';
      end if;
    when 'ARCHIVE' then
      if sample_row.status <> 'PROCESSED' then
        raise exception 'Invalid sample flow transition' using errcode = '22023';
      end if;
      target_status := 'ARCHIVED';
    when 'DISPOSE' then
      if sample_row.status <> 'PROCESSED' then
        raise exception 'Invalid sample flow transition' using errcode = '22023';
      end if;
      target_status := 'DISPOSED';
  end case;

  if target_status <> sample_row.status then
    update public.sample
    set status = target_status,
        updated_at = occurred_at
    where id = sample_row.id;
  end if;

  insert into public.sample_flow (
    sample_id, from_status, to_status, node, operator_id,
    location, handover_to, remark, occurred_at
  ) values (
    sample_row.id, sample_row.status, target_status, _node, operator_id,
    nullif(trim(_location), ''), _handover_to, nullif(trim(_remark), ''), occurred_at
  ) returning id into flow_id;

  perform public.record_audit_event(
    'sample.manage',
    'sample',
    sample_row.id::text,
    'FLOW',
    jsonb_build_object('status', sample_row.status),
    jsonb_build_object(
      'status', target_status,
      'flow_id', flow_id,
      'node', _node,
      'location', nullif(trim(_location), ''),
      'handover_to', _handover_to,
      'remark', nullif(trim(_remark), '')
    )
  );

  return jsonb_build_object(
    'id', flow_id,
    'sampleId', sample_row.id,
    'fromStatus', sample_row.status,
    'toStatus', target_status,
    'node', _node,
    'operatorId', operator_id,
    'location', nullif(trim(_location), ''),
    'handoverTo', _handover_to,
    'remark', nullif(trim(_remark), ''),
    'occurredAt', occurred_at
  );
end;
$$;

revoke execute on function public.transition_sample_flow(bigint, varchar, varchar, uuid, text) from public;
grant execute on function public.transition_sample_flow(bigint, varchar, varchar, uuid, text) to authenticated;
