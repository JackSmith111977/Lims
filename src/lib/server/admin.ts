import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  hasPermission,
  type PermissionCode,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export type AdminContext = {
  supabase: SupabaseClient<Database>;
  user: User;
};

export async function requireAdminPermission(
  permission: Extract<PermissionCode, "auth.user.manage" | "auth.role.manage" | "settings.manage" | "resource.read" | "resource.manage" | "project.read" | "project.manage" | "task.read" | "task.manage" | "task.assign" | "sample.read" | "sample.manage" | "data.read" | "data.manage" | "review.read" | "review.manage" | "report.read" | "report.manage" | "report.publish">,
): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AdminApiError(401, "AUTH_REQUIRED", "请先登录。");
  }

  const { data: profile, error: profileError } = await supabase
    .from("sys_user")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new AdminApiError(500, "PROFILE_LOOKUP_FAILED", "无法读取用户状态。");
  }

  if (!profile || profile.status !== "ACTIVE") {
    throw new AdminApiError(403, "USER_INACTIVE", "当前用户已停用。");
  }

  let allowed = false;
  try {
    allowed = await hasPermission(supabase, permission);
  } catch {
    throw new AdminApiError(500, "PERMISSION_LOOKUP_FAILED", "无法校验管理权限。");
  }

  if (!allowed) {
    throw new AdminApiError(403, "FORBIDDEN", "当前用户没有执行此操作的权限。");
  }

  return { supabase, user };
}

export function toAdminErrorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器处理失败，请稍后重试。" } },
    { status: 500 },
  );
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminApiError(400, "INVALID_BODY", "请求体必须是 JSON 对象。");
  }

  return value as Record<string, unknown>;
}

export function requireText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new AdminApiError(400, "INVALID_FIELD", `${field}不能为空且长度不能超过 ${maxLength}。`);
  }

  return value.trim();
}

export function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined) return undefined;
  return requireText(value, field, maxLength);
}

export function requireUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AdminApiError(400, "INVALID_ID", "资源 ID 格式不正确。");
  }

  return value;
}

export function requireId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AdminApiError(400, "INVALID_ID", "资源 ID 格式不正确。");
  }

  return id;
}

export function parseStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new AdminApiError(400, "INVALID_FIELD", `${field}必须是字符串数组。`);
  }

  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

export async function recordAudit(
  supabase: SupabaseClient<Database>,
  permission: "auth.user.manage" | "auth.role.manage" | "settings.manage" | "resource.manage" | "project.manage" | "task.manage" | "sample.manage" | "data.manage" | "report.manage" | "report.publish",
  objectType: string,
  objectId: string,
  action: string,
  beforeJson: Json | null,
  afterJson: Json | null,
) {
  const { error } = await supabase.rpc("record_audit_event", {
    _required_permission: permission,
    _object_type: objectType,
    _object_id: objectId,
    _action: action,
    _before_json: beforeJson,
    _after_json: afterJson,
  });

  if (error) {
    throw new AdminApiError(500, "AUDIT_WRITE_FAILED", "操作成功但审计记录写入失败。");
  }
}
