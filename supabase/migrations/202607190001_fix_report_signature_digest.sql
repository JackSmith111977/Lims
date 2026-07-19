-- Fixes the FR-REPORT-007 signing RPC without changing its public signature.
-- Supabase installs pgcrypto in the extensions schema; keep the SECURITY DEFINER
-- search path narrow and qualify the hash function explicitly.

create or replace function public.sign_report(_report_id bigint, _remark text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  report_row public.experiment_report%rowtype;
  signature_row public.experiment_report_signature%rowtype;
  snapshot_input text;
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('report.publish') then
    raise exception 'Report signature permission denied' using errcode = '42501';
  end if;

  select * into report_row
  from public.experiment_report
  where id = _report_id
  for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if report_row.status <> 'PUBLISHED' then
    raise exception 'Only published reports can be signed' using errcode = '55000';
  end if;
  if exists (select 1 from public.experiment_report_signature where report_id = report_row.id) then
    raise exception 'Report is already signed' using errcode = '23505';
  end if;

  snapshot_input := report_row.report_code || ':' || report_row.version_no::text || ':' || report_row.report_payload::text;
  insert into public.experiment_report_signature (
    report_id, signature_type, signature_hash, signed_by, signed_at, remark
  ) values (
    report_row.id,
    'ELECTRONIC_SHA256',
    encode(extensions.digest(convert_to(snapshot_input, 'UTF8'), 'sha256'::text), 'hex'),
    operator_id,
    now(),
    nullif(trim(_remark), '')
  ) returning * into signature_row;

  perform public.record_audit_event(
    'report.publish',
    'experiment_report_signature',
    signature_row.id::text,
    'SIGN',
    null,
    jsonb_build_object('reportId', signature_row.report_id, 'signatureType', signature_row.signature_type, 'signatureHash', signature_row.signature_hash)
  );

  return jsonb_build_object(
    'id', signature_row.id,
    'reportId', signature_row.report_id,
    'signatureType', signature_row.signature_type,
    'signatureHash', signature_row.signature_hash,
    'signedBy', signature_row.signed_by,
    'signedAt', signature_row.signed_at,
    'remark', signature_row.remark
  );
end;
$$;

revoke all on function public.sign_report(bigint, text) from public;
grant execute on function public.sign_report(bigint, text) to authenticated;
