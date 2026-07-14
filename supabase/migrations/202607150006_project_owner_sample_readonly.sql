-- Implements: FR-SAMPLE-004~006 and the project-owner read-only boundary.
-- PROJECT_OWNER supervises samples but does not register or mutate them.

delete from public.sys_role_permission
where role_id = (select id from public.sys_role where code = 'PROJECT_OWNER')
  and permission_id = (select id from public.sys_permission where code = 'sample.manage');
