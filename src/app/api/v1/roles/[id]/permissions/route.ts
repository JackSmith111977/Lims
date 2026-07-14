import { NextResponse } from "next/server";

import {
  AdminApiError,
  parseStringArray,
  requireAdminPermission,
  requireId,
  requireObject,
  toAdminErrorResponse,
} from "@/lib/server/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminPermission("auth.role.manage");
    const { id: rawId } = await params;
    const roleId = requireId(rawId);
    const body = requireObject(await request.json());
    const permissionCodes = parseStringArray(body.permissionCodes, "permissionCodes");

    const { error } = await supabase.rpc("set_role_permissions", {
      _role_id: roleId,
      _permission_codes: permissionCodes,
    });
    if (error) {
      if (error.code === "42501") throw new AdminApiError(403, "PERMISSION_UPDATE_FORBIDDEN", "不能移除 SYSTEM_ADMIN 的角色管理能力。");
      throw new AdminApiError(400, "PERMISSION_UPDATE_FAILED", "权限配置失败，请检查权限编码。");
    }

    return NextResponse.json({ data: { roleId, permissionCodes } });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
