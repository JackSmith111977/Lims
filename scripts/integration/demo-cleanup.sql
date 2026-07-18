-- DEMO-LIMS-001 public-data cleanup.
-- Run only in the approved isolated Supabase project.
-- This script removes DEMO_ public data but deliberately does not touch auth.users.
-- Delete the placeholder Auth users through Dashboard Auth Users or a supported Auth API.

begin;

do $cleanup$
declare
  v_user_ids uuid[];
  v_lab_ids bigint[];
  v_department_ids bigint[];
  v_group_ids bigint[];
  v_project_ids bigint[];
  v_sample_ids bigint[];
  v_task_ids bigint[];
  v_method_ids bigint[];
  v_instrument_ids bigint[];
  v_inventory_ids bigint[];
  v_data_ids bigint[];
  v_processing_rule_ids bigint[];
  v_processing_run_ids bigint[];
  v_report_ids bigint[];
begin
  select coalesce(array_agg(id), '{}'::uuid[]) into v_user_ids
  from public.sys_user where email like 'demo-%@example.invalid';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_lab_ids
  from public.lab_laboratory where left(code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_department_ids
  from public.lab_department where left(code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_group_ids
  from public.lab_group where left(code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_project_ids
  from public.research_project where left(project_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_sample_ids
  from public.sample where left(sample_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_task_ids
  from public.experiment_task where left(task_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_method_ids
  from public.experiment_method where left(method_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_instrument_ids
  from public.instrument where left(instrument_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_inventory_ids
  from public.inventory_item where left(item_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_data_ids
  from public.experiment_data
  where task_id = any(v_task_ids) or left(metric_name, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_processing_rule_ids
  from public.experiment_processing_rule where left(rule_code, 5) = 'DEMO_';
  select coalesce(array_agg(id), '{}'::bigint[]) into v_processing_run_ids
  from public.experiment_processing_run
  where task_id = any(v_task_ids) or rule_id = any(v_processing_rule_ids);
  select coalesce(array_agg(id), '{}'::bigint[]) into v_report_ids
  from public.experiment_report
  where task_id = any(v_task_ids) or left(report_code, 5) = 'DEMO_';

  delete from public.audit_log
  where operator_id = any(v_user_ids)
     or position('DEMO_' in coalesce(after_json::text, '')) > 0
     or position('DEMO_' in coalesce(before_json::text, '')) > 0;
  delete from public.attachment
  where uploaded_by = any(v_user_ids) or left(object_id, 5) = 'DEMO_';

  -- These records are immutable during normal operation. Cleanup is an explicit
  -- test-only database-owner operation, so disable only relevant user triggers.
  alter table public.experiment_report_history disable trigger user;
  alter table public.experiment_report disable trigger user;
  delete from public.experiment_report_history where report_id = any(v_report_ids);
  delete from public.experiment_report where id = any(v_report_ids);
  alter table public.experiment_report enable trigger user;
  alter table public.experiment_report_history enable trigger user;

  alter table public.experiment_data_lineage disable trigger user;
  alter table public.experiment_processing_run disable trigger user;
  delete from public.experiment_data_lineage
  where run_id = any(v_processing_run_ids)
     or source_data_id = any(v_data_ids)
     or output_data_id = any(v_data_ids);
  delete from public.experiment_processing_run where id = any(v_processing_run_ids);
  alter table public.experiment_processing_run enable trigger user;
  alter table public.experiment_data_lineage enable trigger user;

  alter table public.experiment_processing_rule disable trigger user;
  delete from public.experiment_processing_rule where id = any(v_processing_rule_ids);
  alter table public.experiment_processing_rule enable trigger user;

  alter table public.result_review disable trigger user;
  delete from public.result_review where task_id = any(v_task_ids);
  alter table public.result_review enable trigger user;

  delete from public.inventory_transaction
  where item_id = any(v_inventory_ids) or task_id = any(v_task_ids);
  delete from public.task_resource where task_id = any(v_task_ids);
  delete from public.task_group_assignee where task_id = any(v_task_ids);
  delete from public.task_assignee where task_id = any(v_task_ids);
  delete from public.task_status_history where task_id = any(v_task_ids);
  delete from public.task_sample where task_id = any(v_task_ids);
  delete from public.experiment_data
  where id = any(v_data_ids) or task_id = any(v_task_ids);
  delete from public.experiment_task where id = any(v_task_ids);

  alter table public.instrument_maintenance disable trigger user;
  delete from public.instrument_maintenance where instrument_id = any(v_instrument_ids);
  alter table public.instrument_maintenance enable trigger user;
  alter table public.instrument disable trigger user;
  delete from public.instrument where id = any(v_instrument_ids);
  alter table public.instrument enable trigger user;

  delete from public.sample_flow
  where sample_id = any(v_sample_ids)
     or operator_id = any(v_user_ids)
     or handover_to = any(v_user_ids);
  delete from public.sample where id = any(v_sample_ids);
  delete from public.research_project where id = any(v_project_ids);

  alter table public.environment_record disable trigger user;
  delete from public.environment_record
  where laboratory_id = any(v_lab_ids) or recorded_by = any(v_user_ids);
  alter table public.environment_record enable trigger user;
  alter table public.environment_threshold disable trigger user;
  delete from public.environment_threshold where laboratory_id = any(v_lab_ids);
  alter table public.environment_threshold enable trigger user;

  delete from public.experiment_method_history
  where method_id = any(v_method_ids) or operator_id = any(v_user_ids);
  delete from public.experiment_method where id = any(v_method_ids);
  delete from public.lab_group where id = any(v_group_ids);
  update public.sys_user set department_id = null where id = any(v_user_ids);
  delete from public.lab_department where id = any(v_department_ids);
  delete from public.lab_laboratory where id = any(v_lab_ids);
  delete from public.sys_user_role where user_id = any(v_user_ids);
  delete from public.sys_user where id = any(v_user_ids);
end;
$cleanup$;

commit;

-- Auth users remain until removed through the supported Auth UI/API.
select jsonb_build_object(
  'publicDemoRows', (
    select count(*) from (
      select id from public.lab_laboratory where left(code, 5) = 'DEMO_'
      union all select id from public.research_project where left(project_code, 5) = 'DEMO_'
      union all select id from public.sample where left(sample_code, 5) = 'DEMO_'
      union all select id from public.experiment_task where left(task_code, 5) = 'DEMO_'
      union all select id from public.experiment_method where left(method_code, 5) = 'DEMO_'
      union all select id from public.instrument where left(instrument_code, 5) = 'DEMO_'
      union all select id from public.inventory_item where left(item_code, 5) = 'DEMO_'
      union all select id from public.experiment_data where left(metric_name, 5) = 'DEMO_'
      union all select id from public.experiment_report where left(report_code, 5) = 'DEMO_'
    ) as residue
  ),
  'authDemoUsers', (select count(*) from auth.users where email like 'demo-%@example.invalid')
) as cleanup_verification;
