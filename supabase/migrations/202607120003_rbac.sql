-- LIMS role-based access control
-- Implements: FR-AUTH-002~005, BR-001~004, NFR-SEC-001~002.

insert into public.sys_role (code, name, status)
values
  ('SYSTEM_ADMIN', '系统管理员', 'ACTIVE'),
  ('LAB_ADMIN', '实验室管理员', 'ACTIVE'),
  ('RESEARCHER', '实验人员', 'ACTIVE'),
  ('PROJECT_OWNER', '项目负责人/教师', 'ACTIVE')
on conflict (code) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

insert into public.sys_permission (code, name, resource, action)
values
  ('auth.user.manage', '用户管理', 'auth.user', 'manage'),
  ('auth.role.manage', '角色权限管理', 'auth.role', 'manage'),
  ('laboratory.read', '查看实验室', 'laboratory', 'read'),
  ('laboratory.manage', '管理实验室', 'laboratory', 'manage'),
  ('project.read', '查看科研项目', 'project', 'read'),
  ('project.manage', '管理科研项目', 'project', 'manage'),
  ('sample.read', '查看样品', 'sample', 'read'),
  ('sample.manage', '管理样品', 'sample', 'manage'),
  ('task.read', '查看实验任务', 'task', 'read'),
  ('task.manage', '执行和管理任务', 'task', 'manage'),
  ('task.assign', '分配实验任务', 'task', 'assign'),
  ('data.read', '查看实验数据', 'data', 'read'),
  ('data.manage', '录入和处理实验数据', 'data', 'manage'),
  ('review.read', '查看审核记录', 'review', 'read'),
  ('review.manage', '执行结果审核', 'review', 'manage'),
  ('report.read', '查看实验报告', 'report', 'read'),
  ('report.manage', '管理实验报告', 'report', 'manage'),
  ('report.publish', '发布实验报告', 'report', 'publish'),
  ('resource.read', '查看实验资源', 'resource', 'read'),
  ('resource.manage', '管理实验资源', 'resource', 'manage'),
  ('audit.read', '查看操作日志', 'audit', 'read'),
  ('settings.manage', '管理系统设置', 'settings', 'manage')
on conflict (code) do update
set name = excluded.name,
    resource = excluded.resource,
    action = excluded.action;

insert into public.sys_role_permission (role_id, permission_id)
select r.id, p.id
from public.sys_role r
cross join public.sys_permission p
where r.code = 'SYSTEM_ADMIN'
on conflict do nothing;

insert into public.sys_role_permission (role_id, permission_id)
select r.id, p.id
from public.sys_role r
join public.sys_permission p on p.code in (
  'laboratory.read', 'laboratory.manage',
  'project.read', 'project.manage',
  'sample.read', 'sample.manage',
  'task.read', 'task.manage', 'task.assign',
  'data.read', 'data.manage',
  'review.read', 'review.manage',
  'report.read', 'report.manage', 'report.publish',
  'resource.read', 'resource.manage',
  'audit.read', 'settings.manage'
)
where r.code = 'LAB_ADMIN'
on conflict do nothing;

insert into public.sys_role_permission (role_id, permission_id)
select r.id, p.id
from public.sys_role r
join public.sys_permission p on p.code in (
  'project.read',
  'sample.read', 'sample.manage',
  'task.read', 'task.manage',
  'data.read', 'data.manage',
  'report.read',
  'resource.read'
)
where r.code = 'RESEARCHER'
on conflict do nothing;

insert into public.sys_role_permission (role_id, permission_id)
select r.id, p.id
from public.sys_role r
join public.sys_permission p on p.code in (
  'project.read', 'project.manage',
  'sample.read',
  'task.read', 'task.manage', 'task.assign',
  'data.read',
  'review.read', 'review.manage',
  'report.read', 'report.publish'
)
where r.code = 'PROJECT_OWNER'
on conflict do nothing;

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
    join public.sys_role r on r.id = ur.role_id
    where ur.user_id = auth.uid()
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
    join public.sys_role r on r.id = ur.role_id
    join public.sys_role_permission rp on rp.role_id = r.id
    join public.sys_permission p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and r.status = 'ACTIVE'
      and p.code = _permission_code
  );
$$;

grant execute on function public.has_role(varchar) to authenticated;
grant execute on function public.has_permission(varchar) to authenticated;

create policy sys_user_admin_manage
on public.sys_user for all to authenticated
using (public.has_permission('auth.user.manage'))
with check (public.has_permission('auth.user.manage'));

create policy sys_role_admin_manage
on public.sys_role for all to authenticated
using (public.has_permission('auth.role.manage'))
with check (public.has_permission('auth.role.manage'));

create policy sys_permission_admin_read
on public.sys_permission for select to authenticated
using (public.has_permission('auth.role.manage'));

create policy sys_user_role_admin_manage
on public.sys_user_role for all to authenticated
using (public.has_permission('auth.role.manage'))
with check (public.has_permission('auth.role.manage'));

create policy sys_role_permission_admin_manage
on public.sys_role_permission for all to authenticated
using (public.has_permission('auth.role.manage'))
with check (public.has_permission('auth.role.manage'));

create policy laboratory_read_by_permission
on public.lab_laboratory for select to authenticated
using (public.has_permission('laboratory.read'));

create policy laboratory_manage_by_permission
on public.lab_laboratory for all to authenticated
using (public.has_permission('laboratory.manage'))
with check (public.has_permission('laboratory.manage'));

create policy department_read_by_permission
on public.lab_department for select to authenticated
using (public.has_permission('laboratory.read'));

create policy department_manage_by_permission
on public.lab_department for all to authenticated
using (public.has_permission('laboratory.manage'))
with check (public.has_permission('laboratory.manage'));

create policy project_read_by_permission
on public.research_project for select to authenticated
using (public.has_permission('project.read') or owner_id = auth.uid());

create policy project_manage_by_permission
on public.research_project for all to authenticated
using (public.has_permission('project.manage') or owner_id = auth.uid())
with check (public.has_permission('project.manage') or owner_id = auth.uid());

create policy sample_read_by_permission
on public.sample for select to authenticated
using (public.has_permission('sample.read'));

create policy sample_manage_by_permission
on public.sample for all to authenticated
using (public.has_permission('sample.manage'))
with check (public.has_permission('sample.manage'));

create policy task_read_by_permission
on public.experiment_task for select to authenticated
using (public.has_permission('task.read'));

create policy task_manage_by_permission
on public.experiment_task for all to authenticated
using (public.has_permission('task.manage'))
with check (public.has_permission('task.manage'));

create policy task_sample_read_by_permission
on public.task_sample for select to authenticated
using (public.has_permission('task.read'));

create policy task_sample_manage_by_permission
on public.task_sample for all to authenticated
using (public.has_permission('task.manage'))
with check (public.has_permission('task.manage'));

create policy task_assignee_read_by_permission
on public.task_assignee for select to authenticated
using (public.has_permission('task.read'));

create policy task_assignee_manage_by_permission
on public.task_assignee for all to authenticated
using (public.has_permission('task.assign'))
with check (public.has_permission('task.assign'));

create policy task_history_read_by_permission
on public.task_status_history for select to authenticated
using (public.has_permission('task.read'));

create policy data_read_by_permission
on public.experiment_data for select to authenticated
using (public.has_permission('data.read'));

create policy data_manage_by_permission
on public.experiment_data for all to authenticated
using (public.has_permission('data.manage'))
with check (public.has_permission('data.manage'));

create policy review_read_by_permission
on public.result_review for select to authenticated
using (public.has_permission('review.read'));

create policy review_manage_by_permission
on public.result_review for all to authenticated
using (public.has_permission('review.manage'))
with check (public.has_permission('review.manage'));

create policy report_read_by_permission
on public.experiment_report for select to authenticated
using (public.has_permission('report.read'));

create policy report_manage_by_permission
on public.experiment_report for insert to authenticated
with check (public.has_permission('report.manage'));

create policy report_update_by_permission
on public.experiment_report for update to authenticated
using (public.has_permission('report.manage') or public.has_permission('report.publish'))
with check (public.has_permission('report.manage') or public.has_permission('report.publish'));

create policy instrument_read_by_permission
on public.instrument for select to authenticated
using (public.has_permission('resource.read'));

create policy instrument_manage_by_permission
on public.instrument for all to authenticated
using (public.has_permission('resource.manage'))
with check (public.has_permission('resource.manage'));

create policy inventory_read_by_permission
on public.inventory_item for select to authenticated
using (public.has_permission('resource.read'));

create policy inventory_manage_by_permission
on public.inventory_item for all to authenticated
using (public.has_permission('resource.manage'))
with check (public.has_permission('resource.manage'));

create policy environment_read_by_permission
on public.environment_record for select to authenticated
using (public.has_permission('resource.read'));

create policy environment_manage_by_permission
on public.environment_record for insert to authenticated
with check (public.has_permission('resource.manage'));

create policy audit_read_by_permission
on public.audit_log for select to authenticated
using (public.has_permission('audit.read'));
