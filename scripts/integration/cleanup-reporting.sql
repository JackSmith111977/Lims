do $$
declare
  user_ids uuid[];
  task_ids bigint[];
  sample_ids bigint[];
  project_ids bigint[];
  instrument_ids bigint[];
  method_ids bigint[];
  report_ids bigint[];
  role_ids bigint[];
begin
  select coalesce(array_agg(id), array[]::uuid[]) into user_ids
  from auth.users
  where email ~ '^report_[0-9]+_(manager|publisher|reader)@example[.]invalid$';

  select coalesce(array_agg(id), array[]::bigint[]) into task_ids
  from public.experiment_task where task_code like 'report_%';
  select coalesce(array_agg(id), array[]::bigint[]) into sample_ids
  from public.sample where sample_code like 'report_%';
  select coalesce(array_agg(id), array[]::bigint[]) into project_ids
  from public.research_project where project_code like 'report_%';
  select coalesce(array_agg(id), array[]::bigint[]) into instrument_ids
  from public.instrument where instrument_code like 'report_%';
  select coalesce(array_agg(id), array[]::bigint[]) into method_ids
  from public.experiment_method where method_code like 'report_%';
  select coalesce(array_agg(id), array[]::bigint[]) into report_ids
  from public.experiment_report where task_id = any(task_ids);
  select coalesce(array_agg(id), array[]::bigint[]) into role_ids
  from public.sys_role where code like 'REPORT_READER_%';

  delete from public.audit_log
  where operator_id = any(user_ids)
     or (object_type = 'experiment_report'
         and object_id = any(array(select report_id::varchar from unnest(report_ids) as report_id)));

  alter table public.experiment_report_history disable trigger user;
  alter table public.experiment_report disable trigger user;
  delete from public.experiment_report_history where report_id = any(report_ids);
  delete from public.experiment_report where id = any(report_ids);
  alter table public.experiment_report enable trigger user;
  alter table public.experiment_report_history enable trigger user;

  delete from public.task_assignee where task_id = any(task_ids);
  delete from public.task_status_history where task_id = any(task_ids);
  delete from public.task_sample where task_id = any(task_ids);
  alter table public.result_review disable trigger user;
  delete from public.result_review where task_id = any(task_ids);
  alter table public.result_review enable trigger user;
  delete from public.experiment_data where task_id = any(task_ids);
  delete from public.experiment_task where id = any(task_ids);
  delete from public.instrument_maintenance where instrument_id = any(instrument_ids);
  delete from public.instrument where id = any(instrument_ids);
  delete from public.sample_flow where sample_id = any(sample_ids);
  delete from public.sample where id = any(sample_ids);
  delete from public.research_project where id = any(project_ids);
  delete from public.experiment_method_history where method_id = any(method_ids);
  delete from public.experiment_method where id = any(method_ids);
  delete from public.sys_user_role where user_id = any(user_ids);
  delete from public.sys_role_permission where role_id = any(role_ids);
  delete from public.sys_role where id = any(role_ids);
  delete from public.sys_user where id = any(user_ids);
  delete from auth.users where id = any(user_ids);
end $$;
