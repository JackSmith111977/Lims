-- Prevent personnel resource permissions from changing authentication account status.
-- Implements: FR-AUTH-003, FR-PER-001, NFR-SEC-001.

create or replace function public.guard_sys_user_account_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and not public.has_permission('auth.user.manage') then
    raise exception 'account status requires auth.user.manage'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists sys_user_guard_account_status on public.sys_user;
create trigger sys_user_guard_account_status
before update on public.sys_user
for each row execute function public.guard_sys_user_account_status();
