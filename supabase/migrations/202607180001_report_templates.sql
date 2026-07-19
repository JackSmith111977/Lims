-- Implements FR-SETTING-004 and captures the active report template in immutable report snapshots.

insert into public.sys_parameter (code, name, value_type, value_json, description, status)
values (
  'REPORT_TEMPLATE_DEFAULT',
  '默认报告模板',
  'JSON',
  '{"title":"实验结果报告","fields":["task","samples","data","reviews"]}'::jsonb,
  '报告生成时写入不可变快照的默认字段模板',
  'ACTIVE'
)
on conflict (code) do nothing;

create or replace function public.apply_report_template_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template jsonb;
begin
  select value_json into template
  from public.sys_parameter
  where code = 'REPORT_TEMPLATE_DEFAULT'
    and value_type = 'JSON'
    and status = 'ACTIVE';

  new.report_payload := jsonb_build_object('template', coalesce(template, '{}'::jsonb)) || coalesce(new.report_payload, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists experiment_report_template_snapshot on public.experiment_report;
create trigger experiment_report_template_snapshot
before insert on public.experiment_report
for each row execute function public.apply_report_template_snapshot();
