import Link from "next/link";
import { redirect } from "next/navigation";

import { ResultReviewPanel } from "@/components/result-review/result-review-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadTasks } from "@/lib/server/task-registration";

export default async function ReviewsPage() {
  let context;
  try {
    context = await requireAdminPermission("review.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"><section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-semibold text-rose-600">403 / 无权访问</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">结果审核仅对授权人员开放</h1><Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link></section></main>;
  }

  const [tasks, canManage] = await Promise.all([
    loadTasks(context.supabase, { status: "PENDING_REVIEW" }),
    hasPermission(context.supabase, "review.manage"),
  ]);

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8"><div><Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link><h1 className="mt-2 text-2xl font-semibold">结果审核</h1></div><Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">返回工作台</Link></div></header><section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">审核记录只追加不覆盖；通过、退回和要求补充都会保存审核人、时间、意见和任务状态历史。</div><ResultReviewPanel initialTasks={tasks} canManage={canManage} /></section></main>;
}
