import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminAuditPanel } from "@/components/admin/admin-audit-panel";
import { loadAuditLogs, parseAuditFilters } from "@/lib/server/audit-data";
import { requireAdminPermission } from "@/lib/server/admin";

export default async function AdminAuditPage() {
  let context;
  try {
    context = await requireAdminPermission("audit.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-rose-600">403 · 无权访问</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">操作日志仅对授权用户开放</h1>
          <Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link>
        </section>
      </main>
    );
  }

  const logs = await loadAuditLogs(context.supabase, parseAuditFilters(new URLSearchParams()));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div><Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link><h1 className="mt-2 text-2xl font-semibold">操作日志</h1></div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">返回工作台</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8"><AdminAuditPanel initialLogs={logs} /></section>
    </main>
  );
}
