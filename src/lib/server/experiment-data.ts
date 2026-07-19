import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminApiError,
  optionalText,
  recordAudit,
  requireId,
  requireObject,
  requireText,
} from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

export const EXPERIMENT_DATA_FIELDS = "id, task_id, sample_id, instrument_id, data_type, metric_name, raw_value, processed_value, unit, source_type, collected_at, recorded_by, remark, created_at";

const DATA_TYPES = ["RAW", "PROCESSED", "RESULT"] as const;
const SOURCE_TYPES = ["MANUAL", "FILE", "INSTRUMENT", "API"] as const;

type DataType = (typeof DATA_TYPES)[number];
type SourceType = (typeof SOURCE_TYPES)[number];
type DataRow = Database["public"]["Tables"]["experiment_data"]["Row"];
type TaskRow = Database["public"]["Tables"]["experiment_task"]["Row"];
type SampleRow = Database["public"]["Tables"]["sample"]["Row"];
type InstrumentRow = Database["public"]["Tables"]["instrument"]["Row"];

type MethodSummary = {
  id: number;
  methodCode: string;
  name: string;
  version: string;
  status: string;
};

type SampleSummary = {
  id: number;
  sampleCode: string;
  name: string;
  status: string;
};

type InstrumentSummary = {
  id: number;
  instrumentCode: string;
  name: string;
  status: string;
};

export type ExperimentDataView = {
  id: number;
  taskId: number;
  sampleId: number;
  instrumentId: number | null;
  dataType: DataType;
  metricName: string;
  rawValue: number | null;
  processedValue: number | null;
  unit: string | null;
  sourceType: SourceType;
  collectedAt: string;
  recordedBy: string;
  recordedAt: string;
  method: MethodSummary | null;
  sample: SampleSummary | null;
  instrument: InstrumentSummary | null;
  remark: string | null;
};

function parseDataType(value: unknown): DataType {
  const dataType = String(value ?? "").toUpperCase();
  if (!DATA_TYPES.includes(dataType as DataType)) {
    throw new AdminApiError(400, "INVALID_DATA_TYPE", "实验数据类型不受支持。");
  }
  return dataType as DataType;
}

function parseSourceType(value: unknown): SourceType {
  const sourceType = String(value ?? "").toUpperCase();
  if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
    throw new AdminApiError(400, "INVALID_SOURCE_TYPE", "实验数据来源不受支持。");
  }
  return sourceType as SourceType;
}

function parseNumeric(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new AdminApiError(400, "INVALID_NUMERIC_VALUE", `${field} 必须是有限数值。`);
  }
  return parsed;
}

function parseDateTime(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AdminApiError(400, "INVALID_COLLECTED_AT", "collectedAt 必须是 ISO 8601 时间。");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminApiError(400, "INVALID_COLLECTED_AT", "collectedAt 不是有效时间。");
  }
  return date.toISOString();
}

export function buildExperimentDataPayload(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  for (const field of ["id", "taskId", "recordedBy", "recordedAt", "createdAt"]) {
    if (body[field] !== undefined) {
      throw new AdminApiError(400, "INVALID_DATA_FIELD", `${field} 由服务端生成。`);
    }
  }

  const dataType = parseDataType(body.dataType);
  const rawValue = parseNumeric(body.rawValue, "rawValue");
  const processedValue = parseNumeric(body.processedValue, "processedValue");
  const hasRaw = rawValue !== undefined && rawValue !== null;
  const hasProcessed = processedValue !== undefined && processedValue !== null;

  if (dataType === "RAW" && (!hasRaw || hasProcessed)) {
    throw new AdminApiError(400, "INVALID_DATA_VALUE_SHAPE", "RAW 数据必须只提供 rawValue。");
  }
  if (dataType !== "RAW" && (hasRaw || !hasProcessed)) {
    throw new AdminApiError(400, "INVALID_DATA_VALUE_SHAPE", "处理数据和最终结果必须只提供 processedValue。");
  }

  return {
    sample_id: requireId(String(body.sampleId)),
    instrument_id: body.instrumentId === undefined || body.instrumentId === null || body.instrumentId === "" ? null : requireId(String(body.instrumentId)),
    data_type: dataType,
    metric_name: requireText(body.metricName, "metricName", 64),
    raw_value: rawValue ?? null,
    processed_value: processedValue ?? null,
    unit: body.unit === undefined || body.unit === null || body.unit === "" ? null : optionalText(body.unit, "unit", 16),
    source_type: parseSourceType(body.sourceType),
    collected_at: parseDateTime(body.collectedAt),
    remark: body.remark === undefined || body.remark === null || body.remark === "" ? null : optionalText(body.remark, "remark", 4000),
  };
}

function serializeMethod(row: Database["public"]["Tables"]["experiment_method"]["Row"] | null): MethodSummary | null {
  return row ? { id: row.id, methodCode: row.method_code, name: row.name, version: row.version, status: row.status } : null;
}

function serializeSample(row: SampleRow | null): SampleSummary | null {
  return row ? { id: row.id, sampleCode: row.sample_code, name: row.name, status: row.status } : null;
}

function serializeInstrument(row: InstrumentRow | null): InstrumentSummary | null {
  return row ? { id: row.id, instrumentCode: row.instrument_code, name: row.name, status: row.status } : null;
}

function serializeData(row: DataRow, method: MethodSummary | null, sample: SampleSummary | null, instrument: InstrumentSummary | null): ExperimentDataView {
  return {
    id: row.id,
    taskId: row.task_id,
    sampleId: row.sample_id,
    instrumentId: row.instrument_id,
    dataType: row.data_type as DataType,
    metricName: row.metric_name,
    rawValue: row.raw_value,
    processedValue: row.processed_value,
    unit: row.unit,
    sourceType: row.source_type as SourceType,
    collectedAt: row.collected_at,
    recordedBy: row.recorded_by,
    recordedAt: row.created_at,
    method,
    sample,
    instrument,
    remark: row.remark,
  };
}

async function loadTask(supabase: SupabaseClient<Database>, taskId: number) {
  const { data, error } = await supabase
    .from("experiment_task")
    .select("id, task_code, method_id, status")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new AdminApiError(500, "TASK_LOOKUP_FAILED", "无法读取实验任务。");
  if (!data) throw new AdminApiError(404, "TASK_NOT_FOUND", "实验任务不存在。");
  return data as Pick<TaskRow, "id" | "task_code" | "method_id" | "status">;
}

async function loadReferences(supabase: SupabaseClient<Database>, rows: DataRow[], task: Pick<TaskRow, "method_id">) {
  const sampleIds = [...new Set(rows.map((row) => row.sample_id))];
  const instrumentIds = [...new Set(rows.flatMap((row) => row.instrument_id === null ? [] : [row.instrument_id]))];
  const [{ data: method, error: methodError }, { data: samples, error: sampleError }, { data: instruments, error: instrumentError }] = await Promise.all([
    supabase.from("experiment_method").select("id, method_code, name, version, status").eq("id", task.method_id).maybeSingle(),
    sampleIds.length ? supabase.from("sample").select("id, sample_code, name, status").in("id", sampleIds) : Promise.resolve({ data: [], error: null }),
    instrumentIds.length ? supabase.from("instrument").select("id, instrument_code, name, status").in("id", instrumentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (methodError || sampleError || instrumentError) throw new AdminApiError(500, "DATA_REFERENCE_LOOKUP_FAILED", "无法读取实验数据关联信息。");
  const sampleMap = new Map((samples ?? []).map((row) => [row.id, serializeSample(row as SampleRow)]));
  const instrumentMap = new Map((instruments ?? []).map((row) => [row.id, serializeInstrument(row as InstrumentRow)]));
  const methodView = serializeMethod(method as Database["public"]["Tables"]["experiment_method"]["Row"] | null);
  return rows.map((row) => serializeData(row, methodView, sampleMap.get(row.sample_id) ?? null, row.instrument_id === null ? null : instrumentMap.get(row.instrument_id) ?? null));
}

export async function loadTaskData(supabase: SupabaseClient<Database>, taskIdValue: string) {
  const taskId = requireId(taskIdValue);
  const task = await loadTask(supabase, taskId);
  const { data, error } = await supabase
    .from("experiment_data")
    .select(EXPERIMENT_DATA_FIELDS)
    .eq("task_id", taskId)
    .order("collected_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new AdminApiError(500, "DATA_LOOKUP_FAILED", "无法读取实验数据。");
  return loadReferences(supabase, (data ?? []) as unknown as DataRow[], task);
}

export async function createTaskData(supabase: SupabaseClient<Database>, operatorId: string, taskIdValue: string, bodyValue: unknown) {
  const taskId = requireId(taskIdValue);
  const task = await loadTask(supabase, taskId);
  if (["APPROVED", "ARCHIVED"].includes(task.status)) {
    throw new AdminApiError(409, "DATA_TASK_LOCKED", "任务已审核或归档，不能新增实验数据。");
  }
  const payload = buildExperimentDataPayload(bodyValue);

  const { data: sampleLink, error: sampleLinkError } = await supabase
    .from("task_sample")
    .select("task_id")
    .eq("task_id", taskId)
    .eq("sample_id", payload.sample_id)
    .maybeSingle();
  if (sampleLinkError) throw new AdminApiError(500, "DATA_REFERENCE_LOOKUP_FAILED", "无法验证任务样品关联。");
  if (!sampleLink) throw new AdminApiError(400, "SAMPLE_NOT_LINKED_TO_TASK", "样品未关联到当前任务。");

  if (payload.instrument_id !== null) {
    const { data: instrument, error: instrumentError } = await supabase.from("instrument").select("id, status").eq("id", payload.instrument_id).maybeSingle();
    if (instrumentError) throw new AdminApiError(500, "DATA_REFERENCE_LOOKUP_FAILED", "无法验证实验设备。");
    if (!instrument) throw new AdminApiError(404, "INSTRUMENT_NOT_FOUND", "实验设备不存在。");
    if (instrument.status === "SCRAPPED") throw new AdminApiError(409, "INSTRUMENT_SCRAPPED", "已报废设备不能关联实验数据。");
  }

  const { data, error } = await supabase.from("experiment_data").insert({
    ...payload,
    task_id: taskId,
    recorded_by: operatorId,
  }).select(EXPERIMENT_DATA_FIELDS).single();
  if (error || !data) {
    if (error?.code === "23503") throw new AdminApiError(400, "INVALID_DATA_REFERENCE", "实验数据关联对象不存在。");
    if (error?.code === "23514") throw new AdminApiError(400, "INVALID_DATA_VALUE_SHAPE", "实验数据类型和值字段不匹配。");
    if (error?.code === "22023") throw new AdminApiError(409, "DATA_TASK_LOCKED", "任务当前不接受新增实验数据。");
    throw new AdminApiError(400, "DATA_CREATE_FAILED", "实验数据录入失败。");
  }
  await recordAudit(supabase, "data.manage", "experiment_data", String(data.id), "CREATE", null, data as unknown as Json);
  const [view] = await loadReferences(supabase, [data as unknown as DataRow], task);
  return view;
}
