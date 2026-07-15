import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminApiError, requireUuid } from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const SENSITIVE_AUDIT_KEYS = /^(?:password|passcode|token|access_token|refresh_token|secret|api_key|apikey|authorization)$/i;

export type AuditLogFilters = {
  objectType?: string;
  action?: string;
  operatorId?: string;
  from?: string;
  to?: string;
  limit: number;
};

export type AuditLogView = {
  id: number;
  operatorId: string | null;
  objectType: string;
  objectId: string;
  action: string;
  beforeJson: Json | null;
  afterJson: Json | null;
  ipAddress: string | null;
  occurredAt: string;
};

export function redactAuditJson(value: Json | null): Json | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => redactAuditJson(item));
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !SENSITIVE_AUDIT_KEYS.test(key)).map(([key, entry]) => [key, redactAuditJson(entry ?? null)]),
  );
}

function parseBoundedText(search: URLSearchParams, key: string, maxLength: number) {
  const value = search.get(key)?.trim();
  if (!value) return undefined;
  if (value.length > maxLength) {
    throw new AdminApiError(400, "INVALID_QUERY", `${key} 超过长度限制。`);
  }
  return value;
}

function parseDate(search: URLSearchParams, key: "from" | "to") {
  const value = search.get(key)?.trim();
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminApiError(400, "INVALID_QUERY", `${key} 必须是有效时间。`);
  }
  return date.toISOString();
}

export function parseAuditFilters(search: URLSearchParams): AuditLogFilters {
  const limitValue = search.get("limit");
  const limit = limitValue === null || limitValue.trim() === "" ? DEFAULT_LIMIT : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new AdminApiError(400, "INVALID_QUERY", `limit 必须是 1-${MAX_LIMIT} 之间的整数。`);
  }

  const operatorId = parseBoundedText(search, "operatorId", 36);
  if (operatorId) requireUuid(operatorId);

  return {
    objectType: parseBoundedText(search, "objectType", 32),
    action: parseBoundedText(search, "action", 64),
    operatorId,
    from: parseDate(search, "from"),
    to: parseDate(search, "to"),
    limit,
  };
}

function toAuditLogView(row: Database["public"]["Tables"]["audit_log"]["Row"]): AuditLogView {
  return {
    id: row.id,
    operatorId: row.operator_id,
    objectType: row.object_type,
    objectId: row.object_id,
    action: row.action,
    beforeJson: redactAuditJson(row.before_json),
    afterJson: redactAuditJson(row.after_json),
    ipAddress: typeof row.ip_address === "string" ? row.ip_address : null,
    occurredAt: row.occurred_at,
  };
}

export async function loadAuditLogs(
  supabase: SupabaseClient<Database>,
  filters: AuditLogFilters,
): Promise<AuditLogView[]> {
  let query = supabase
    .from("audit_log")
    .select("id, operator_id, object_type, object_id, action, before_json, after_json, ip_address, occurred_at")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(filters.limit);

  if (filters.objectType) query = query.eq("object_type", filters.objectType);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.operatorId) query = query.eq("operator_id", filters.operatorId);
  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lte("occurred_at", filters.to);

  const { data, error } = await query;
  if (error) {
    throw new AdminApiError(500, "AUDIT_READ_FAILED", "无法读取审计日志。");
  }

  return (data ?? []).map((row) => toAuditLogView(row));
}
