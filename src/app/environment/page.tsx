import Link from "next/link";
import { redirect } from "next/navigation";

import { EnvironmentPanel } from "@/components/environment/environment-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadEnvironmentAlerts, loadEnvironmentLaboratories, loadEnvironmentRecords, loadEnvironmentThresholds } from "@/lib/server/environment";

export default async function EnvironmentPage() {
  let context;
  try {
    context = await requireAdminPermission("resource.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"><section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-semibold text-rose-600">403 / 无权访问</p><h1 className="mt-2 text-2xl font-semibold">环境记录仅对资源查看者开放</h1><Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link></section></main>;
  }
  const laboratories = await loadEnvironmentLaboratories(context.supabase);
  const laboratoryId = laboratories[0] ? String(laboratories[0].id) : null;
  const [thresholds, records, alerts, canManage] = await Promise.all([
    loadEnvironmentThresholds(context.supabase, laboratoryId),
    loadEnvironmentRecords(context.supabase, { laboratoryId }),
    loadEnvironmentAlerts(context.supabase, 30, laboratoryId),
    hasPermission(context.supabase, "resource.manage"),
  ]);
  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8"><div><Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link><h1 className="mt-2 text-2xl font-semibold">实验室环境监测</h1></div><Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">返回工作台</Link></div></header><section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">实验室和区域主档复用基础设置；环境阈值、采集记录和超阈值提醒在此维护。真实传感器接入保留接口但不在当前版本自动连接。</div><EnvironmentPanel initialLaboratories={laboratories} initialThresholds={thresholds} initialRecords={records} initialAlerts={alerts} canManage={canManage} /></section></main>;
}
