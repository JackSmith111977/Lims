import Link from "next/link";
import { redirect } from "next/navigation";

import { TraceabilityPanel } from "@/components/reporting/traceability-panel";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadReportTrace } from "@/lib/server/traceability";

export default async function ReportTracePage({ params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    context = await requireAdminPermission("report.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"><section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-semibold text-rose-600">403 / 无权访问</p><h1 className="mt-2 text-2xl font-semibold">报告追溯仅对授权人员开放</h1><Link className="mt-6 inline-block text-sm text-blue-600" href="/reports">返回报告页</Link></section></main>;
  }

  const { id } = await params;
  const trace = await loadReportTrace(context.supabase, "report", id);
  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8"><div><Link href="/reports" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 报告</Link><h1 className="mt-2 text-2xl font-semibold">报告追溯</h1></div><Link href="/reports" className="text-sm text-slate-500 hover:text-slate-700">返回报告页</Link></div></header><section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">以下内容来自报告生成时固化的不可变快照，用于回查任务、样品、实验数据和审核记录。</div><TraceabilityPanel trace={trace} /></section></main>;
}
