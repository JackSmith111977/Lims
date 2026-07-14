import type { AdminPermission, AdminRole, AdminUser } from "@/lib/admin/types";

export function serializePermission(permission: AdminPermission) {
  return {
    id: permission.id,
    code: permission.code,
    name: permission.name,
    resource: permission.resource,
    action: permission.action,
  };
}

export function serializeRole(role: AdminRole) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    status: role.status,
    createdAt: role.created_at,
    updatedAt: role.updated_at,
    permissions: role.permissions.map(serializePermission),
  };
}

export function serializeUser(user: AdminUser) {
  return {
    id: user.id,
    username: user.username,
    realName: user.real_name,
    departmentId: user.department_id,
    status: user.status,
    email: user.email,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    roles: user.roles.map(serializeRole),
  };
}
