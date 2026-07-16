import type { User } from "@supabase/supabase-js";

import { hasPermission } from "@/lib/auth/permissions";
import { AdminApiError, type AdminContext } from "@/lib/server/admin";
import type { DashboardPermissions } from "@/lib/server/dashboard";
import { createClient } from "@/lib/supabase/server";

export type DashboardContext = AdminContext & { permissions: DashboardPermissions };

export async function requireDashboardContext(): Promise<DashboardContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new AdminApiError(401, "AUTH_REQUIRED", "请先登录。");

  const { data: profile, error: profileError } = await supabase
    .from("sys_user")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new AdminApiError(500, "PROFILE_LOOKUP_FAILED", "无法读取用户状态。");
  if (!profile || profile.status !== "ACTIVE") throw new AdminApiError(403, "USER_INACTIVE", "当前用户已停用。");

  let permissions: DashboardPermissions;
  try {
    const [sampleRead, taskRead, dataRead, resourceRead] = await Promise.all([
      hasPermission(supabase, "sample.read"),
      hasPermission(supabase, "task.read"),
      hasPermission(supabase, "data.read"),
      hasPermission(supabase, "resource.read"),
    ]);
    permissions = { sampleRead, taskRead, dataRead, resourceRead };
  } catch {
    throw new AdminApiError(500, "PERMISSION_LOOKUP_FAILED", "无法校验看板权限。");
  }

  return { supabase, user: user as User, permissions };
}

export function requireDashboardPermission(context: DashboardContext, permission: "task.read" | "resource.read") {
  const allowed = permission === "task.read" ? context.permissions.taskRead : context.permissions.resourceRead;
  if (!allowed) throw new AdminApiError(403, "FORBIDDEN", "当前用户没有执行此操作的权限。");
}
