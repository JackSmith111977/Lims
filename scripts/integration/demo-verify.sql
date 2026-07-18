-- DEMO-LIMS-001 read-only verification.
-- Run only in the approved isolated Supabase project.
-- This query performs no writes and does not expose passwords or tokens.

select jsonb_build_object(
  'authDemoUsers', (
    select count(*)
    from auth.users
    where email like 'demo-%@example.invalid'
  ),
  'publicDemoUsers', (
    select count(*)
    from public.sys_user
    where email like 'demo-%@example.invalid'
  ),
  'publicDemoRows', (
    select count(*)
    from (
      select id from public.lab_laboratory where left(code, 5) = 'DEMO_'
      union all select id from public.lab_department where left(code, 5) = 'DEMO_'
      union all select id from public.lab_group where left(code, 5) = 'DEMO_'
      union all select id from public.sys_unit where left(code, 5) = 'DEMO_'
      union all select id from public.sys_parameter where left(code, 5) = 'DEMO_'
      union all select id from public.research_project where left(project_code, 5) = 'DEMO_'
      union all select id from public.sample where left(sample_code, 5) = 'DEMO_'
      union all select id from public.experiment_task where left(task_code, 5) = 'DEMO_'
      union all select id from public.experiment_method where left(method_code, 5) = 'DEMO_'
      union all select id from public.instrument where left(instrument_code, 5) = 'DEMO_'
      union all select id from public.inventory_item where left(item_code, 5) = 'DEMO_'
      union all select id from public.experiment_data where left(metric_name, 5) = 'DEMO_'
      union all select id from public.experiment_processing_rule where left(rule_code, 5) = 'DEMO_'
      union all select id from public.experiment_report where left(report_code, 5) = 'DEMO_'
    ) as residue
  ),
  'auditDemoRows', (
    select count(*)
    from public.audit_log
    where position('DEMO_' in coalesce(after_json::text, '')) > 0
       or position('DEMO_' in coalesce(before_json::text, '')) > 0
  )
) as demo_verification;
