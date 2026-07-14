import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminPermission, AdminRole, AdminUser } from "@/lib/admin/types";
import type { Database } from "@/types/database";

const USER_FIELDS = "id, username, real_name, department_id, status, email, last_login_at, created_at, updated_at";

export async function loadAdminUsers(supabase: SupabaseClient<Database>): Promise<AdminUser[]> {
  const [{ data: users, error: usersError }, { data: assignments, error: assignmentsError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("sys_user").select(USER_FIELDS).order("created_at", { ascending: false }),
    supabase.from("sys_user_role").select("user_id, role_id"),
    supabase.from("sys_role").select("id, code, name, status, created_at, updated_at").order("id"),
  ]);

  if (usersError || assignmentsError || rolesError) {
    throw new Error("无法读取用户管理数据。");
  }

  const roleRows = (roles ?? []) as Array<Omit<AdminRole, "permissions">>;
  const roleById = new Map(roleRows.map((role) => [role.id, role]));
  const roleByUser = new Map<string, AdminRole[]>();
  for (const assignment of assignments ?? []) {
    const role = roleById.get(assignment.role_id);
    if (!role) continue;
    const current = roleByUser.get(assignment.user_id) ?? [];
    current.push({ ...role, permissions: [] });
    roleByUser.set(assignment.user_id, current);
  }

  return ((users ?? []) as Omit<AdminUser, "roles">[]).map((user) => ({
    ...user,
    roles: roleByUser.get(user.id) ?? [],
  }));
}

export async function loadAdminRoles(supabase: SupabaseClient<Database>) {
  const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("sys_role").select("id, code, name, status, created_at, updated_at").order("id"),
    supabase.from("sys_permission").select("id, code, name, resource, action").order("code"),
    supabase.from("sys_role_permission").select("role_id, permission_id"),
  ]);

  if (rolesError || permissionsError || linksError) {
    throw new Error("无法读取角色管理数据。");
  }

  const permissionRows = (permissions ?? []) as AdminPermission[];
  const permissionById = new Map(permissionRows.map((permission) => [permission.id, permission]));
  const permissionsByRole = new Map<number, AdminPermission[]>();
  for (const link of links ?? []) {
    const permission = permissionById.get(link.permission_id);
    if (!permission) continue;
    const current = permissionsByRole.get(link.role_id) ?? [];
    current.push(permission);
    permissionsByRole.set(link.role_id, current);
  }

  return {
    roles: ((roles ?? []) as Omit<AdminRole, "permissions">[]).map((role) => ({
      ...role,
      permissions: permissionsByRole.get(role.id) ?? [],
    })),
    permissions: permissionRows,
  };
}
