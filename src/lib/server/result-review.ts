import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminApiError, requireId, requireObject, requireText } from "@/lib/server/admin";
import type { Database } from "@/types/database";

export const REVIEW_RESULTS = ["APPROVED", "RETURNED", "NEED_MORE"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

const REVIEW_FIELDS = "id, task_id, reviewer_id, result, comment, reviewed_at, created_at";
const DATA_FIELDS = "id, task_id, sample_id, instrument_id, data_type, metric_name, raw_value, processed_value, unit, source_type, collected_at, recorded_by, remark";
const RUN_FIELDS = "id, task_id, rule_id, execution_mode, status, output_data_id, decision, explanation, error_code, error_message, executed_by, executed_at";

type ReviewRow = Database["public"]["Tables"]["result_review"]["Row"];
type TaskRow = Database["public"]["Tables"]["experiment_task"]["Row"];

export type ReviewView = {
  id: number;
  taskId: number;
  reviewerId: string;
  result: ReviewResult;
  comment: string | null;
  reviewedAt: string;
  createdAt: string;
};

export type ReviewContext = {
  task: {
    id: number;
    taskCode: string;
    name: string;
    status: string;
    priority: string;
    projectId: number;
    methodId: number;
    updatedAt: string;
  };
  data: Array<{
    id: number;
    sampleId: number;
    instrumentId: number | null;
    dataType: string;
    metricName: string;
    rawValue: number | null;
    processedValue: number | null;
    unit: string | null;
    sourceType: string;
    collectedAt: string;
    recordedBy: string;
    remark: string | null;
  }>;
  processingRuns: Array<{
    id: number;
    ruleId: number;
    executionMode: string;
    status: string;
    outputDataId: number | null;
    decision: string | null;
    explanation: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    executedBy: string;
    executedAt: string;
    lineage: Array<{
      id: number;
      sourceDataId: number;
      outputDataId: number;
      relationType: string;
    }>;
  }>;
  reviews: ReviewView[];
  latestReview: ReviewView | null;
};

type ReviewRequest = { result: ReviewResult; comment: string | null };

function serializeReview(row: ReviewRow): ReviewView {
  if (!REVIEW_RESULTS.includes(row.result as ReviewResult)) {
    throw new AdminApiError(500, "INVALID_REVIEW_RESULT", "数据库中的审核结果无效。");
  }
  return {
    id: row.id,
    taskId: row.task_id,
    reviewerId: row.reviewer_id,
    result: row.result as ReviewResult,
    comment: row.comment,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export function buildReviewRequest(bodyValue: unknown): ReviewRequest {
  const body = requireObject(bodyValue);
  for (const field of ["id", "taskId", "reviewerId", "reviewedAt", "createdAt", "operatorId", "targetStatus"]) {
    if (body[field] !== undefined) throw new AdminApiError(400, "INVALID_REVIEW_FIELD", `${field} 由服务端生成。`);
  }
  const result = requireText(body.result, "result", 16).toUpperCase() as ReviewResult;
  if (!REVIEW_RESULTS.includes(result)) throw new AdminApiError(400, "INVALID_REVIEW_RESULT", "result 必须是 APPROVED、RETURNED 或 NEED_MORE。");
  const comment = body.comment === undefined || body.comment === null ? null : requireText(body.comment, "comment", 4000);
  if (result !== "APPROVED" && !comment) throw new AdminApiError(400, "REVIEW_COMMENT_REQUIRED", "退回或要求补充时必须填写审核意见。");
  return { result, comment };
}

function mapReviewError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "42501" || message.includes("permission denied")) return new AdminApiError(403, "FORBIDDEN", "当前用户没有结果审核权限。");
  if (error.code === "P0002" || message.includes("Review task not found")) return new AdminApiError(404, "REVIEW_TASK_NOT_FOUND", "审核任务不存在。");
  if (error.code === "55000" || message.includes("not pending review")) return new AdminApiError(409, "REVIEW_TASK_NOT_PENDING", "任务当前不在待审核状态。");
  if (message.includes("Review comment is required")) return new AdminApiError(400, "REVIEW_COMMENT_REQUIRED", "退回或要求补充时必须填写审核意见。");
  if (message.includes("Invalid review result")) return new AdminApiError(400, "INVALID_REVIEW_RESULT", "审核结果不受支持。");
  return new AdminApiError(500, "REVIEW_FAILED", "结果审核失败。");
}

export async function loadTaskReviews(supabase: SupabaseClient<Database>, taskIdValue: string): Promise<ReviewContext> {
  const taskId = requireId(taskIdValue);
  const [{ data: task, error: taskError }, { data: dataRows, error: dataError }, { data: runRows, error: runError }, { data: reviewRows, error: reviewError }] = await Promise.all([
    supabase.from("experiment_task").select("id, task_code, name, status, priority, project_id, method_id, updated_at").eq("id", taskId).maybeSingle(),
    supabase.from("experiment_data").select(DATA_FIELDS).eq("task_id", taskId).order("collected_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("experiment_processing_run").select(RUN_FIELDS).eq("task_id", taskId).order("executed_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("result_review").select(REVIEW_FIELDS).eq("task_id", taskId).order("reviewed_at", { ascending: false }).order("id", { ascending: false }),
  ]);
  if (taskError) throw new AdminApiError(500, "REVIEW_TASK_LOOKUP_FAILED", "无法读取审核任务。");
  if (!task) throw new AdminApiError(404, "REVIEW_TASK_NOT_FOUND", "审核任务不存在。");
  if (dataError || runError || reviewError) throw new AdminApiError(500, "REVIEW_CONTEXT_LOOKUP_FAILED", "无法读取审核上下文。");

  const runs = (runRows ?? []) as unknown as Database["public"]["Tables"]["experiment_processing_run"]["Row"][];
  const runIds = runs.map((run) => run.id);
  const { data: lineageRows, error: lineageError } = runIds.length
    ? await supabase.from("experiment_data_lineage").select("id, run_id, source_data_id, output_data_id, relation_type").in("run_id", runIds).order("id", { ascending: true })
    : { data: [], error: null };
  if (lineageError) throw new AdminApiError(500, "REVIEW_LINEAGE_LOOKUP_FAILED", "无法读取结果血缘。");
  const lineagesByRun = new Map<number, Array<{ id: number; sourceDataId: number; outputDataId: number; relationType: string }>>();
  for (const item of lineageRows ?? []) {
    lineagesByRun.set(item.run_id, [...(lineagesByRun.get(item.run_id) ?? []), { id: item.id, sourceDataId: item.source_data_id, outputDataId: item.output_data_id, relationType: item.relation_type }]);
  }

  const reviews = ((reviewRows ?? []) as unknown as ReviewRow[]).map(serializeReview);
  const taskRow = task as unknown as Pick<TaskRow, "id" | "task_code" | "name" | "status" | "priority" | "project_id" | "method_id" | "updated_at">;
  return {
    task: { id: taskRow.id, taskCode: taskRow.task_code, name: taskRow.name, status: taskRow.status, priority: taskRow.priority, projectId: taskRow.project_id, methodId: taskRow.method_id, updatedAt: taskRow.updated_at },
    data: (dataRows ?? []).map((row) => ({ id: row.id, sampleId: row.sample_id, instrumentId: row.instrument_id, dataType: row.data_type, metricName: row.metric_name, rawValue: row.raw_value, processedValue: row.processed_value, unit: row.unit, sourceType: row.source_type, collectedAt: row.collected_at, recordedBy: row.recorded_by, remark: row.remark })),
    processingRuns: runs.map((run) => ({ id: run.id, ruleId: run.rule_id, executionMode: run.execution_mode, status: run.status, outputDataId: run.output_data_id, decision: run.decision, explanation: run.explanation, errorCode: run.error_code, errorMessage: run.error_message, executedBy: run.executed_by, executedAt: run.executed_at, lineage: lineagesByRun.get(run.id) ?? [] })),
    reviews,
    latestReview: reviews[0] ?? null,
  };
}

export async function reviewTask(supabase: SupabaseClient<Database>, taskIdValue: string, bodyValue: unknown) {
  const taskId = requireId(taskIdValue);
  const request = buildReviewRequest(bodyValue);
  const { data, error } = await supabase.rpc("review_task_result", { _task_id: taskId, _result: request.result, _comment: request.comment });
  if (error) throw mapReviewError(error);
  if (!data) throw new AdminApiError(500, "REVIEW_FAILED", "审核未返回结果。");
  return data;
}
