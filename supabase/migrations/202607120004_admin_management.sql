-- User and role management support
-- Implements: FR-AUTH-003~006, FR-AUTH-005, NFR-SEC-001~002.

create or replace function public.has_role(_role_code varchar)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sys_user_role ur
    join public.sys_user u on u.id = ur.user_id
    join public.sys_role r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and u.status = 'ACTIVE'
      and r.code = _role_code
      and r.status = 'ACTIVE'
  );
$$;

create or replace function public.has_permission(_permission_code varchar)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sys_user_role ur
    join public.sys_user u on u.id = ur.user_id
    join public.sys_role r on r.id = ur.role_id
    join public.sys_role_permission rp on rp.role_id = r.id
    join public.sys_permission p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and u.status = 'ACTIVE'
      and r.status = 'ACTIVE'
      and p.code = _permission_code
  );
$$;

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
  if _required_permission not in ('auth.user.manage', 'auth.role.manage') then
    raise exception 'Unsupported audit permission' using errcode = '22023';
  end if;

  if not public.has_permission(_required_permission) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.audit_log (
    operator_id,
    object_type,
    object_id,
    action,
    before_json,
    after_json
  )
  values (
    auth.uid(),
    _object_type,
    _object_id,
    _action,
    _before_json,
    _after_json
  );
end;
$$;

create or replace function public.set_user_roles(
  _target_user_id uuid,
  _role_codes varchar[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_roles jsonb;
  after_roles jsonb;
  requested_count integer;
  supplied_count integer;
begin
  if not public.has_permission('auth.role.manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.sys_user where id = _target_user_id) then
    raise exception 'User does not exist' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', r.code) order by r.code), '[]'::jsonb)
  into before_roles
  from public.sys_user_role ur
  join public.sys_role r on r.id = ur.role_id
  where ur.user_id = _target_user_id;

  select count(*)
  into requested_count
  from public.sys_role
  where code = any(coalesce(_role_codes, array[]::varchar[]));

  select cardinality(array(select distinct unnest(coalesce(_role_codes, array[]::varchar[]))))
  into supplied_count;

  if requested_count <> coalesce(supplied_count, 0) then
    raise exception 'Unknown role code' using errcode = '22023';
  end if;

  if _target_user_id = auth.uid()
     and not ('SYSTEM_ADMIN' = any(coalesce(_role_codes, array[]::varchar[]))) then
    raise exception 'Cannot remove the current administrator role' using errcode = '42501';
  end if;

  delete from public.sys_user_role
  where user_id = _target_user_id;

  insert into public.sys_user_role (user_id, role_id)
  select _target_user_id, r.id
  from public.sys_role r
  where r.code = any(coalesce(_role_codes, array[]::varchar[]));

  select coalesce(jsonb_agg(jsonb_build_object('code', r.code) order by r.code), '[]'::jsonb)
  into after_roles
  from public.sys_user_role ur
  join public.sys_role r on r.id = ur.role_id
  where ur.user_id = _target_user_id;

  insert into public.audit_log (
    operator_id, object_type, object_id, action, before_json, after_json
  )
  values (
    auth.uid(), 'sys_user', _target_user_id::text, 'ROLE_UPDATE', before_roles, after_roles
  );
end;
$$;

create or replace function public.set_role_permissions(
  _role_id bigint,
  _permission_codes varchar[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  role_code varchar;
  before_permissions jsonb;
  after_permissions jsonb;
  requested_count integer;
  supplied_count integer;
begin
  if not public.has_permission('auth.role.manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  select code into role_code from public.sys_role where id = _role_id;
  if role_code is null then
    raise exception 'Role does not exist' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', p.code) order by p.code), '[]'::jsonb)
  into before_permissions
  from public.sys_role_permission rp
  join public.sys_permission p on p.id = rp.permission_id
  where rp.role_id = _role_id;

  select count(*)
  into requested_count
  from public.sys_permission
  where code = any(coalesce(_permission_codes, array[]::varchar[]));

  select cardinality(array(select distinct unnest(coalesce(_permission_codes, array[]::varchar[]))))
  into supplied_count;

  if requested_count <> coalesce(supplied_count, 0) then
    raise exception 'Unknown permission code' using errcode = '22023';
  end if;

  if role_code = 'SYSTEM_ADMIN'
     and not ('auth.role.manage' = any(coalesce(_permission_codes, array[]::varchar[]))) then
    raise exception 'Cannot remove role management permission from SYSTEM_ADMIN' using errcode = '42501';
  end if;

  delete from public.sys_role_permission where role_id = _role_id;

  insert into public.sys_role_permission (role_id, permission_id)
  select _role_id, p.id
  from public.sys_permission p
  where p.code = any(coalesce(_permission_codes, array[]::varchar[]));

  select coalesce(jsonb_agg(jsonb_build_object('code', p.code) order by p.code), '[]'::jsonb)
  into after_permissions
  from public.sys_role_permission rp
  join public.sys_permission p on p.id = rp.permission_id
  where rp.role_id = _role_id;

  insert into public.audit_log (
    operator_id, object_type, object_id, action, before_json, after_json
  )
  values (
    auth.uid(), 'sys_role', _role_id::text, 'PERMISSION_UPDATE', before_permissions, after_permissions
  );
end;
$$;

grant execute on function public.record_audit_event(varchar, varchar, varchar, varchar, jsonb, jsonb) to authenticated;
grant execute on function public.set_user_roles(uuid, varchar[]) to authenticated;
grant execute on function public.set_role_permissions(bigint, varchar[]) to authenticated;
