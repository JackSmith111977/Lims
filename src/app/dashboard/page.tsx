import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentRoles, hasPermission, ROLE_NAMES } from "@/lib/auth/permissions";
import { hasPublicSupabaseEnv } from "@/lib/env";
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
  const [canManageUsers, canManageRoles, canManageSettings, canReadPersonnel, canReadProjects, canReadTasks, canReadSamples, canReadMethods, canReadData, canReadReviews, canReadReports, canReadInstruments, canReadEnvironment] = await Promise.all([
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
  ]);

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

        <div className="mt-6 flex gap-4 text-sm">
          <Link className="text-blue-600 hover:text-blue-700" href="/">
            返回系统首页
          </Link>
          <Link className="text-blue-600 hover:text-blue-700" href="/login">
            登录页
          </Link>
          {canManageUsers ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/admin/users">
              用户管理
            </Link>
          ) : null}
          {canManageRoles ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/admin/roles">
              角色与权限
            </Link>
          ) : null}
          {canManageSettings ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/admin/settings">
              基础设置
            </Link>
          ) : null}
          {canReadPersonnel ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/personnel">
              人员档案
            </Link>
          ) : null}
          {canReadProjects ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/projects">
              科研项目
            </Link>
          ) : null}
          {canReadTasks ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/tasks">
              实验任务
            </Link>
          ) : null}
          {canReadSamples ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/samples">
              样品登记
            </Link>
          ) : null}
          {canReadMethods ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/methods">
              实验方法
            </Link>
          ) : null}
          {canReadData ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/data">
              实验数据
            </Link>
          ) : null}
          {canReadReviews ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/reviews">
              结果审核
            </Link>
          ) : null}
          {canReadReports ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/reports">
              实验报告
            </Link>
          ) : null}
          {canReadInstruments ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/instruments">
              设备档案
            </Link>
          ) : null}
          {canReadInstruments ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/inventory">
              试剂耗材
            </Link>
          ) : null}
          {canReadEnvironment ? (
            <Link className="text-blue-600 hover:text-blue-700" href="/environment">
              环境监测
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
