import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminApiError, requireId, requireObject, requireText } from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

export const ENVIRONMENT_SOURCE_TYPES = ["MANUAL", "SENSOR", "API"] as const;
export const ENVIRONMENT_STATUSES = ["NORMAL", "WARNING", "EXCEEDED"] as const;
export const ENVIRONMENT_THRESHOLD_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const ENVIRONMENT_LAB_FIELDS = "id, code, name, status";
export const ENVIRONMENT_THRESHOLD_FIELDS = "id, laboratory_id, metric, unit, threshold_min, threshold_max, status, created_at, updated_at";
export const ENVIRONMENT_RECORD_FIELDS = "id, laboratory_id, metric, value, unit, threshold_min, threshold_max, collected_at, source_type, recorded_by, status";

type LaboratoryRow = Pick<Database["public"]["Tables"]["lab_laboratory"]["Row"], "id" | "code" | "name" | "status">;
type EnvironmentThresholdRow = Database["public"]["Tables"]["environment_threshold"]["Row"];
type EnvironmentRecordRow = Database["public"]["Tables"]["environment_record"]["Row"];

export type EnvironmentLaboratoryView = { id: number; code: string; name: string; status: string };
export type EnvironmentThresholdView = {
  id: number;
  laboratoryId: number;
  metric: string;
  unit: string;
  thresholdMin: number | null;
  thresholdMax: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};
export type EnvironmentRecordView = {
  id: number;
  laboratoryId: number;
  metric: string;
  value: number;
  unit: string;
  thresholdMin: number | null;
  thresholdMax: number | null;
  collectedAt: string;
  sourceType: string;
  recordedBy: string | null;
  status: string;
};
export type EnvironmentAlertView = EnvironmentRecordView & { laboratoryCode: string; laboratoryName: string };

function serializeLaboratory(row: LaboratoryRow): EnvironmentLaboratoryView {
  return { id: row.id, code: row.code, name: row.name, status: row.status };
}

function serializeThreshold(row: EnvironmentThresholdRow): EnvironmentThresholdView {
  return {
    id: row.id,
    laboratoryId: row.laboratory_id,
    metric: row.metric,
    unit: row.unit,
    thresholdMin: row.threshold_min,
    thresholdMax: row.threshold_max,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeRecord(row: EnvironmentRecordRow): EnvironmentRecordView {
  return {
    id: row.id,
    laboratoryId: row.laboratory_id,
    metric: row.metric,
    value: row.value,
    unit: row.unit,
    thresholdMin: row.threshold_min,
    thresholdMax: row.threshold_max,
    collectedAt: row.collected_at,
    sourceType: row.source_type,
    recordedBy: row.recorded_by,
    status: row.status,
  };
}

function parseNumber(value: unknown, field: string, { nullable = false } = {}) {
  if (nullable && (value === undefined || value === null || value === "")) return null;
  const number = typeof value === "number" ? value : Number(typeof value === "string" ? value.trim() : NaN);
  if (!Number.isFinite(number) || Math.abs(number) > 999999999999) throw new AdminApiError(400, "INVALID_ENVIRONMENT_VALUE", `${field} must be a finite number.`);
  if (Math.round(number * 100000000) / 100000000 !== number) throw new AdminApiError(400, "INVALID_ENVIRONMENT_VALUE", `${field} supports at most eight decimal places.`);
  return number;
}

function parseTimestamp(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new AdminApiError(400, "INVALID_ENVIRONMENT_TIME", "collectedAt must be a valid ISO timestamp.");
  return new Date(value).toISOString();
}

export function buildEnvironmentThresholdPayload(bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  const payload: Record<string, Json> = {};
  if (!update || body.laboratoryId !== undefined) payload.laboratory_id = requireId(String(body.laboratoryId));
  if (!update || body.metric !== undefined) payload.metric = requireText(body.metric, "metric", 64);
  if (!update || body.unit !== undefined) payload.unit = requireText(body.unit, "unit", 16);
  if (!update || body.thresholdMin !== undefined) payload.threshold_min = parseNumber(body.thresholdMin, "thresholdMin", { nullable: true });
  if (!update || body.thresholdMax !== undefined) payload.threshold_max = parseNumber(body.thresholdMax, "thresholdMax", { nullable: true });
  if (body.status !== undefined) {
    const status = requireText(body.status, "status", 16).toUpperCase();
    if (!ENVIRONMENT_THRESHOLD_STATUSES.includes(status as (typeof ENVIRONMENT_THRESHOLD_STATUSES)[number])) throw new AdminApiError(400, "INVALID_ENVIRONMENT_STATUS", "status must be ACTIVE or INACTIVE.");
    payload.status = status;
  }
  for (const field of ["id", "createdAt", "updatedAt"]) {
    if (body[field] !== undefined) throw new AdminApiError(400, "INVALID_ENVIRONMENT_FIELD", `${field} is generated by the server.`);
  }
  if (update && Object.keys(payload).length === 0) throw new AdminApiError(400, "EMPTY_UPDATE", "No editable threshold fields supplied.");
  return payload;
}

export function buildEnvironmentRecordPayload(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  for (const field of ["id", "recordedBy", "status", "thresholdMin", "thresholdMax"]) {
    if (body[field] !== undefined) throw new AdminApiError(400, "INVALID_ENVIRONMENT_FIELD", `${field} is generated by the server.`);
  }
  const sourceType = requireText(body.sourceType ?? "MANUAL", "sourceType", 16).toUpperCase();
  if (!ENVIRONMENT_SOURCE_TYPES.includes(sourceType as (typeof ENVIRONMENT_SOURCE_TYPES)[number])) throw new AdminApiError(400, "INVALID_ENVIRONMENT_SOURCE", "Unsupported environment source type.");
  return {
    laboratory_id: requireId(String(body.laboratoryId)),
    metric: requireText(body.metric, "metric", 64),
    value: parseNumber(body.value, "value"),
    unit: requireText(body.unit, "unit", 16),
    source_type: sourceType,
    collected_at: parseTimestamp(body.collectedAt) ?? null,
  };
}

function mapEnvironmentError(error: { code?: string; message?: string }, fallback: string): never {
  const message = error.message ?? "";
  const lowered = message.toLowerCase();
  if (error.code === "42501" || lowered.includes("permission denied")) throw new AdminApiError(403, "ENVIRONMENT_PERMISSION_DENIED", "Current user cannot manage environment records.");
  if (error.code === "P0002" || lowered.includes("not found")) throw new AdminApiError(404, "ENVIRONMENT_NOT_FOUND", "The environment resource does not exist.");
  if (error.code === "23505") throw new AdminApiError(409, "ENVIRONMENT_THRESHOLD_EXISTS", "An active threshold for this laboratory metric already exists.");
  if (error.code === "55000") throw new AdminApiError(409, "ENVIRONMENT_CONFLICT", "The environment resource is not writable in its current state.");
  if (error.code === "22023" || error.code === "23514" || error.code === "23502" || error.code === "23503") throw new AdminApiError(400, "INVALID_ENVIRONMENT", "Environment fields or thresholds are invalid.");
  throw new AdminApiError(400, fallback, "Environment operation failed.");
}

export async function loadEnvironmentLaboratories(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("lab_laboratory").select(ENVIRONMENT_LAB_FIELDS).eq("status", "ACTIVE").order("code", { ascending: true });
  if (error) throw new AdminApiError(500, "ENVIRONMENT_LAB_LOOKUP_FAILED", "Unable to read laboratories.");
  return ((data ?? []) as unknown as LaboratoryRow[]).map(serializeLaboratory);
}

export async function loadEnvironmentThresholds(supabase: SupabaseClient<Database>, laboratoryId?: string | null) {
  let query = supabase.from("environment_threshold").select(ENVIRONMENT_THRESHOLD_FIELDS).order("metric", { ascending: true }).order("unit", { ascending: true });
  if (laboratoryId) query = query.eq("laboratory_id", requireId(laboratoryId));
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "ENVIRONMENT_THRESHOLD_LOOKUP_FAILED", "Unable to read environment thresholds.");
  return ((data ?? []) as unknown as EnvironmentThresholdRow[]).map(serializeThreshold);
}

export async function loadEnvironmentRecords(supabase: SupabaseClient<Database>, filters: { laboratoryId?: string | null; metric?: string | null; status?: string | null } = {}) {
  if (filters.status && !ENVIRONMENT_STATUSES.includes(filters.status as (typeof ENVIRONMENT_STATUSES)[number])) throw new AdminApiError(400, "INVALID_ENVIRONMENT_STATUS", "Unsupported environment status.");
  let query = supabase.from("environment_record").select(ENVIRONMENT_RECORD_FIELDS).order("collected_at", { ascending: false }).limit(100);
  if (filters.laboratoryId) query = query.eq("laboratory_id", requireId(filters.laboratoryId));
  if (filters.metric) query = query.eq("metric", filters.metric);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "ENVIRONMENT_RECORD_LOOKUP_FAILED", "Unable to read environment records.");
  return ((data ?? []) as unknown as EnvironmentRecordRow[]).map(serializeRecord);
}

export async function loadEnvironmentAlerts(supabase: SupabaseClient<Database>, days = 30, laboratoryId?: string | null) {
  if (!Number.isSafeInteger(days) || days < 0 || days > 365) throw new AdminApiError(400, "INVALID_ENVIRONMENT_ALERT_WINDOW", "days must be between 0 and 365.");
  const { data, error } = await supabase.rpc("get_environment_alerts", { _days: days, _laboratory_id: laboratoryId ? requireId(laboratoryId) : null });
  if (error) throw new AdminApiError(500, "ENVIRONMENT_ALERT_LOOKUP_FAILED", "Unable to read environment alerts.");
  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
  return rows.map((row) => ({
    ...serializeRecord(row as unknown as EnvironmentRecordRow),
    laboratoryCode: String(row.laboratory_code),
    laboratoryName: String(row.laboratory_name),
  } satisfies EnvironmentAlertView));
}

export async function saveEnvironmentThreshold(supabase: SupabaseClient<Database>, idValue: string | null, bodyValue: unknown) {
  const id = idValue ? requireId(idValue) : 0;
  const payload = buildEnvironmentThresholdPayload(bodyValue, Boolean(id));
  const { data, error } = await supabase.rpc("save_environment_threshold", { _threshold_id: id, _payload: payload });
  if (error) mapEnvironmentError(error, "ENVIRONMENT_THRESHOLD_SAVE_FAILED");
  const row = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, Json | undefined> : null;
  if (!row || typeof row.id !== "number") throw new AdminApiError(500, "ENVIRONMENT_THRESHOLD_SAVE_FAILED", "Threshold save returned no record.");
  return serializeThreshold(row as unknown as EnvironmentThresholdRow);
}

export async function recordEnvironmentReading(supabase: SupabaseClient<Database>, bodyValue: unknown) {
  const payload = buildEnvironmentRecordPayload(bodyValue);
  const { data, error } = await supabase.rpc("record_environment_reading", { _payload: payload });
  if (error) mapEnvironmentError(error, "ENVIRONMENT_RECORD_CREATE_FAILED");
  const row = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, Json | undefined> : null;
  if (!row || typeof row.id !== "number") throw new AdminApiError(500, "ENVIRONMENT_RECORD_CREATE_FAILED", "Environment record returned no record.");
  return serializeRecord(row as unknown as EnvironmentRecordRow);
}
