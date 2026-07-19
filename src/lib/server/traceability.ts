import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminApiError, requireId } from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

type SnapshotObject = Record<string, Json | undefined>;

export type TraceTask = {
  id: number;
  taskCode: string;
  projectId: number | null;
  methodId: number | null;
  name: string;
  priority: string | null;
  status: string;
  remark: string | null;
};

export type TraceSample = {
  id: number;
  sampleCode: string;
  name: string;
  specification: string | null;
  batchNo: string | null;
  quantity: number | null;
  unit: string | null;
  status: string | null;
};

export type TraceData = {
  id: number;
  sampleId: number | null;
  instrumentId: number | null;
  dataType: string | null;
  metricName: string | null;
  rawValue: number | null;
  processedValue: number | null;
  unit: string | null;
  sourceType: string | null;
  collectedAt: string | null;
  recordedBy: string | null;
  remark: string | null;
};

export type TraceReview = {
  id: number;
  reviewerId: string | null;
  result: string | null;
  comment: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
};

export type ReportTraceView = {
  report: {
    id: number;
    reportCode: string;
    taskId: number;
    versionNo: number;
    status: string;
    generatedBy: string;
    generatedAt: string;
    publishedAt: string | null;
    archivedAt: string | null;
  };
  task: TraceTask;
  samples: TraceSample[];
  data: TraceData[];
  reviews: TraceReview[];
};

function asObject(value: Json | undefined): SnapshotObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SnapshotObject : null;
}

function readNumber(object: SnapshotObject, key: string, required = false) {
  const value = object[key];
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : null;
  if (number !== null && Number.isFinite(number)) return number;
  if (required) throw new AdminApiError(500, "REPORT_SNAPSHOT_INVALID", "报告快照结构无效。");
  return null;
}

function readString(object: SnapshotObject, key: string, required = false) {
  const value = object[key];
  if (typeof value === "string") return value;
  if (required) throw new AdminApiError(500, "REPORT_SNAPSHOT_INVALID", "报告快照结构无效。");
  return null;
}

function readObjectList(payload: SnapshotObject, key: string) {
  const value = payload[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new AdminApiError(500, "REPORT_SNAPSHOT_INVALID", "报告快照结构无效。");
  return value.map((item) => {
    const object = asObject(item);
    if (!object) throw new AdminApiError(500, "REPORT_SNAPSHOT_INVALID", "报告快照结构无效。");
    return object;
  });
}

function parseTask(payload: SnapshotObject): TraceTask {
  const object = asObject(payload.task);
  if (!object) throw new AdminApiError(500, "REPORT_SNAPSHOT_INVALID", "报告缺少任务追溯快照。");
  return {
    id: readNumber(object, "id", true)!,
    taskCode: readString(object, "taskCode", true)!,
    projectId: readNumber(object, "projectId"),
    methodId: readNumber(object, "methodId"),
    name: readString(object, "name", true)!,
    priority: readString(object, "priority"),
    status: readString(object, "status", true)!,
    remark: readString(object, "remark"),
  };
}

function parseSamples(payload: SnapshotObject) {
  return readObjectList(payload, "samples").map((object): TraceSample => ({
    id: readNumber(object, "id", true)!,
    sampleCode: readString(object, "sampleCode", true)!,
    name: readString(object, "name", true)!,
    specification: readString(object, "specification"),
    batchNo: readString(object, "batchNo"),
    quantity: readNumber(object, "quantity"),
    unit: readString(object, "unit"),
    status: readString(object, "status"),
  }));
}

function parseData(payload: SnapshotObject) {
  return readObjectList(payload, "data").map((object): TraceData => ({
    id: readNumber(object, "id", true)!,
    sampleId: readNumber(object, "sampleId"),
    instrumentId: readNumber(object, "instrumentId"),
    dataType: readString(object, "dataType"),
    metricName: readString(object, "metricName"),
    rawValue: readNumber(object, "rawValue"),
    processedValue: readNumber(object, "processedValue"),
    unit: readString(object, "unit"),
    sourceType: readString(object, "sourceType"),
    collectedAt: readString(object, "collectedAt"),
    recordedBy: readString(object, "recordedBy"),
    remark: readString(object, "remark"),
  }));
}

function parseReviews(payload: SnapshotObject) {
  return readObjectList(payload, "reviews").map((object): TraceReview => ({
    id: readNumber(object, "id", true)!,
    reviewerId: readString(object, "reviewerId"),
    result: readString(object, "result"),
    comment: readString(object, "comment"),
    reviewedAt: readString(object, "reviewedAt"),
    createdAt: readString(object, "createdAt"),
  }));
}

export function buildReportTrace(row: Database["public"]["Tables"]["experiment_report"]["Row"]): ReportTraceView {
  const payload = asObject(row.report_payload);
  if (!payload) throw new AdminApiError(500, "REPORT_SNAPSHOT_INVALID", "报告快照结构无效。");
  return {
    report: {
      id: row.id,
      reportCode: row.report_code,
      taskId: row.task_id,
      versionNo: row.version_no,
      status: row.status,
      generatedBy: row.generated_by,
      generatedAt: row.generated_at,
      publishedAt: row.published_at,
      archivedAt: row.archived_at,
    },
    task: parseTask(payload),
    samples: parseSamples(payload),
    data: parseData(payload),
    reviews: parseReviews(payload),
  };
}

export async function loadReportTrace(supabase: SupabaseClient<Database>, objectType: string, idValue: string) {
  if (objectType !== "report") {
    throw new AdminApiError(400, "UNSUPPORTED_TRACE_OBJECT", "当前仅支持从报告开始追溯。");
  }
  const id = requireId(idValue);
  const { data, error } = await supabase
    .from("experiment_report")
    .select("id, report_code, task_id, version_no, status, report_payload, generated_by, generated_at, published_at, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AdminApiError(500, "TRACE_LOOKUP_FAILED", "无法读取报告追溯信息。");
  if (!data) throw new AdminApiError(404, "REPORT_NOT_FOUND", "报告不存在。");
  return buildReportTrace(data as unknown as Database["public"]["Tables"]["experiment_report"]["Row"]);
}
