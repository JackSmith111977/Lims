import { NextResponse } from "next/server";

import { serializeUser } from "@/lib/admin/serializers";
import {
  AdminApiError,
  optionalText,
  recordAudit,
  requireAdminPermission,
  requireObject,
  requireUuid,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import type { Database } from "@/types/database";

const USER_FIELDS = "id, username, real_name, department_id, status, email, last_login_at, created_at, updated_at";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user: operator } = await requireAdminPermission("auth.user.manage");
    const { id } = await params;
    const userId = requireUuid(id);
    const body = requireObject(await request.json());

    const { data: before, error: lookupError } = await supabase
      .from("sys_user")
      .select(USER_FIELDS)
      .eq("id", userId)
      .maybeSingle();
    if (lookupError) throw new AdminApiError(500, "USER_LOOKUP_FAILED", "无法读取用户。");
    if (!before) throw new AdminApiError(404, "USER_NOT_FOUND", "用户不存在。");

    const update: Database["public"]["Tables"]["sys_user"]["Update"] = {};
    const username = optionalText(body.username, "username", 64);
    const realName = optionalText(body.realName, "realName", 64);
    if (username !== undefined) update.username = username;
    if (realName !== undefined) update.real_name = realName;
    if (body.departmentId !== undefined) {
      if (body.departmentId !== null && (!Number.isSafeInteger(body.departmentId) || Number(body.departmentId) <= 0)) {
        throw new AdminApiError(400, "INVALID_FIELD", "departmentId 格式不正确。");
      }
      update.department_id = body.departmentId as number | null;
    }
    if (body.status !== undefined) {
      if (body.status !== "ACTIVE" && body.status !== "INACTIVE") {
        throw new AdminApiError(400, "INVALID_FIELD", "status 只能是 ACTIVE 或 INACTIVE。");
      }
      if (userId === operator.id && body.status === "INACTIVE") {
        throw new AdminApiError(400, "SELF_DEACTIVATION", "不能停用当前登录用户。");
      }
      update.status = body.status;
    }
    if (Object.keys(update).length === 0) {
      throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的字段。");
    }

    const { data: after, error: updateError } = await supabase
      .from("sys_user")
      .update(update)
      .eq("id", userId)
      .select(USER_FIELDS)
      .single();
    if (updateError || !after) {
      if (updateError?.code === "23505") {
        throw new AdminApiError(409, "USERNAME_EXISTS", "用户名已经存在。");
      }
      throw new AdminApiError(400, "USER_UPDATE_FAILED", "用户更新失败。");
    }

    await recordAudit(supabase, "auth.user.manage", "sys_user", userId, "UPDATE", before, after);
    return NextResponse.json({ data: serializeUser({ ...after, roles: [] }) });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
