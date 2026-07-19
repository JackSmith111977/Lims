import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminApiError,
  requireId,
  requireObject,
  requireText,
} from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

export const REPORT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const REPORT_FIELDS = "id, report_code, task_id, version_no, status, report_payload, storage_path, generated_by, generated_at, published_at, archived_at";
const REPORT_HISTORY_FIELDS = "id, report_id, from_status, to_status, operator_id, remark, occurred_at";

type ReportRow = Database["public"]["Tables"]["experiment_report"]["Row"];
type ReportHistoryRow = Database["public"]["Tables"]["experiment_report_history"]["Row"];
type ReportSignatureRow = Database["public"]["Tables"]["experiment_report_signature"]["Row"];

export type ReportHistoryView = {
  id: number;
  reportId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorId: string;
  remark: string | null;
  occurredAt: string;
};

export type ReportSignatureView = {
  id: number;
  reportId: number;
  signatureType: string;
  signatureHash: string;
  signedBy: string;
  signedAt: string;
  remark: string | null;
};

export type ReportView = {
  id: number;
  reportCode: string;
  taskId: number;
  versionNo: number;
  status: string;
  reportPayload: Json;
  storagePath: string | null;
  generatedBy: string;
  generatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  history: ReportHistoryView[];
  signature: ReportSignatureView | null;
};

function serializeHistory(row: ReportHistoryRow): ReportHistoryView {
  return {
    id: row.id,
    reportId: row.report_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    operatorId: row.operator_id,
    remark: row.remark,
    occurredAt: row.occurred_at,
  };
}

function serializeSignature(row: ReportSignatureRow): ReportSignatureView {
  return { id: row.id, reportId: row.report_id, signatureType: row.signature_type, signatureHash: row.signature_hash, signedBy: row.signed_by, signedAt: row.signed_at, remark: row.remark };
}

function serializeReport(row: ReportRow, history: ReportHistoryView[] = [], signature: ReportSignatureView | null = null): ReportView {
  return {
    id: row.id,
    reportCode: row.report_code,
    taskId: row.task_id,
    versionNo: row.version_no,
    status: row.status,
    reportPayload: row.report_payload,
    storagePath: row.storage_path,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    history,
    signature,
  };
}

function mapReportError(error: { code?: string; message?: string }, fallbackCode: string): never {
  const message = error.message ?? "";
  if (error.code === "42501" || message.toLowerCase().includes("permission denied")) {
    throw new AdminApiError(403, "REPORT_PERMISSION_DENIED", "当前用户没有执行报告操作的权限。");
  }
  if (error.code === "P0002" || message.toLowerCase().includes("not found")) {
    throw new AdminApiError(404, "REPORT_NOT_FOUND", "报告或关联任务不存在。");
  }
  if (error.code === "55000" || message.toLowerCase().includes("only approved") || message.toLowerCase().includes("not a draft") || message.toLowerCase().includes("not ready") || message.toLowerCase().includes("only published")) {
    throw new AdminApiError(409, "REPORT_INVALID_TRANSITION", "报告当前状态不允许执行此操作。");
  }
  if (error.code === "23505") {
    throw new AdminApiError(409, "REPORT_VERSION_CONFLICT", "报告版本冲突，请刷新后重试。");
  }
  throw new AdminApiError(400, fallbackCode, "报告操作失败。");
}

export function buildReportTransitionRequest(bodyValue: unknown) {
  const body = requireObject(bodyValue ?? {});
  for (const field of ["id", "reportCode", "taskId", "versionNo", "status", "reportPayload", "storagePath", "generatedBy", "generatedAt", "publishedAt", "archivedAt", "history", "signatureId", "signatureType", "signatureHash", "signedBy", "signedAt"]) {
    if (body[field] !== undefined) throw new AdminApiError(400, "INVALID_REPORT_FIELD", `${field} 由服务端生成。`);
  }
  if (body.remark === undefined || body.remark === null || body.remark === "") return { remark: null };
  return { remark: requireText(body.remark, "remark", 1000) };
}

export async function readOptionalJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AdminApiError(400, "INVALID_JSON", "请求体必须是有效 JSON。");
  }
}

async function loadReportHistories(supabase: SupabaseClient<Database>, reportIds: number[]) {
  if (reportIds.length === 0) return new Map<number, ReportHistoryView[]>();
  const { data, error } = await supabase
    .from("experiment_report_history")
    .select(REPORT_HISTORY_FIELDS)
    .in("report_id", reportIds)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new AdminApiError(500, "REPORT_HISTORY_LOOKUP_FAILED", "无法读取报告变更记录。");
  const grouped = new Map<number, ReportHistoryView[]>();
  for (const row of ((data ?? []) as unknown as ReportHistoryRow[])) {
    const history = grouped.get(row.report_id) ?? [];
    history.push(serializeHistory(row));
    grouped.set(row.report_id, history);
  }
  return grouped;
}

async function loadReportSignatures(supabase: SupabaseClient<Database>, reportIds: number[]) {
  if (reportIds.length === 0) return new Map<number, ReportSignatureView>();
  const { data, error } = await supabase.from("experiment_report_signature").select("id, report_id, signature_type, signature_hash, signed_by, signed_at, remark").in("report_id", reportIds);
  if (error) throw new AdminApiError(500, "REPORT_SIGNATURE_LOOKUP_FAILED", "无法读取报告签名。");
  return new Map(((data ?? []) as unknown as ReportSignatureRow[]).map((row) => [row.report_id, serializeSignature(row)]));
}

export async function loadReports(supabase: SupabaseClient<Database>, filters: { status?: string | null; keyword?: string | null } = {}) {
  if (filters.status && !REPORT_STATUSES.includes(filters.status as ReportStatus)) {
    throw new AdminApiError(400, "INVALID_REPORT_STATUS", "报告状态不受支持。");
  }
  let query = supabase.from("experiment_report").select(REPORT_FIELDS).order("generated_at", { ascending: false }).order("id", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "REPORT_LOOKUP_FAILED", "无法读取报告。");
  const keyword = filters.keyword?.trim().toLowerCase() ?? "";
  const rows = ((data ?? []) as unknown as ReportRow[]).filter((row) => !keyword || `${row.report_code} ${row.task_id} ${row.version_no}`.toLowerCase().includes(keyword));
  const histories = await loadReportHistories(supabase, rows.map((row) => row.id));
  const signatures = await loadReportSignatures(supabase, rows.map((row) => row.id));
  return rows.map((row) => serializeReport(row, histories.get(row.id) ?? [], signatures.get(row.id) ?? null));
}

export async function loadReportDetail(supabase: SupabaseClient<Database>, idValue: string) {
  const id = requireId(idValue);
  const { data, error } = await supabase.from("experiment_report").select(REPORT_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new AdminApiError(500, "REPORT_LOOKUP_FAILED", "无法读取报告。");
  if (!data) throw new AdminApiError(404, "REPORT_NOT_FOUND", "报告不存在。");
  const histories = await loadReportHistories(supabase, [id]);
  const signatures = await loadReportSignatures(supabase, [id]);
  return serializeReport(data as unknown as ReportRow, histories.get(id) ?? [], signatures.get(id) ?? null);
}

async function resolveRpcReport(supabase: SupabaseClient<Database>, data: Json | null, fallbackCode: string) {
  const reportId = data && typeof data === "object" && !Array.isArray(data) && typeof data.id === "number" ? data.id : null;
  if (!reportId) throw new AdminApiError(500, fallbackCode, "报告操作未返回有效报告。");
  return loadReportDetail(supabase, String(reportId));
}

export async function generateReport(supabase: SupabaseClient<Database>, taskIdValue: string) {
  const taskId = requireId(taskIdValue);
  const { data, error } = await supabase.rpc("generate_report", { _task_id: taskId });
  if (error) mapReportError(error, "REPORT_GENERATE_FAILED");
  return resolveRpcReport(supabase, data, "REPORT_GENERATE_FAILED");
}

async function transitionReport(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown, action: "submit" | "publish" | "archive") {
  const reportId = requireId(idValue);
  const { remark } = buildReportTransitionRequest(bodyValue);
  const rpc = action === "submit" ? "submit_report_for_review" : action === "publish" ? "publish_report" : "archive_report";
  const { data, error } = await supabase.rpc(rpc, { _report_id: reportId, _remark: remark });
  if (error) mapReportError(error, `REPORT_${action.toUpperCase()}_FAILED`);
  return resolveRpcReport(supabase, data, `REPORT_${action.toUpperCase()}_FAILED`);
}

export function submitReportForReview(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  return transitionReport(supabase, idValue, bodyValue, "submit");
}

export function publishReport(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  return transitionReport(supabase, idValue, bodyValue, "publish");
}

export function archiveReport(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  return transitionReport(supabase, idValue, bodyValue, "archive");
}

export async function signReport(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const reportId = requireId(idValue);
  const { remark } = buildReportTransitionRequest(bodyValue);
  const { data, error } = await supabase.rpc("sign_report", { _report_id: reportId, _remark: remark });
  if (error) {
    if (error.code === "42501") throw new AdminApiError(403, "REPORT_PERMISSION_DENIED", "当前用户没有签署报告的权限。");
    if (error.code === "P0002") throw new AdminApiError(404, "REPORT_NOT_FOUND", "报告不存在。");
    if (error.code === "23505") throw new AdminApiError(409, "REPORT_ALREADY_SIGNED", "报告已经完成电子签名。");
    if (error.code === "55000") throw new AdminApiError(409, "REPORT_INVALID_SIGNATURE_STATE", "只有已发布报告可以签署。");
    throw new AdminApiError(400, "REPORT_SIGN_FAILED", "报告签署失败。");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new AdminApiError(500, "REPORT_SIGN_FAILED", "签署未返回有效回执。");
  const value = data as Record<string, unknown>;
  if (typeof value.id !== "number" || typeof value.reportId !== "number" || typeof value.signatureType !== "string" || typeof value.signatureHash !== "string" || typeof value.signedBy !== "string" || typeof value.signedAt !== "string") {
    throw new AdminApiError(500, "REPORT_SIGN_FAILED", "签署回执结构无效。");
  }
  return { id: value.id, reportId: value.reportId, signatureType: value.signatureType, signatureHash: value.signatureHash, signedBy: value.signedBy, signedAt: value.signedAt, remark: typeof value.remark === "string" ? value.remark : null } satisfies ReportSignatureView;
}
