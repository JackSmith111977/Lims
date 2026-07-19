import { NextResponse } from "next/server";

import { serializeUser } from "@/lib/admin/serializers";
import type { AdminRole } from "@/lib/admin/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminApiError,
  parseStringArray,
  recordAudit,
  requireAdminPermission,
  requireObject,
  requireText,
  toAdminErrorResponse,
} from "@/lib/server/admin";

const USER_FIELDS = "id, username, real_name, department_id, status, email, last_login_at, created_at, updated_at";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("auth.user.manage");
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword")?.trim().toLowerCase();
    const status = url.searchParams.get("status");

    const [{ data: users, error: usersError }, { data: assignments, error: assignmentsError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("sys_user").select(USER_FIELDS).order("created_at", { ascending: false }),
      supabase.from("sys_user_role").select("user_id, role_id"),
      supabase.from("sys_role").select("id, code, name, status, created_at, updated_at").order("id"),
    ]);

    if (usersError || assignmentsError || rolesError) {
      throw new AdminApiError(500, "USER_LIST_FAILED", "无法读取用户管理数据。");
    }

    const roleById = new Map((roles ?? []).map((role) => [role.id, role]));
    const roleByUser = new Map<string, AdminRole[]>();
    for (const assignment of assignments ?? []) {
      const role = roleById.get(assignment.role_id);
      if (!role) continue;
      const current = roleByUser.get(assignment.user_id) ?? [];
      current.push({ ...role, permissions: [] });
      roleByUser.set(assignment.user_id, current);
    }

    const result = (users ?? [])
      .filter((user) => !status || user.status === status)
      .filter((user) => {
        if (!keyword) return true;
        return [user.username, user.real_name, user.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword));
      })
      .map((user) => serializeUser({ ...user, roles: roleByUser.get(user.id) ?? [] }));

    return NextResponse.json({ data: result });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let adminClient: ReturnType<typeof createAdminClient> | null = null;
  let createdUserId: string | null = null;
  try {
    const { supabase, user: operator } = await requireAdminPermission("auth.user.manage");
    const body = requireObject(await request.json());
    const email = requireText(body.email, "email", 128).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AdminApiError(400, "INVALID_EMAIL", "邮箱格式不正确。");
    }
    const password = requireText(body.password, "password", 128);
    if (password.length < 8) {
      throw new AdminApiError(400, "WEAK_PASSWORD", "密码至少需要 8 位。");
    }
    const username = requireText(body.username, "username", 64);
    const realName = requireText(body.realName, "realName", 64);
    const roleCodes = body.roleCodes === undefined ? [] : parseStringArray(body.roleCodes, "roleCodes");

    let availableRoles: Array<{ id: number; code: string }> = [];
    if (roleCodes.length > 0) {
      const { data, error: rolesError } = await supabase
        .from("sys_role")
        .select("id, code")
        .in("code", roleCodes);
      if (rolesError) {
        throw new AdminApiError(500, "ROLE_LOOKUP_FAILED", "无法校验角色。");
      }
      availableRoles = data ?? [];
    }
    if (availableRoles.length !== roleCodes.length) {
      throw new AdminApiError(400, "INVALID_ROLE", "请求中包含不存在的角色。");
    }

    try {
      adminClient = createAdminClient();
    } catch {
      throw new AdminApiError(503, "AUTH_ADMIN_NOT_CONFIGURED", "服务端尚未配置 Supabase Auth Admin 密钥。");
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, real_name: realName },
    });
    if (createError || !created.user) {
      if (createError?.message.toLowerCase().includes("already") || createError?.code === "email_exists") {
        throw new AdminApiError(409, "EMAIL_EXISTS", "该邮箱已经注册。");
      }
      throw new AdminApiError(400, "AUTH_USER_CREATE_FAILED", createError?.message ?? "无法创建 Auth 用户。");
    }
    createdUserId = created.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("sys_user")
      .upsert({
        id: created.user.id,
        username,
        real_name: realName,
        email,
      }, { onConflict: "id" })
      .select(USER_FIELDS)
      .single();
    if (profileError || !profile) {
      throw new AdminApiError(500, "PROFILE_CREATE_FAILED", "Auth 用户已创建，但业务用户资料写入失败。");
    }

    const { error: roleError } = await supabase.rpc("set_user_roles", {
      _target_user_id: created.user.id,
      _role_codes: roleCodes,
    });
    if (roleError) {
      throw new AdminApiError(400, "ROLE_ASSIGN_FAILED", "用户已创建，但角色分配失败。");
    }

    await recordAudit(supabase, "auth.user.manage", "sys_user", created.user.id, "CREATE", null, {
      email,
      username,
      real_name: realName,
      role_codes: roleCodes,
      operator_id: operator.id,
    });

    return NextResponse.json({ data: serializeUser({ ...profile, roles: [] }) }, { status: 201 });
  } catch (error) {
    if (adminClient && createdUserId) {
      await adminClient.from("sys_user").delete().eq("id", createdUserId);
      await adminClient.auth.admin.deleteUser(createdUserId);
    }
    return toAdminErrorResponse(error);
  }
}
