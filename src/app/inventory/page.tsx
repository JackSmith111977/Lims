import Link from "next/link";
import { redirect } from "next/navigation";

import { InventoryPanel } from "@/components/inventory/inventory-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadInventoryAlerts, loadInventoryItems, loadInventoryTransactions } from "@/lib/server/inventory";

export default async function InventoryPage() {
  let context;
  try {
    context = await requireAdminPermission("resource.read");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"><section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-semibold text-rose-600">403 / 无权访问</p><h1 className="mt-2 text-2xl font-semibold">库存档案仅对资源查看者开放</h1><Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link></section></main>;
  }
  const [items, alerts, canManage] = await Promise.all([loadInventoryItems(context.supabase), loadInventoryAlerts(context.supabase), hasPermission(context.supabase, "resource.manage")]);
  const initialTransactions = items[0] ? await loadInventoryTransactions(context.supabase, String(items[0].id)) : [];
  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8"><div><Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link><h1 className="mt-2 text-2xl font-semibold">试剂耗材与库存</h1></div><Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">返回工作台</Link></div></header><section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">库存余额由入库、领用、退库和报废变动自动产生；低库存/有效期提醒由数据库当前日期计算，领用记录可以关联未归档实验任务。</div><InventoryPanel initialItems={items} initialTransactions={initialTransactions} initialAlerts={alerts} canManage={canManage} /></section></main>;
}
