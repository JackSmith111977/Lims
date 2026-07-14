do $$
declare
  user_ids uuid[];
  task_ids bigint[];
  sample_ids bigint[];
  project_ids bigint[];
  instrument_ids bigint[];
  method_ids bigint[];
  processing_run_ids bigint[];
  data_ids bigint[];
begin
  select coalesce(array_agg(id), array[]::uuid[]) into user_ids
  from auth.users
  where email ~ '^processing_[0-9]+_(admin|reader)@example[.]invalid$';

  select coalesce(array_agg(id), array[]::bigint[]) into task_ids
  from public.experiment_task where task_code like 'processing_%';
  select coalesce(array_agg(id), array[]::bigint[]) into sample_ids
  from public.sample where sample_code like 'processing_%';
  select coalesce(array_agg(id), array[]::bigint[]) into project_ids
  from public.research_project where project_code like 'processing_%';
  select coalesce(array_agg(id), array[]::bigint[]) into instrument_ids
  from public.instrument where instrument_code like 'processing_%';
  select coalesce(array_agg(id), array[]::bigint[]) into method_ids
  from public.experiment_method where method_code like 'processing_%';
  select coalesce(array_agg(id), array[]::bigint[]) into processing_run_ids
  from public.experiment_processing_run where task_id = any(task_ids);
  select coalesce(array_agg(id), array[]::bigint[]) into data_ids
  from public.experiment_data where task_id = any(task_ids);

  delete from public.audit_log
  where operator_id = any(user_ids)
     or (object_type = 'experiment_processing_run'
         and object_id = any(array(select run_id::varchar from unnest(processing_run_ids) as run_id)));

  -- Processing runs and lineage are intentionally immutable in production.
  -- This test-only cleanup runs as the database owner through `supabase db query`.
  alter table public.experiment_data_lineage disable trigger user;
  alter table public.experiment_processing_run disable trigger user;
  delete from public.experiment_data_lineage where run_id = any(processing_run_ids);
  delete from public.experiment_processing_run where id = any(processing_run_ids);
  alter table public.experiment_processing_run enable trigger user;
  alter table public.experiment_data_lineage enable trigger user;

  delete from public.experiment_data where id = any(data_ids);
  delete from public.task_assignee where task_id = any(task_ids);
  delete from public.task_status_history where task_id = any(task_ids);
  delete from public.task_sample where task_id = any(task_ids);
  delete from public.result_review where task_id = any(task_ids);
  delete from public.experiment_task where id = any(task_ids);
  delete from public.instrument_maintenance where instrument_id = any(instrument_ids);
  delete from public.instrument where id = any(instrument_ids);
  delete from public.sample_flow where sample_id = any(sample_ids);
  delete from public.sample where id = any(sample_ids);
  delete from public.research_project where id = any(project_ids);
  delete from public.experiment_method_history where method_id = any(method_ids);
  delete from public.experiment_method where id = any(method_ids);
  delete from public.sys_user_role where user_id = any(user_ids);
  delete from public.sys_user where id = any(user_ids);
  delete from auth.users where id = any(user_ids);
end $$;
