-- DEMO-LIMS-001 synthetic seed.
-- Run only in the approved isolated Supabase project.
-- Auth users are resolved by placeholder email; no password or token is stored here.

begin;

do $seed$
declare
  v_admin_id uuid;
  v_operator_id uuid;
  v_reviewer_id uuid;
  v_lab_id bigint;
  v_department_id bigint;
  v_group_id bigint;
  v_project_id bigint;
  v_method_id bigint;
  v_instrument_id bigint;
  v_inventory_id bigint;
  v_sample_id bigint;
  v_task_id bigint;
  v_pending_task_id bigint;
  v_raw_data_id bigint;
  v_processed_data_id bigint;
  v_pending_raw_data_id bigint;
  v_rule_id bigint;
  v_run_id bigint;
  v_review_id bigint;
  v_report_id bigint;
begin
  select id into v_admin_id from auth.users where email = 'demo-admin@example.invalid';
  select id into v_operator_id from auth.users where email = 'demo-operator@example.invalid';
  select id into v_reviewer_id from auth.users where email = 'demo-reviewer@example.invalid';

  if v_admin_id is null or v_operator_id is null or v_reviewer_id is null then
    raise exception 'Required demo auth users are missing';
  end if;

  insert into public.sys_user (id, username, real_name, email, status)
  values
    (v_admin_id, 'demo_admin', 'DEMO System Admin', 'demo-admin@example.invalid', 'ACTIVE'),
    (v_operator_id, 'demo_operator', 'DEMO Researcher', 'demo-operator@example.invalid', 'ACTIVE'),
    (v_reviewer_id, 'demo_reviewer', 'DEMO Project Owner', 'demo-reviewer@example.invalid', 'ACTIVE')
  on conflict (id) do update
    set username = excluded.username,
        real_name = excluded.real_name,
        email = excluded.email,
        status = excluded.status;

  insert into public.sys_user_role (user_id, role_id)
  select v_admin_id, id from public.sys_role where code = 'SYSTEM_ADMIN'
  on conflict do nothing;
  insert into public.sys_user_role (user_id, role_id)
  select v_operator_id, id from public.sys_role where code = 'RESEARCHER'
  on conflict do nothing;
  insert into public.sys_user_role (user_id, role_id)
  select v_reviewer_id, id from public.sys_role where code = 'PROJECT_OWNER'
  on conflict do nothing;

  insert into public.lab_laboratory (code, name, location, status)
  values ('DEMO_LAB_01', 'DEMO Research Laboratory', 'DEMO Campus - Building A', 'ACTIVE')
  on conflict (code) do update
    set name = excluded.name, location = excluded.location, status = excluded.status
  returning id into v_lab_id;

  insert into public.lab_department (laboratory_id, code, name, status)
  values (v_lab_id, 'DEMO_DEPT_01', 'DEMO Analytical Group', 'ACTIVE')
  on conflict (laboratory_id, code) do update
    set name = excluded.name, status = excluded.status
  returning id into v_department_id;

  update public.sys_user
  set department_id = v_department_id
  where id in (v_admin_id, v_operator_id, v_reviewer_id);
  update public.lab_laboratory
  set manager_id = v_admin_id
  where id = v_lab_id;

  insert into public.lab_group (laboratory_id, code, name, leader_id, status)
  values (v_lab_id, 'DEMO_GROUP_01', 'DEMO Stability Team', v_operator_id, 'ACTIVE')
  on conflict (laboratory_id, code) do update
    set name = excluded.name, leader_id = excluded.leader_id, status = excluded.status
  returning id into v_group_id;

  insert into public.sys_unit (code, name, symbol, dimension, status)
  values ('DEMO_MG_L', 'DEMO concentration', 'mg/L', 'CONCENTRATION', 'ACTIVE')
  on conflict (code) do update
    set name = excluded.name, symbol = excluded.symbol, dimension = excluded.dimension, status = excluded.status;

  insert into public.sys_parameter (code, name, value_type, value_json, description, status)
  values ('DEMO_DEFAULT_STORAGE', 'DEMO default storage condition', 'STRING', '"2-8 C"'::jsonb,
          'Synthetic demo parameter', 'ACTIVE')
  on conflict (code) do update
    set name = excluded.name, value_type = excluded.value_type, value_json = excluded.value_json,
        description = excluded.description, status = excluded.status;

  insert into public.research_project
    (project_code, name, owner_id, description, status, start_date, end_date)
  values
    ('DEMO_P_001', 'DEMO Standard Sample Stability Verification', v_reviewer_id,
     'Synthetic project for the LIMS end-to-end defense demonstration.', 'ACTIVE', current_date - 14, current_date + 30)
  on conflict (project_code) do update
    set name = excluded.name, owner_id = excluded.owner_id, description = excluded.description,
        status = excluded.status, start_date = excluded.start_date, end_date = excluded.end_date
  returning id into v_project_id;

  insert into public.experiment_method
    (method_code, name, version, scope, detection_limit, status, effective_at)
  values
    ('DEMO_M_001', 'DEMO HPLC Quantitation Method', '1.0', 'DEMO stability sample assay', 0.01000000,
     'ACTIVE', now() - interval '7 days')
  on conflict (method_code, version) do update
    set name = excluded.name, scope = excluded.scope, detection_limit = excluded.detection_limit,
        status = excluded.status, effective_at = excluded.effective_at
  returning id into v_method_id;

  if not exists (
    select 1 from public.experiment_method_history h
    where h.method_id = v_method_id and h.to_version = '1.0' and h.change_type = 'CREATE_VERSION'
  ) then
    insert into public.experiment_method_history
      (method_id, method_code, from_version, to_version, from_status, to_status, change_type, operator_id, remark)
    values
      (v_method_id, 'DEMO_M_001', null, '1.0', null, 'ACTIVE', 'CREATE_VERSION', v_admin_id, 'DEMO method baseline');
  end if;

  perform set_config('lims.instrument_write', 'on', true);
  insert into public.instrument
    (instrument_code, name, type, model, manufacturer, location, owner_id, status, commissioned_at, next_calibration_at)
  values
    ('DEMO_INST_001', 'DEMO Liquid Chromatograph', 'HPLC', 'DEMO-HPLC-01', 'DEMO Instruments Ltd.',
     'DEMO_ZONE_01', v_operator_id, 'ACTIVE', current_date - 120, current_date + 60)
  on conflict (instrument_code) do update
    set name = excluded.name, type = excluded.type, model = excluded.model,
        manufacturer = excluded.manufacturer, location = excluded.location, owner_id = excluded.owner_id,
        status = excluded.status, commissioned_at = excluded.commissioned_at,
        next_calibration_at = excluded.next_calibration_at
  returning id into v_instrument_id;

  if not exists (
    select 1 from public.instrument_maintenance m
    where m.instrument_id = v_instrument_id and m.maintenance_type = 'CALIBRATION'
      and m.occurred_on = current_date - 15
  ) then
    insert into public.instrument_maintenance
      (instrument_id, maintenance_type, occurred_on, operator_id, result, next_due_on, remark)
    values
      (v_instrument_id, 'CALIBRATION', current_date - 15, v_operator_id,
       'DEMO calibration passed', current_date + 60, 'DEMO maintenance record');
  end if;

  perform set_config('lims.inventory_write', 'on', true);
  insert into public.inventory_item
    (item_code, type, name, batch_no, manufacturer, quantity, unit, expiry_date,
     storage_condition, location, status, low_stock_threshold)
  values
    ('DEMO_REAGENT_001', 'REAGENT', 'DEMO Acetonitrile', 'DEMO_BATCH_001', 'DEMO Chemical Co.',
     0, 'mL', current_date + 180, '2-8 C', 'DEMO_CABINET_A01', 'ACTIVE', 5)
  on conflict (item_code) do update
    set type = excluded.type, name = excluded.name, batch_no = excluded.batch_no,
        manufacturer = excluded.manufacturer, unit = excluded.unit, expiry_date = excluded.expiry_date,
        storage_condition = excluded.storage_condition, location = excluded.location,
        status = excluded.status, low_stock_threshold = excluded.low_stock_threshold
  returning id into v_inventory_id;

  if not exists (
    select 1 from public.inventory_transaction t
    where t.item_id = v_inventory_id and t.transaction_type = 'INBOUND' and t.remark = 'DEMO initial stock'
  ) then
    insert into public.inventory_transaction (item_id, transaction_type, quantity, operator_id, remark)
    values (v_inventory_id, 'INBOUND', 20, v_admin_id, 'DEMO initial stock');
  end if;

  insert into public.sample
    (sample_code, project_id, name, specification, batch_no, quantity, unit, source,
     storage_condition, status, registered_at)
  values
    ('DEMO_S_001', v_project_id, 'DEMO Stability Test Sample', 'DEMO reference material',
     'DEMO_SAMPLE_BATCH_001', 10, 'mL', 'DEMO synthetic source', '2-8 C', 'REGISTERED', now() - interval '2 days')
  on conflict (sample_code) do update
    set project_id = excluded.project_id, name = excluded.name, specification = excluded.specification,
        batch_no = excluded.batch_no, quantity = excluded.quantity, unit = excluded.unit,
        source = excluded.source, storage_condition = excluded.storage_condition, status = excluded.status
  returning id into v_sample_id;

  perform set_config('lims.task_transition', 'on', true);
  insert into public.experiment_task
    (task_code, project_id, method_id, name, priority, status, planned_start, planned_end, remark)
  values
    ('DEMO_T_001', v_project_id, v_method_id, 'DEMO Sample Stability Assay', 'HIGH', 'DRAFT',
     current_date - 2, current_date + 3, 'DEMO primary end-to-end task')
  on conflict (task_code) do update
    set project_id = excluded.project_id, method_id = excluded.method_id, name = excluded.name,
        priority = excluded.priority, status = excluded.status, planned_start = excluded.planned_start,
        planned_end = excluded.planned_end, remark = excluded.remark
  returning id into v_task_id;

  insert into public.task_sample (task_id, sample_id)
  values (v_task_id, v_sample_id)
  on conflict do nothing;

  if not exists (
    select 1 from public.task_assignee ta
    where ta.task_id = v_task_id and ta.user_id = v_operator_id and ta.unassigned_at is null
  ) then
    insert into public.task_assignee (task_id, user_id, assigned_by)
    values (v_task_id, v_operator_id, v_admin_id);
  end if;

  if not exists (
    select 1 from public.task_group_assignee tga
    where tga.task_id = v_task_id and tga.group_id = v_group_id and tga.unassigned_at is null
  ) then
    insert into public.task_group_assignee (task_id, group_id, assigned_by)
    values (v_task_id, v_group_id, v_admin_id);
  end if;

  if not exists (
    select 1 from public.task_resource tr
    where tr.task_id = v_task_id and tr.resource_type = 'INSTRUMENT' and tr.resource_id = v_instrument_id
  ) then
    insert into public.task_resource (task_id, resource_type, resource_id)
    values (v_task_id, 'INSTRUMENT', v_instrument_id);
  end if;
  if not exists (
    select 1 from public.task_resource tr
    where tr.task_id = v_task_id and tr.resource_type = 'INVENTORY_ITEM' and tr.resource_id = v_inventory_id
  ) then
    insert into public.task_resource (task_id, resource_type, resource_id, quantity, unit)
    values (v_task_id, 'INVENTORY_ITEM', v_inventory_id, 2, 'mL');
  end if;

  if not exists (
    select 1 from public.sample_flow sf
    where sf.sample_id = v_sample_id and sf.node = 'TRANSFER' and sf.remark = 'DEMO sample handover'
  ) then
    insert into public.sample_flow
      (sample_id, from_status, to_status, node, operator_id, location, handover_to, remark, occurred_at)
    values
      (v_sample_id, 'REGISTERED', 'REGISTERED', 'TRANSFER', v_operator_id, 'DEMO_ZONE_01', v_operator_id,
       'DEMO sample handover', now() - interval '1 day');
  end if;

  update public.experiment_task set status = 'ASSIGNED', updated_at = now() - interval '1 day' where id = v_task_id;
  update public.experiment_task set status = 'IN_PROGRESS', updated_at = now() - interval '20 hours' where id = v_task_id;
  update public.experiment_task set status = 'PENDING_REVIEW', updated_at = now() - interval '16 hours' where id = v_task_id;

  insert into public.task_status_history (task_id, from_status, to_status, operator_id, remark, occurred_at)
  values
    (v_task_id, 'DRAFT', 'ASSIGNED', v_admin_id, 'DEMO task assigned', now() - interval '1 day'),
    (v_task_id, 'ASSIGNED', 'IN_PROGRESS', v_operator_id, 'DEMO assay started', now() - interval '20 hours'),
    (v_task_id, 'IN_PROGRESS', 'PENDING_REVIEW', v_operator_id, 'DEMO data ready for review', now() - interval '16 hours');

  insert into public.experiment_data
    (task_id, sample_id, instrument_id, data_type, metric_name, raw_value, processed_value,
     unit, source_type, collected_at, recorded_by, remark)
  values
    (v_task_id, v_sample_id, v_instrument_id, 'RAW', 'DEMO_MAIN_PEAK_AREA', 98.76543210, null,
     'mg/L', 'INSTRUMENT', now() - interval '15 hours', v_operator_id, 'DEMO raw instrument reading')
  returning id into v_raw_data_id;

  select id into v_rule_id
  from public.experiment_processing_rule
  where rule_code = 'DEMO_RULE_ROUND_001' and version = '1.0';

  if v_rule_id is null then
    insert into public.experiment_processing_rule
      (rule_code, name, version, rule_type, config, status, created_by)
    values
      ('DEMO_RULE_ROUND_001', 'DEMO rounding rule', '1.0', 'ROUND',
       '{"scale":2,"roundingMode":"HALF_UP"}'::jsonb, 'ACTIVE', v_operator_id)
    returning id into v_rule_id;
  end if;

  insert into public.experiment_processing_run
    (task_id, rule_id, execution_mode, status, decision, explanation, executed_by, executed_at)
  values
    (v_task_id, v_rule_id, 'SIMULATED', 'RUNNING', null, null, v_operator_id, now() - interval '14 hours')
  returning id into v_run_id;

  insert into public.experiment_data
    (task_id, sample_id, instrument_id, data_type, metric_name, raw_value, processed_value,
     unit, source_type, collected_at, recorded_by, remark)
  values
    (v_task_id, v_sample_id, v_instrument_id, 'PROCESSED', 'DEMO_MAIN_PEAK_AREA', null, 98.77,
     'mg/L', 'API', now() - interval '14 hours', v_operator_id, 'DEMO rounded processing output')
  returning id into v_processed_data_id;

  insert into public.experiment_data_lineage (run_id, source_data_id, output_data_id)
  values (v_run_id, v_raw_data_id, v_processed_data_id);

  update public.experiment_processing_run
  set status = 'SUCCEEDED', output_data_id = v_processed_data_id, decision = 'PASS',
      explanation = 'DEMO round to two decimals'
  where id = v_run_id;

  insert into public.result_review
    (task_id, reviewer_id, result, comment, reviewed_at)
  values
    (v_task_id, v_reviewer_id, 'APPROVED', 'DEMO review passed: raw value and processing lineage verified',
     now() - interval '10 hours');

  select id into v_review_id
  from public.result_review
  where task_id = v_task_id and reviewer_id = v_reviewer_id and result = 'APPROVED'
  order by id desc
  limit 1;

  update public.experiment_task set status = 'APPROVED', updated_at = now() - interval '9 hours' where id = v_task_id;
  update public.sample set status = 'PROCESSED', updated_at = now() - interval '13 hours' where id = v_sample_id;

  insert into public.sample_flow
    (sample_id, from_status, to_status, node, operator_id, location, handover_to, remark, occurred_at)
  values
    (v_sample_id, 'REGISTERED', 'PROCESSING', 'PROCESS', v_operator_id, 'DEMO_ZONE_01', null,
     'DEMO processing started', now() - interval '13 hours'),
    (v_sample_id, 'PROCESSING', 'PROCESSED', 'PROCESS', v_operator_id, 'DEMO_ZONE_01', null,
     'DEMO processing completed', now() - interval '12 hours');

  if not exists (
    select 1 from public.inventory_transaction t
    where t.item_id = v_inventory_id and t.transaction_type = 'OUTBOUND'
      and t.task_id = v_task_id and t.remark = 'DEMO task consumption'
  ) then
    insert into public.inventory_transaction
      (item_id, task_id, transaction_type, quantity, operator_id, remark)
    values (v_inventory_id, v_task_id, 'OUTBOUND', 2, v_operator_id, 'DEMO task consumption');
  end if;
  update public.inventory_item set quantity = 18, status = 'ACTIVE' where id = v_inventory_id;

  insert into public.experiment_report
    (report_code, task_id, version_no, status, report_payload, generated_by, generated_at, published_at)
  values
    ('DEMO_RPT_001', v_task_id, 1, 'PUBLISHED',
     jsonb_build_object(
       'task', jsonb_build_object(
         'id', v_task_id, 'taskCode', 'DEMO_T_001', 'projectId', v_project_id,
         'methodId', v_method_id, 'name', 'DEMO Sample Stability Assay',
         'priority', 'HIGH', 'status', 'APPROVED', 'remark', 'DEMO primary end-to-end task'
       ),
       'samples', jsonb_build_array(jsonb_build_object(
         'id', v_sample_id, 'sampleCode', 'DEMO_S_001', 'name', 'DEMO Stability Test Sample',
         'specification', 'DEMO reference material', 'batchNo', 'DEMO_SAMPLE_BATCH_001',
         'quantity', 10, 'unit', 'mL', 'status', 'PROCESSED'
       )),
       'data', jsonb_build_array(
         jsonb_build_object(
           'id', v_raw_data_id, 'sampleId', v_sample_id, 'instrumentId', v_instrument_id,
           'dataType', 'RAW', 'metricName', 'DEMO_MAIN_PEAK_AREA', 'rawValue', 98.76543210,
           'processedValue', null, 'unit', 'mg/L', 'sourceType', 'INSTRUMENT',
           'collectedAt', now() - interval '15 hours', 'recordedBy', v_operator_id,
           'remark', 'DEMO raw instrument reading'
         ),
         jsonb_build_object(
           'id', v_processed_data_id, 'sampleId', v_sample_id, 'instrumentId', v_instrument_id,
           'dataType', 'PROCESSED', 'metricName', 'DEMO_MAIN_PEAK_AREA', 'rawValue', null,
           'processedValue', 98.77, 'unit', 'mg/L', 'sourceType', 'API',
           'collectedAt', now() - interval '14 hours', 'recordedBy', v_operator_id,
           'remark', 'DEMO rounded processing output'
         )
       ),
       'reviews', jsonb_build_array(jsonb_build_object(
         'id', v_review_id, 'reviewerId', v_reviewer_id, 'result', 'APPROVED',
         'comment', 'DEMO review passed: raw value and processing lineage verified',
         'reviewedAt', now() - interval '10 hours', 'createdAt', now() - interval '10 hours'
       ))
     ),
     v_reviewer_id, now() - interval '8 hours', now() - interval '7 hours')
  returning id into v_report_id;

  insert into public.experiment_report_history
    (report_id, from_status, to_status, operator_id, remark, occurred_at)
  values
    (v_report_id, null, 'DRAFT', v_admin_id, 'DEMO report generated', now() - interval '8 hours'),
    (v_report_id, 'DRAFT', 'REVIEW', v_reviewer_id, 'DEMO report submitted', now() - interval '7 hours'),
    (v_report_id, 'REVIEW', 'PUBLISHED', v_reviewer_id, 'DEMO report published', now() - interval '7 hours');

  perform set_config('lims.environment_write', 'on', true);
  insert into public.environment_threshold
    (laboratory_id, metric, unit, threshold_min, threshold_max, status)
  values (v_lab_id, 'TEMPERATURE', 'C', 18, 26, 'ACTIVE')
  on conflict (laboratory_id, metric, unit) do update
    set threshold_min = excluded.threshold_min, threshold_max = excluded.threshold_max, status = excluded.status;

  insert into public.environment_record
    (laboratory_id, metric, value, unit, threshold_min, threshold_max, collected_at, source_type, recorded_by, status)
  values
    (v_lab_id, 'TEMPERATURE', 22.4, 'C', 18, 26, now() - interval '6 hours', 'SENSOR', v_operator_id, 'NORMAL');

  insert into public.experiment_task
    (task_code, project_id, method_id, name, priority, status, planned_start, planned_end, remark)
  values
    ('DEMO_T_002', v_project_id, v_method_id, 'DEMO Secondary Review Task', 'NORMAL', 'DRAFT',
     current_date - 1, current_date + 5, 'DEMO pending review branch')
  on conflict (task_code) do update
    set project_id = excluded.project_id, method_id = excluded.method_id, name = excluded.name,
        priority = excluded.priority, status = excluded.status, planned_start = excluded.planned_start,
        planned_end = excluded.planned_end, remark = excluded.remark
  returning id into v_pending_task_id;

  insert into public.task_sample (task_id, sample_id)
  values (v_pending_task_id, v_sample_id)
  on conflict do nothing;

  if not exists (
    select 1 from public.task_assignee ta
    where ta.task_id = v_pending_task_id and ta.user_id = v_operator_id and ta.unassigned_at is null
  ) then
    insert into public.task_assignee (task_id, user_id, assigned_by)
    values (v_pending_task_id, v_operator_id, v_admin_id);
  end if;

  update public.experiment_task set status = 'ASSIGNED' where id = v_pending_task_id;
  update public.experiment_task set status = 'IN_PROGRESS' where id = v_pending_task_id;
  update public.experiment_task set status = 'PENDING_REVIEW' where id = v_pending_task_id;

  insert into public.task_status_history (task_id, from_status, to_status, operator_id, remark)
  values
    (v_pending_task_id, 'DRAFT', 'ASSIGNED', v_admin_id, 'DEMO secondary task assigned'),
    (v_pending_task_id, 'ASSIGNED', 'IN_PROGRESS', v_operator_id, 'DEMO secondary task started'),
    (v_pending_task_id, 'IN_PROGRESS', 'PENDING_REVIEW', v_operator_id, 'DEMO secondary task awaiting review');

  insert into public.experiment_data
    (task_id, sample_id, instrument_id, data_type, metric_name, raw_value, processed_value,
     unit, source_type, collected_at, recorded_by, remark)
  values
    (v_pending_task_id, v_sample_id, v_instrument_id, 'RAW', 'DEMO_SECONDARY_PEAK_AREA', 12.34000000, null,
     'mg/L', 'MANUAL', now() - interval '4 hours', v_operator_id, 'DEMO secondary raw reading')
  returning id into v_pending_raw_data_id;

  insert into public.task_resource (task_id, resource_type, resource_id)
  select v_pending_task_id, 'INSTRUMENT', v_instrument_id
  where not exists (
    select 1 from public.task_resource tr
    where tr.task_id = v_pending_task_id and tr.resource_type = 'INSTRUMENT' and tr.resource_id = v_instrument_id
  );

  insert into public.audit_log (operator_id, object_type, object_id, action, before_json, after_json, occurred_at)
  values
    (v_admin_id, 'research_project', v_project_id::text, 'CREATE', null, jsonb_build_object('code', 'DEMO_P_001'), now() - interval '8 hours'),
    (v_admin_id, 'experiment_method', v_method_id::text, 'CREATE', null, jsonb_build_object('code', 'DEMO_M_001', 'version', '1.0'), now() - interval '8 hours'),
    (v_admin_id, 'instrument', v_instrument_id::text, 'CREATE', null, jsonb_build_object('code', 'DEMO_INST_001'), now() - interval '7 hours'),
    (v_admin_id, 'inventory_item', v_inventory_id::text, 'STOCK_UPDATE', null, jsonb_build_object('code', 'DEMO_REAGENT_001', 'quantity', 18), now() - interval '6 hours'),
    (v_operator_id, 'experiment_data', v_raw_data_id::text, 'CREATE', null, jsonb_build_object('code', 'DEMO_RAW_001'), now() - interval '15 hours'),
    (v_operator_id, 'experiment_processing_run', v_run_id::text, 'EXECUTE', null, jsonb_build_object('status', 'SUCCEEDED', 'outputDataId', v_processed_data_id), now() - interval '14 hours'),
    (v_reviewer_id, 'result_review', v_task_id::text, 'REVIEW', jsonb_build_object('status', 'PENDING_REVIEW'), jsonb_build_object('result', 'APPROVED'), now() - interval '10 hours'),
    (v_reviewer_id, 'experiment_report', v_report_id::text, 'PUBLISH', jsonb_build_object('status', 'REVIEW'), jsonb_build_object('status', 'PUBLISHED'), now() - interval '7 hours');
end;
$seed$;

commit;
