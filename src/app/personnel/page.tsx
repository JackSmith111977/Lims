import Link from "next/link";
import { redirect } from "next/navigation";

import { PersonnelPanel } from "@/components/personnel/personnel-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadPersonnelList } from "@/lib/server/personnel";

export default async function PersonnelPage() {
  let context;
  try {
    context = await requireAdminPermission("resource.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-rose-600">403 / 无权访问</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">人员档案仅对实验室资源查看者开放</h1>
          <Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link>
        </section>
      </main>
    );
  }

  const [personnel, canManage] = await Promise.all([
    loadPersonnelList(context.supabase),
    hasPermission(context.supabase, "resource.manage"),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link>
            <h1 className="mt-2 text-2xl font-semibold">实验室人员档案</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">返回工作台</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          人员账户登录状态与业务可用状态分开管理。任务状态为当前有效分配的只读摘要；岗位、能力记录和可用状态变更会写入审计日志。
        </div>
        <PersonnelPanel initialPersonnel={personnel} canManage={canManage} />
      </section>
    </main>
  );
}
