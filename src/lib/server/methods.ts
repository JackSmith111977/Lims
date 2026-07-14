import { randomUUID } from "node:crypto";

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

export const METHOD_FIELDS = "id, method_code, name, version, scope, detection_limit, status, document_id, effective_at, expired_at, created_at, updated_at";
export const METHOD_STORAGE_BUCKET = "lims-methods";
const METHOD_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "EXPIRED"] as const;

type MethodRow = Database["public"]["Tables"]["experiment_method"]["Row"];
type MethodHistoryRow = Database["public"]["Tables"]["experiment_method_history"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

export type MethodHistoryView = {
  id: number;
  methodId: number;
  methodCode: string;
  fromVersion: string | null;
  toVersion: string;
  fromStatus: string | null;
  toStatus: string;
  changeType: string;
  operatorId: string;
  remark: string | null;
  occurredAt: string;
};

export type MethodAttachmentView = {
  id: number;
  objectType: string;
  objectId: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type MethodView = {
  id: number;
  methodCode: string;
  name: string;
  version: string;
  scope: string | null;
  detectionLimit: number | null;
  status: string;
  documentId: number | null;
  effectiveAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: MethodHistoryView[];
  attachments: MethodAttachmentView[];
};

function parseMethodStatus(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const status = String(value).toUpperCase();
  if (!METHOD_STATUSES.includes(status as (typeof METHOD_STATUSES)[number])) {
    throw new AdminApiError(400, "INVALID_METHOD_STATUS", "实验方法状态不受支持。");
  }
  return status;
}

function parseDateTime(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AdminApiError(400, "INVALID_DATETIME", `${field} 必须是 ISO 8601 时间。`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminApiError(400, "INVALID_DATETIME", `${field} 不是有效时间。`);
  }
  return date.toISOString();
}

function parseDetectionLimit(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const detectionLimit = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(detectionLimit) || detectionLimit < 0) {
    throw new AdminApiError(400, "INVALID_DETECTION_LIMIT", "detectionLimit 必须是非负数字。");
  }
  return detectionLimit;
}

function parseDocumentId(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return requireId(String(value));
}

function validateDateRange(effectiveAt: string | null | undefined, expiredAt: string | null | undefined) {
  if (effectiveAt && expiredAt && new Date(expiredAt) < new Date(effectiveAt)) {
    throw new AdminApiError(400, "INVALID_METHOD_DATE_RANGE", "expiredAt 不能早于 effectiveAt。");
  }
}

export function buildMethodPayload(bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  for (const field of ["id", "createdAt", "updatedAt", "history", "attachments"]) {
    if (body[field] !== undefined) {
      throw new AdminApiError(400, "INVALID_METHOD_FIELD", `${field} 由服务端生成。`);
    }
  }
  if (update && (body.methodCode !== undefined || body.version !== undefined)) {
    throw new AdminApiError(409, "METHOD_IDENTITY_IMMUTABLE", "方法编号和版本号创建后不可修改，请创建新版本。");
  }

  const payload: Record<string, unknown> = {};
  if (!update || body.methodCode !== undefined) payload.method_code = requireText(body.methodCode, "methodCode", 32);
  if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
  if (!update || body.version !== undefined) payload.version = requireText(body.version, "version", 32);
  if (body.scope !== undefined) payload.scope = body.scope === null ? null : optionalText(body.scope, "scope", 255);
  if (body.detectionLimit !== undefined) payload.detection_limit = parseDetectionLimit(body.detectionLimit);
  const status = parseMethodStatus(body.status);
  if (status !== undefined) payload.status = status;
  if (body.documentId !== undefined) payload.document_id = parseDocumentId(body.documentId);
  if (body.effectiveAt !== undefined) payload.effective_at = parseDateTime(body.effectiveAt, "effectiveAt");
  if (body.expiredAt !== undefined) payload.expired_at = parseDateTime(body.expiredAt, "expiredAt");
  validateDateRange(payload.effective_at as string | null | undefined, payload.expired_at as string | null | undefined);

  if (update && Object.keys(payload).length === 0) {
    throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的方法字段。");
  }
  return payload;
}

export function buildAttachmentPayload(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  for (const field of ["id", "objectType", "objectId", "uploadedBy", "uploadedAt"]) {
    if (body[field] !== undefined) {
      throw new AdminApiError(400, "INVALID_ATTACHMENT_FIELD", `${field} 由服务端生成或固定。`);
    }
  }
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number(String(body.fileSize ?? "").trim());
  if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
    throw new AdminApiError(400, "INVALID_ATTACHMENT_SIZE", "fileSize 必须是非负整数。");
  }
  return {
    file_name: requireText(body.fileName, "fileName", 255),
    storage_path: requireText(body.storagePath, "storagePath", 512),
    file_size: fileSize,
    content_type: requireText(body.contentType, "contentType", 128),
  };
}

function serializeMethod(row: MethodRow, history: MethodHistoryView[], attachments: MethodAttachmentView[]): MethodView {
  return {
    id: row.id,
    methodCode: row.method_code,
    name: row.name,
    version: row.version,
    scope: row.scope,
    detectionLimit: row.detection_limit,
    status: row.status,
    documentId: row.document_id,
    effectiveAt: row.effective_at,
    expiredAt: row.expired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history,
    attachments,
  };
}

function serializeHistory(row: MethodHistoryRow): MethodHistoryView {
  return {
    id: row.id,
    methodId: row.method_id,
    methodCode: row.method_code,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changeType: row.change_type,
    operatorId: row.operator_id,
    remark: row.remark,
    occurredAt: row.occurred_at,
  };
}

function serializeAttachment(row: AttachmentRow): MethodAttachmentView {
  return {
    id: row.id,
    objectType: row.object_type,
    objectId: row.object_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    fileSize: row.file_size,
    contentType: row.content_type,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

async function loadMethodRelations(supabase: SupabaseClient<Database>, methodId: number) {
  const [{ data: history, error: historyError }, { data: attachments, error: attachmentError }] = await Promise.all([
    supabase.from("experiment_method_history").select("id, method_id, method_code, from_version, to_version, from_status, to_status, change_type, operator_id, remark, occurred_at").eq("method_id", methodId).order("occurred_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("attachment").select("id, object_type, object_id, file_name, storage_path, file_size, content_type, uploaded_by, uploaded_at").eq("object_type", "experiment_method").eq("object_id", String(methodId)).order("uploaded_at", { ascending: false }).order("id", { ascending: false }),
  ]);
  if (historyError || attachmentError) throw new AdminApiError(500, "METHOD_RELATION_LOOKUP_FAILED", "无法读取方法历史或附件。");
  return {
    history: ((history ?? []) as unknown as MethodHistoryRow[]).map(serializeHistory),
    attachments: ((attachments ?? []) as unknown as AttachmentRow[]).map(serializeAttachment),
  };
}

export async function loadMethods(supabase: SupabaseClient<Database>, filters: { keyword?: string | null; status?: string | null } = {}) {
  const status = parseMethodStatus(filters.status);
  let query = supabase.from("experiment_method").select(METHOD_FIELDS).order("method_code", { ascending: true }).order("version", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "METHOD_LOOKUP_FAILED", "无法读取实验方法。");
  const keyword = filters.keyword?.trim().toLowerCase() ?? "";
  const rows = ((data ?? []) as unknown as MethodRow[]).filter((row) => !keyword || `${row.method_code} ${row.name} ${row.version} ${row.scope ?? ""}`.toLowerCase().includes(keyword));
  return rows.map((row) => serializeMethod(row, [], []));
}

export async function loadMethodDetail(supabase: SupabaseClient<Database>, idValue: string) {
  const id = requireId(idValue);
  const { data, error } = await supabase.from("experiment_method").select(METHOD_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new AdminApiError(500, "METHOD_LOOKUP_FAILED", "无法读取实验方法。");
  if (!data) throw new AdminApiError(404, "METHOD_NOT_FOUND", "实验方法不存在。");
  const relations = await loadMethodRelations(supabase, id);
  return serializeMethod(data as unknown as MethodRow, relations.history, relations.attachments);
}

function throwMethodWriteError(error: { code?: string } | null, action: "CREATE" | "UPDATE"): never {
  if (error?.code === "23505") throw new AdminApiError(409, "METHOD_VERSION_EXISTS", "方法编号和版本号已经存在。");
  if (error?.code === "23503") throw new AdminApiError(400, "INVALID_METHOD_REFERENCE", "方法引用的关联记录不存在。");
  if (error?.code === "22023") throw new AdminApiError(409, "METHOD_IDENTITY_IMMUTABLE", "方法编号和版本号创建后不可修改。");
  throw new AdminApiError(400, action === "CREATE" ? "METHOD_CREATE_FAILED" : "METHOD_UPDATE_FAILED", action === "CREATE" ? "实验方法创建失败。" : "实验方法更新失败。");
}

export async function createMethod(supabase: SupabaseClient<Database>, bodyValue: unknown) {
  const payload = buildMethodPayload(bodyValue);
  const { data, error } = await supabase.from("experiment_method").insert(payload as Database["public"]["Tables"]["experiment_method"]["Insert"]).select(METHOD_FIELDS).single();
  if (error || !data) throwMethodWriteError(error, "CREATE");
  return loadMethodDetail(supabase, String(data.id));
}

export async function updateMethod(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const id = requireId(idValue);
  const payload = buildMethodPayload(bodyValue, true);
  const { data: before, error: beforeError } = await supabase.from("experiment_method").select(METHOD_FIELDS).eq("id", id).maybeSingle();
  if (beforeError) throw new AdminApiError(500, "METHOD_LOOKUP_FAILED", "无法读取实验方法。");
  if (!before) throw new AdminApiError(404, "METHOD_NOT_FOUND", "实验方法不存在。");
  const effectiveAt = payload.effective_at !== undefined ? payload.effective_at as string | null : before.effective_at;
  const expiredAt = payload.expired_at !== undefined ? payload.expired_at as string | null : before.expired_at;
  validateDateRange(effectiveAt, expiredAt);
  const { data: after, error } = await supabase.from("experiment_method").update(payload as Database["public"]["Tables"]["experiment_method"]["Update"]).eq("id", id).select(METHOD_FIELDS).single();
  if (error || !after) throwMethodWriteError(error, "UPDATE");
  return loadMethodDetail(supabase, String(id));
}

export async function createMethodAttachment(supabase: SupabaseClient<Database>, operatorId: string, idValue: string, bodyValue: unknown) {
  const methodId = requireId(idValue);
  const payload = buildAttachmentPayload(bodyValue);
  const { data: method, error: methodError } = await supabase.from("experiment_method").select("id").eq("id", methodId).maybeSingle();
  if (methodError) throw new AdminApiError(500, "METHOD_LOOKUP_FAILED", "无法读取实验方法。");
  if (!method) throw new AdminApiError(404, "METHOD_NOT_FOUND", "实验方法不存在。");
  const { data, error } = await supabase.from("attachment").insert({
    ...payload,
    object_type: "experiment_method",
    object_id: String(methodId),
    uploaded_by: operatorId,
  }).select("id, object_type, object_id, file_name, storage_path, file_size, content_type, uploaded_by, uploaded_at").single();
  if (error || !data) {
    if (error?.code === "23503") throw new AdminApiError(400, "INVALID_ATTACHMENT_OWNER", "附件上传人不存在。");
    throw new AdminApiError(400, "ATTACHMENT_CREATE_FAILED", "方法附件登记失败。");
  }
  await recordAudit(supabase, "resource.manage", "attachment", String(data.id), "CREATE", null, data as unknown as Json);
  return serializeAttachment(data as unknown as AttachmentRow);
}

function buildStorageFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new AdminApiError(400, "INVALID_ATTACHMENT_NAME", "附件文件名无效。");
  }
  return normalized.slice(0, 180);
}

export async function uploadMethodAttachment(supabase: SupabaseClient<Database>, operatorId: string, idValue: string, file: File) {
  const methodId = requireId(idValue);
  if (!(file instanceof File)) throw new AdminApiError(400, "ATTACHMENT_REQUIRED", "请上传方法附件文件。");
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
    throw new AdminApiError(400, "INVALID_ATTACHMENT_SIZE", "附件大小必须大于 0 且不超过 50 MiB。");
  }
  const fileName = buildStorageFileName(requireText(file.name, "fileName", 255));
  const contentType = file.type || "application/octet-stream";
  const storagePath = `methods/${methodId}/${randomUUID()}-${fileName}`;
  const { data: method, error: methodError } = await supabase.from("experiment_method").select("id").eq("id", methodId).maybeSingle();
  if (methodError) throw new AdminApiError(500, "METHOD_LOOKUP_FAILED", "无法读取实验方法。");
  if (!method) throw new AdminApiError(404, "METHOD_NOT_FOUND", "实验方法不存在。");

  const { error: uploadError } = await supabase.storage.from(METHOD_STORAGE_BUCKET).upload(storagePath, file, { contentType, upsert: false });
  if (uploadError) throw new AdminApiError(400, "ATTACHMENT_UPLOAD_FAILED", "方法附件上传失败。");

  try {
    const { data, error } = await supabase.from("attachment").insert({
      object_type: "experiment_method",
      object_id: String(methodId),
      file_name: fileName,
      storage_path: storagePath,
      file_size: file.size,
      content_type: contentType,
      uploaded_by: operatorId,
    }).select("id, object_type, object_id, file_name, storage_path, file_size, content_type, uploaded_by, uploaded_at").single();
    if (error || !data) throw new AdminApiError(400, "ATTACHMENT_CREATE_FAILED", "方法附件元数据登记失败。");
    await recordAudit(supabase, "resource.manage", "attachment", String(data.id), "CREATE", null, data as unknown as Json);
    return serializeAttachment(data as unknown as AttachmentRow);
  } catch (error) {
    await supabase.storage.from(METHOD_STORAGE_BUCKET).remove([storagePath]);
    throw error;
  }
}
