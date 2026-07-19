import { isIP } from "node:net";

import { AdminApiError } from "@/lib/server/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

export const AUTH_AUDIT_ACTIONS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGIN_BLOCKED",
  "LOGOUT",
] as const;

export type AuthAuditAction = (typeof AUTH_AUDIT_ACTIONS)[number];

export type SystemAuditEvent = {
  action: AuthAuditAction;
  objectId: string;
  operatorId: string | null;
  afterJson: Json;
  request?: Request;
};

export function normalizeAuditEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 320);
}

export function getRequestIp(request?: Request) {
  if (!request) return undefined;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim();
  if (!candidate || candidate.length > 45 || isIP(candidate) === 0) {
    return undefined;
  }

  return candidate;
}

function toSafeAuditPayload(value: Json): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const payload = value as Record<string, Json | undefined>;
  const safePayload: Record<string, Json> = {};

  for (const key of ["result", "reason", "email", "ipAddress"]) {
    const entry = payload[key];
    if (typeof entry === "string" && entry.length <= 320) {
      safePayload[key] = entry;
    }
  }

  return safePayload;
}

export async function recordSystemAudit(event: SystemAuditEvent) {
  const admin = createAdminClient();
  const safePayload = toSafeAuditPayload(event.afterJson);
  const ipAddress = getRequestIp(event.request);
  if (ipAddress) {
    (safePayload as Record<string, Json>).ipAddress = ipAddress;
  }

  const insert: Database["public"]["Tables"]["audit_log"]["Insert"] = {
    operator_id: event.operatorId,
    object_type: "auth",
    object_id: event.objectId,
    action: event.action,
    before_json: null,
    after_json: safePayload,
    ...(ipAddress ? { ip_address: ipAddress } : {}),
  };

  const { error } = await admin.from("audit_log").insert(insert);
  if (error) {
    throw new AdminApiError(503, "AUDIT_WRITE_FAILED", "审计日志写入失败，请稍后重试。");
  }
}
