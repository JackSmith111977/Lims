import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const ROLE_CODES = [
  "SYSTEM_ADMIN",
  "LAB_ADMIN",
  "RESEARCHER",
  "PROJECT_OWNER",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_NAMES: Record<RoleCode, string> = {
  SYSTEM_ADMIN: "系统管理员",
  LAB_ADMIN: "实验室管理员",
  RESEARCHER: "实验人员",
  PROJECT_OWNER: "项目负责人/教师",
};

export type PermissionCode =
  | "auth.user.manage"
  | "auth.role.manage"
  | "laboratory.read"
  | "laboratory.manage"
  | "project.read"
  | "project.manage"
  | "sample.read"
  | "sample.manage"
  | "task.read"
  | "task.manage"
  | "task.assign"
  | "data.read"
  | "data.manage"
  | "review.read"
  | "review.manage"
  | "report.read"
  | "report.manage"
  | "report.publish"
  | "resource.read"
  | "resource.manage"
  | "audit.read"
  | "settings.manage";

type TypedClient = SupabaseClient<Database>;

export async function hasRole(client: TypedClient, roleCode: RoleCode) {
  const { data, error } = await client.rpc("has_role", {
    _role_code: roleCode,
  });

  if (error) {
    throw new Error(`Failed to resolve role ${roleCode}: ${error.message}`);
  }

  return data;
}

export async function hasPermission(client: TypedClient, permissionCode: PermissionCode) {
  const { data, error } = await client.rpc("has_permission", {
    _permission_code: permissionCode,
  });

  if (error) {
    throw new Error(`Failed to resolve permission ${permissionCode}: ${error.message}`);
  }

  return data;
}

export async function getCurrentRoles(client: TypedClient) {
  const roleResults = await Promise.all(
    ROLE_CODES.map(async (roleCode) => ({
      roleCode,
      assigned: await hasRole(client, roleCode),
    })),
  );

  return roleResults.filter((role) => role.assigned).map((role) => role.roleCode);
}
