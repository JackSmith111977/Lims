import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardNavigation, type DashboardNavigationGroup } from "@/components/dashboard/dashboard-navigation";
import { getCurrentRoles, hasPermission, ROLE_NAMES } from "@/lib/auth/permissions";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { loadDashboardOverview } from "@/lib/server/dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  if (!hasPublicSupabaseEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="rounded-lg bg-white p-6 text-sm text-slate-600 shadow-sm">
          请先配置 Supabase 环境变量。
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("sys_user")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "INACTIVE") {
    await supabase.auth.signOut();
    redirect("/login?error=user_inactive");
  }

  const roles = await getCurrentRoles(supabase);
  const [canManageUsers, canManageRoles, canManageSettings, canReadPersonnel, canReadProjects, canReadTasks, canReadSamples, canReadMethods, canReadData, canReadReviews, canReadReports, canReadInstruments, canReadEnvironment, canReadAudit] = await Promise.all([
    hasPermission(supabase, "auth.user.manage"),
    hasPermission(supabase, "auth.role.manage"),
    hasPermission(supabase, "settings.manage"),
    hasPermission(supabase, "resource.read"),
    hasPermission(supabase, "project.read"),
    hasPermission(supabase, "task.read"),
    hasPermission(supabase, "sample.read"),
    hasPermission(supabase, "resource.read"),
    hasPermission(supabase, "data.read"),
    hasPermission(supabase, "review.read"),
    hasPermission(supabase, "report.read"),
    hasPermission(supabase, "resource.read"),
    hasPermission(supabase, "resource.read"),
    hasPermission(supabase, "audit.read"),
  ]);
  const initialOverview = (canReadSamples || canReadTasks || canReadData || canReadInstruments)
    ? await loadDashboardOverview(supabase, { inventoryDays: 30 }, { sampleRead: canReadSamples, taskRead: canReadTasks, dataRead: canReadData, resourceRead: canReadInstruments })
    : null;
  const navigationGroups: DashboardNavigationGroup[] = [
    {
      id: "administration",
      title: "管理与配置",
      description: "账号、权限和系统记录",
      items: [
        ...(canManageUsers ? [{ href: "/admin/users", label: "用户管理" }] : []),
        ...(canManageRoles ? [{ href: "/admin/roles", label: "角色与权限" }] : []),
        ...(canManageSettings ? [{ href: "/admin/settings", label: "基础设置" }] : []),
        ...(canReadAudit ? [{ href: "/admin/audit", label: "操作日志" }] : []),
      ],
    },
    {
      id: "workflow",
      title: "实验流程",
      description: "从项目到数据的执行链路",
      items: [
        ...(canReadProjects ? [{ href: "/projects", label: "科研项目" }] : []),
        ...(canReadTasks ? [{ href: "/tasks", label: "实验任务" }] : []),
        ...(canReadSamples ? [{ href: "/samples", label: "样品登记" }] : []),
        ...(canReadMethods ? [{ href: "/methods", label: "实验方法" }] : []),
        ...(canReadData ? [{ href: "/data", label: "实验数据" }] : []),
      ],
    },
    {
      id: "review-report",
      title: "审核与报告",
      description: "结果确认和报告交付",
      items: [
        ...(canReadReviews ? [{ href: "/reviews", label: "结果审核" }] : []),
        ...(canReadReports ? [{ href: "/reports", label: "实验报告" }] : []),
      ],
    },
    {
      id: "resources",
      title: "资源管理",
      description: "人员、设备、库存和环境",
      items: [
        ...(canReadPersonnel ? [{ href: "/personnel", label: "人员档案" }] : []),
        ...(canReadInstruments ? [{ href: "/instruments", label: "设备档案" }] : []),
        ...(canReadInstruments ? [{ href: "/inventory", label: "试剂耗材" }] : []),
        ...(canReadEnvironment ? [{ href: "/environment", label: "环境监测" }] : []),
      ],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS</p>
            <h1 className="mt-1 text-lg font-semibold">实验室工作台</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="rounded-2xl bg-slate-900 p-8 text-white shadow-sm">
          <p className="text-sm font-medium text-blue-300">已登录</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">欢迎进入实验室工作台</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            当前已完成登录态识别、路由保护和基础角色权限接入。用户、角色和权限管理已开放给授权管理员。
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {roles.length > 0 ? roles.map((role) => (
              <span key={role} className="rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100">
                {ROLE_NAMES[role]}
              </span>
            )) : (
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs text-amber-100">
                尚未分配角色
              </span>
            )}
          </div>
        </div>

        <DashboardNavigation groups={navigationGroups} />
        {initialOverview ? <DashboardPanel initialOverview={initialOverview} /> : <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">当前账号没有可用的看板读取权限。</div>}
      </section>
    </main>
  );
}
