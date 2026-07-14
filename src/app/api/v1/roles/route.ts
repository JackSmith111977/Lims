import { NextResponse } from "next/server";

import { serializePermission, serializeRole } from "@/lib/admin/serializers";
import {
  AdminApiError,
  recordAudit,
  requireAdminPermission,
  requireObject,
  requireText,
  toAdminErrorResponse,
} from "@/lib/server/admin";

export async function GET() {
  try {
    const { supabase } = await requireAdminPermission("auth.role.manage");
    const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }, { data: links, error: linksError }] = await Promise.all([
      supabase.from("sys_role").select("id, code, name, status, created_at, updated_at").order("id"),
      supabase.from("sys_permission").select("id, code, name, resource, action").order("code"),
      supabase.from("sys_role_permission").select("role_id, permission_id"),
    ]);

    if (rolesError || permissionsError || linksError) {
      throw new AdminApiError(500, "ROLE_LIST_FAILED", "无法读取角色管理数据。");
    }

    const permissionsById = new Map((permissions ?? []).map((permission) => [permission.id, permission]));
    const permissionsByRole = new Map<number, typeof permissions>();
    for (const link of links ?? []) {
      const permission = permissionsById.get(link.permission_id);
      if (!permission) continue;
      const current = permissionsByRole.get(link.role_id) ?? [];
      current.push(permission);
      permissionsByRole.set(link.role_id, current);
    }

    return NextResponse.json({
      data: {
        roles: (roles ?? []).map((role) => serializeRole({ ...role, permissions: permissionsByRole.get(role.id) ?? [] })),
        permissions: (permissions ?? []).map(serializePermission),
      },
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user: operator } = await requireAdminPermission("auth.role.manage");
    const body = requireObject(await request.json());
    const code = requireText(body.code, "code", 32).toUpperCase();
    const name = requireText(body.name, "name", 64);
    if (!/^[A-Z][A-Z0-9_]{2,31}$/.test(code)) {
      throw new AdminApiError(400, "INVALID_ROLE_CODE", "角色编码必须是大写字母、数字或下划线。");
    }

    const { data: role, error } = await supabase
      .from("sys_role")
      .insert({ code, name, status: "ACTIVE" })
      .select("id, code, name, status, created_at, updated_at")
      .single();
    if (error || !role) {
      if (error?.code === "23505") throw new AdminApiError(409, "ROLE_EXISTS", "角色编码已经存在。");
      throw new AdminApiError(400, "ROLE_CREATE_FAILED", "角色创建失败。");
    }

    await recordAudit(supabase, "auth.role.manage", "sys_role", String(role.id), "CREATE", null, {
      code,
      name,
      operator_id: operator.id,
    });
    return NextResponse.json({ data: serializeRole({ ...role, permissions: [] }) }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
