import Link from "next/link";
import { redirect } from "next/navigation";

import { ExperimentDataPanel } from "@/components/experiment-data/experiment-data-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadTasks } from "@/lib/server/task-registration";

export default async function DataPage() {
  let context;
  try {
    context = await requireAdminPermission("data.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-rose-600">403 / 无权访问</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">实验数据仅对授权用户开放</h1>
          <Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link>
        </section>
      </main>
    );
  }

  const [tasks, canManage] = await Promise.all([
    loadTasks(context.supabase),
    hasPermission(context.supabase, "data.manage"),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link>
            <h1 className="mt-2 text-2xl font-semibold">实验数据与结果录入</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">返回工作台</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          原始数据、处理数据和最终结果以不同记录保存；原始数据不会被后续处理值覆盖。任务审核通过或归档后不能新增数据。
        </div>
        <ExperimentDataPanel initialTasks={tasks} canManage={canManage} />
      </section>
    </main>
  );
}
