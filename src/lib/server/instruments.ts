import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminApiError,
  requireId,
  requireObject,
  requireText,
  requireUuid,
} from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

export const INSTRUMENT_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "SCRAPPED"] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];
export const INSTRUMENT_FIELDS = "id, instrument_code, name, type, model, manufacturer, location, owner_id, status, commissioned_at, next_calibration_at, created_at, updated_at";

type InstrumentRow = Database["public"]["Tables"]["instrument"]["Row"];
type DataUsageRow = Pick<Database["public"]["Tables"]["experiment_data"]["Row"], "instrument_id" | "collected_at">;

export type InstrumentView = {
  id: number;
  instrumentCode: string;
  name: string;
  type: string;
  model: string | null;
  manufacturer: string | null;
  location: string | null;
  ownerId: string | null;
  status: string;
  commissionedAt: string | null;
  nextCalibrationAt: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt: string | null;
};

function serializeInstrument(row: InstrumentRow, usageCount = 0, lastUsedAt: string | null = null): InstrumentView {
  return {
    id: row.id,
    instrumentCode: row.instrument_code,
    name: row.name,
    type: row.type,
    model: row.model,
    manufacturer: row.manufacturer,
    location: row.location,
    ownerId: row.owner_id,
    status: row.status,
    commissionedAt: row.commissioned_at,
    nextCalibrationAt: row.next_calibration_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount,
    lastUsedAt,
  };
}

function parseOptionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return requireText(value, field, maxLength);
}

function parseDate(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminApiError(400, "INVALID_INSTRUMENT_DATE", `${field} 必须是 YYYY-MM-DD 日期。`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AdminApiError(400, "INVALID_INSTRUMENT_DATE", `${field} 不是有效日期。`);
  }
  return value;
}

function parseStatus(value: unknown, update: boolean) {
  if (value === undefined) return undefined;
  const status = requireText(value, "status", 16).toUpperCase();
  if (!INSTRUMENT_STATUSES.includes(status as InstrumentStatus)) throw new AdminApiError(400, "INVALID_INSTRUMENT_STATUS", "设备状态不受支持。");
  if (!update && !["ACTIVE", "INACTIVE"].includes(status)) throw new AdminApiError(400, "INVALID_INSTRUMENT_STATUS", "新建设备只能为 ACTIVE 或 INACTIVE。");
  return status;
}

export function buildInstrumentPayload(bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  for (const field of ["id", "createdAt", "updatedAt", "nextCalibrationAt", "usageCount", "lastUsedAt"]) {
    if (body[field] !== undefined) throw new AdminApiError(400, "INVALID_INSTRUMENT_FIELD", `${field} 由服务端或 T-402 流程生成。`);
  }
  if (update && body.instrumentCode !== undefined) throw new AdminApiError(409, "INSTRUMENT_IDENTITY_IMMUTABLE", "设备编号创建后不能修改。");
  if (update && body.commissionedAt !== undefined) throw new AdminApiError(409, "INSTRUMENT_LIFECYCLE_IMMUTABLE", "启用日期由设备生命周期流程维护。");

  const payload: Record<string, Json> = {};
  if (!update || body.instrumentCode !== undefined) payload.instrument_code = requireText(body.instrumentCode, "instrumentCode", 32);
  if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
  if (!update || body.type !== undefined) payload.type = requireText(body.type, "type", 64);
  for (const [input, output, maxLength] of [["model", "model", 64], ["manufacturer", "manufacturer", 128], ["location", "location", 128]] as const) {
    const value = parseOptionalText(body[input], input, maxLength);
    if (value !== undefined) payload[output] = value;
  }
  if (body.ownerId !== undefined) payload.owner_id = body.ownerId === null || body.ownerId === "" ? null : requireUuid(String(body.ownerId));
  const status = parseStatus(body.status, update);
  if (status !== undefined) payload.status = status;
  if (!update) {
    const commissionedAt = parseDate(body.commissionedAt, "commissionedAt");
    if (commissionedAt !== undefined) payload.commissioned_at = commissionedAt;
  }
  if (update && Object.keys(payload).length === 0) throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的设备档案字段。");
  return payload;
}

function mapInstrumentError(error: { code?: string; message?: string }, fallback: string): never {
  const message = error.message ?? "";
  if (error.code === "42501" || message.toLowerCase().includes("permission denied")) throw new AdminApiError(403, "INSTRUMENT_PERMISSION_DENIED", "当前用户没有设备管理权限。");
  if (error.code === "P0002" || message.toLowerCase().includes("not found")) throw new AdminApiError(404, "INSTRUMENT_NOT_FOUND", "设备不存在。");
  if (error.code === "23505") throw new AdminApiError(409, "INSTRUMENT_CODE_EXISTS", "设备编号已经存在。");
  if (error.code === "55000" || message.toLowerCase().includes("scrapped")) throw new AdminApiError(409, "INSTRUMENT_SCRAPPED", "已报废设备不能恢复或继续使用。");
  if (error.code === "22023") throw new AdminApiError(400, "INVALID_INSTRUMENT", "设备档案字段或状态不合法。");
  throw new AdminApiError(400, fallback, "设备档案操作失败。");
}

async function loadUsage(supabase: SupabaseClient<Database>, instrumentIds: number[]) {
  if (instrumentIds.length === 0) return new Map<number, { count: number; lastUsedAt: string | null }>();
  const { data, error } = await supabase.from("experiment_data").select("instrument_id, collected_at").in("instrument_id", instrumentIds);
  if (error) throw new AdminApiError(500, "INSTRUMENT_USAGE_LOOKUP_FAILED", "无法读取设备使用记录。");
  const usage = new Map<number, { count: number; lastUsedAt: string | null }>();
  for (const row of ((data ?? []) as unknown as DataUsageRow[])) {
    if (row.instrument_id === null) continue;
    const current = usage.get(row.instrument_id) ?? { count: 0, lastUsedAt: null };
    current.count += 1;
    if (!current.lastUsedAt || row.collected_at > current.lastUsedAt) current.lastUsedAt = row.collected_at;
    usage.set(row.instrument_id, current);
  }
  return usage;
}

export async function loadInstruments(supabase: SupabaseClient<Database>, filters: { keyword?: string | null; status?: string | null } = {}) {
  if (filters.status && !INSTRUMENT_STATUSES.includes(filters.status as InstrumentStatus)) throw new AdminApiError(400, "INVALID_INSTRUMENT_STATUS", "设备状态不受支持。");
  let query = supabase.from("instrument").select(INSTRUMENT_FIELDS).order("instrument_code", { ascending: true });
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "INSTRUMENT_LOOKUP_FAILED", "无法读取设备档案。");
  const keyword = filters.keyword?.trim().toLowerCase() ?? "";
  const rows = ((data ?? []) as unknown as InstrumentRow[]).filter((row) => !keyword || `${row.instrument_code} ${row.name} ${row.type} ${row.model ?? ""} ${row.manufacturer ?? ""} ${row.location ?? ""}`.toLowerCase().includes(keyword));
  const usage = await loadUsage(supabase, rows.map((row) => row.id));
  return rows.map((row) => serializeInstrument(row, usage.get(row.id)?.count ?? 0, usage.get(row.id)?.lastUsedAt ?? null));
}

export async function loadInstrumentDetail(supabase: SupabaseClient<Database>, idValue: string) {
  const id = requireId(idValue);
  const { data, error } = await supabase.from("instrument").select(INSTRUMENT_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new AdminApiError(500, "INSTRUMENT_LOOKUP_FAILED", "无法读取设备档案。");
  if (!data) throw new AdminApiError(404, "INSTRUMENT_NOT_FOUND", "设备不存在。");
  const usage = await loadUsage(supabase, [id]);
  return serializeInstrument(data as unknown as InstrumentRow, usage.get(id)?.count ?? 0, usage.get(id)?.lastUsedAt ?? null);
}

async function resolveInstrument(supabase: SupabaseClient<Database>, data: Json | null, fallback: string) {
  const id = data && typeof data === "object" && !Array.isArray(data) && typeof data.id === "number" ? data.id : null;
  if (!id) throw new AdminApiError(500, fallback, "设备操作未返回有效设备。");
  return loadInstrumentDetail(supabase, String(id));
}

export async function createInstrument(supabase: SupabaseClient<Database>, bodyValue: unknown) {
  const payload = buildInstrumentPayload(bodyValue);
  const { data, error } = await supabase.rpc("create_instrument", { _payload: payload });
  if (error) mapInstrumentError(error, "INSTRUMENT_CREATE_FAILED");
  return resolveInstrument(supabase, data, "INSTRUMENT_CREATE_FAILED");
}

export async function updateInstrument(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const id = requireId(idValue);
  const payload = buildInstrumentPayload(bodyValue, true);
  const { data, error } = await supabase.rpc("update_instrument", { _instrument_id: id, _payload: payload });
  if (error) mapInstrumentError(error, "INSTRUMENT_UPDATE_FAILED");
  return resolveInstrument(supabase, data, "INSTRUMENT_UPDATE_FAILED");
}
