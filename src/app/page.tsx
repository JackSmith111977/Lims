import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const modules = [
  { name: "样品管理", description: "登记、编号和状态追踪", status: "待接入" },
  { name: "实验任务", description: "任务分配、执行和状态流转", status: "待接入" },
  { name: "数据审核", description: "原始数据、处理结果和审核记录", status: "待接入" },
  { name: "设备与库存", description: "仪器档案、维护和库存变化", status: "待接入" },
];

export default async function Home() {
  let userEmail: string | null = null;

  if (hasPublicSupabaseEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userEmail = data.user?.email ?? null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS</p>
            <h1 className="mt-1 text-lg font-semibold">实验室信息管理系统</h1>
          </div>
          {userEmail ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-500 sm:inline">{userEmail}</span>
              <LogoutButton />
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
            >
              进入工作台
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">工作台</p>
          <nav className="mt-3 space-y-1 text-sm">
            <a className="block rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-700" href="#overview">
              总览
            </a>
            <a className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50" href="#modules">
              业务模块
            </a>
            <a className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50" href="#next-step">
              开发进度
            </a>
          </nav>
        </aside>

        <section className="space-y-8">
          <div id="overview" className="rounded-2xl bg-slate-900 p-8 text-white shadow-sm">
            <p className="text-sm font-medium text-blue-300">实验室工作台</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              让样品、任务、数据和报告在同一条可追溯链路上协同流转。
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              当前版本完成项目骨架、Supabase 认证基础设施和核心数据库迁移设计，后续将按 Spec 逐步接入业务模块。
            </p>
          </div>

          <div id="modules" className="grid gap-4 sm:grid-cols-2">
            {modules.map((module) => (
              <article key={module.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-semibold">{module.name}</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{module.status}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{module.description}</p>
              </article>
            ))}
          </div>

          <div id="next-step" className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <h3 className="font-semibold text-blue-950">当前开发阶段</h3>
            <p className="mt-2 text-sm leading-6 text-blue-900/70">
              下一步配置 Supabase 项目环境变量，验证数据库迁移，然后实现登录、角色权限和路由保护。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
