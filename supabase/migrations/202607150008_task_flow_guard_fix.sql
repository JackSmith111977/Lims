-- Fixes the NULL semantics of current_setting in the T-205 direct status guard.
-- Without coalesce, an unset transaction-local flag makes the IF condition UNKNOWN.

create or replace function public.guard_task_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('lims.task_transition', true), 'off') <> 'on' then
    raise exception 'task status must use transition RPC' using errcode = '42501';
  end if;
  return new;
end;
$$;
