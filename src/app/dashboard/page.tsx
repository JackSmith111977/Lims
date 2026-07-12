import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentRoles, ROLE_NAMES } from "@/lib/auth/permissions";
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

  const roles = await getCurrentRoles(supabase);

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
            当前已完成登录态识别和路由保护。角色、权限和业务模块将在数据库迁移验证后接入。
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
        </div>
      </section>
    </main>
  );
}
