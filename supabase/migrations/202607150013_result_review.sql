-- Implements FR-REVIEW-001~006, AC-REVIEW-001, BR-003/005 and NFR-SEC-002.
-- Review records are append-only and task status changes are atomic with review/audit writes.

alter table public.result_review
  drop constraint if exists result_review_non_approved_comment_check;
alter table public.result_review
  add constraint result_review_non_approved_comment_check
  check (result = 'APPROVED' or nullif(trim(comment), '') is not null)
  not valid;

alter table public.result_review enable row level security;
drop policy if exists review_read_by_permission on public.result_review;
drop policy if exists review_manage_by_permission on public.result_review;
create policy review_read_by_permission
on public.result_review for select to authenticated
using (public.has_permission('review.read'));

revoke all on table public.result_review from anon, authenticated;
grant select on table public.result_review to authenticated;

create or replace function public.guard_result_review_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Review records are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists result_review_immutable on public.result_review;
create trigger result_review_immutable
before update or delete on public.result_review
for each row execute function public.guard_result_review_immutable();

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
    'sample.manage', 'data.manage', 'review.manage'
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

create or replace function public.review_task_result(
  _task_id bigint,
  _result varchar,
  _comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_id uuid := auth.uid();
  task_row public.experiment_task%rowtype;
  review_row public.result_review%rowtype;
  target_status varchar(24);
  normalized_comment text := nullif(trim(_comment), '');
  reviewed_at timestamptz := now();
begin
  if operator_id is null
     or not exists (select 1 from public.sys_user where id = operator_id and status = 'ACTIVE')
     or not public.has_permission('review.manage') then
    raise exception 'Review permission denied' using errcode = '42501';
  end if;

  if _result not in ('APPROVED', 'RETURNED', 'NEED_MORE') then
    raise exception 'Invalid review result' using errcode = '22023';
  end if;

  if _result <> 'APPROVED' and normalized_comment is null then
    raise exception 'Review comment is required' using errcode = '22023';
  end if;

  select * into task_row
  from public.experiment_task
  where id = _task_id
  for update;
  if not found then
    raise exception 'Review task not found' using errcode = 'P0002';
  end if;

  if task_row.status <> 'PENDING_REVIEW' then
    raise exception 'Task is not pending review' using errcode = '55000';
  end if;

  target_status := case when _result = 'APPROVED' then 'APPROVED' else 'RETURNED' end;

  insert into public.result_review (
    task_id, reviewer_id, result, comment, reviewed_at
  ) values (
    task_row.id, operator_id, _result, normalized_comment, reviewed_at
  ) returning * into review_row;

  perform set_config('lims.task_transition', 'on', true);
  update public.experiment_task
  set status = target_status,
      updated_at = reviewed_at
  where id = task_row.id;

  insert into public.task_status_history (
    task_id, from_status, to_status, operator_id, remark, occurred_at
  ) values (
    task_row.id, task_row.status, target_status, operator_id, normalized_comment, reviewed_at
  );

  perform public.record_audit_event(
    'review.manage',
    'result_review',
    review_row.id::text,
    'REVIEW',
    jsonb_build_object('taskId', task_row.id, 'status', task_row.status),
    jsonb_build_object('taskId', task_row.id, 'result', review_row.result, 'targetStatus', target_status)
  );

  return jsonb_build_object(
    'review', jsonb_build_object(
      'id', review_row.id,
      'taskId', review_row.task_id,
      'reviewerId', review_row.reviewer_id,
      'result', review_row.result,
      'comment', review_row.comment,
      'reviewedAt', review_row.reviewed_at,
      'createdAt', review_row.created_at
    ),
    'task', jsonb_build_object(
      'id', task_row.id,
      'fromStatus', task_row.status,
      'toStatus', target_status,
      'operatorId', operator_id,
      'occurredAt', reviewed_at
    )
  );
end;
$$;

revoke all on function public.review_task_result(bigint, varchar, text) from public;
grant execute on function public.review_task_result(bigint, varchar, text) to authenticated;
