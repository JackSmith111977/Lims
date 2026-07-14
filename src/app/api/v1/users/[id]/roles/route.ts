import { NextResponse } from "next/server";

import {
  AdminApiError,
  parseStringArray,
  requireAdminPermission,
  requireObject,
  requireUuid,
  toAdminErrorResponse,
} from "@/lib/server/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminPermission("auth.role.manage");
    const { id } = await params;
    const userId = requireUuid(id);
    const body = requireObject(await request.json());
    const roleCodes = parseStringArray(body.roleCodes, "roleCodes");

    const { error } = await supabase.rpc("set_user_roles", {
      _target_user_id: userId,
      _role_codes: roleCodes,
    });
    if (error) {
      if (error.code === "42501") throw new AdminApiError(403, "ROLE_UPDATE_FORBIDDEN", "不能移除当前管理员的管理能力。");
      throw new AdminApiError(400, "ROLE_UPDATE_FAILED", "角色分配失败，请检查角色编码。");
    }

    return NextResponse.json({ data: { userId, roleCodes } });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
