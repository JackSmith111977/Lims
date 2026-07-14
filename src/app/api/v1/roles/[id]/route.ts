import { NextResponse } from "next/server";

import { serializeRole } from "@/lib/admin/serializers";
import {
  AdminApiError,
  recordAudit,
  requireAdminPermission,
  requireId,
  requireObject,
  optionalText,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import type { Database } from "@/types/database";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user: operator } = await requireAdminPermission("auth.role.manage");
    const { id: rawId } = await params;
    const id = requireId(rawId);
    const body = requireObject(await request.json());
    const { data: before, error: lookupError } = await supabase
      .from("sys_role")
      .select("id, code, name, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw new AdminApiError(500, "ROLE_LOOKUP_FAILED", "无法读取角色。");
    if (!before) throw new AdminApiError(404, "ROLE_NOT_FOUND", "角色不存在。");

    const update: Database["public"]["Tables"]["sys_role"]["Update"] = {};
    const name = optionalText(body.name, "name", 64);
    if (name !== undefined) update.name = name;
    if (body.status !== undefined) {
      if (body.status !== "ACTIVE" && body.status !== "INACTIVE") {
        throw new AdminApiError(400, "INVALID_FIELD", "status 只能是 ACTIVE 或 INACTIVE。");
      }
      if (before.code === "SYSTEM_ADMIN" && body.status === "INACTIVE") {
        throw new AdminApiError(400, "SYSTEM_ROLE_LOCKED", "不能停用 SYSTEM_ADMIN 角色。");
      }
      update.status = body.status;
    }
    if (Object.keys(update).length === 0) throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的字段。");

    const { data: after, error: updateError } = await supabase
      .from("sys_role")
      .update(update)
      .eq("id", id)
      .select("id, code, name, status, created_at, updated_at")
      .single();
    if (updateError || !after) throw new AdminApiError(400, "ROLE_UPDATE_FAILED", "角色更新失败。");

    await recordAudit(supabase, "auth.role.manage", "sys_role", String(id), "UPDATE", before, {
      ...after,
      operator_id: operator.id,
    });
    return NextResponse.json({ data: serializeRole({ ...after, permissions: [] }) });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
