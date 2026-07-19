"use client";

import { useState } from "react";

import type { DashboardOverview, StatusStatistics } from "@/lib/server/dashboard";

type FilterState = {
  projectId: string;
  personnelId: string;
  sampleStatus: string;
  taskStatus: string;
  from: string;
  to: string;
  inventoryDays: string;
};

const emptyFilters: FilterState = {
  projectId: "",
  personnelId: "",
  sampleStatus: "",
  taskStatus: "",
  from: "",
  to: "",
  inventoryDays: "30",
};

const sampleStatuses = [
  ["REGISTERED", "已登记"],
  ["PROCESSING", "处理中"],
  ["PROCESSED", "已处理"],
  ["ARCHIVED", "已归档"],
  ["DISPOSED", "已处置"],
];

const taskStatuses = [
  ["DRAFT", "草稿"],
  ["ASSIGNED", "已分配"],
  ["IN_PROGRESS", "执行中"],
  ["PENDING_REVIEW", "待审核"],
  ["RETURNED", "已退回"],
  ["APPROVED", "已通过"],
  ["ARCHIVED", "已归档"],
];

function requestLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

function Distribution({ title, statistics }: { title: string; statistics: StatusStatistics }) {
  const entries = Object.entries(statistics.byStatus).sort((left, right) => right[1] - left[1]);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{title}</span>
        <span className="text-slate-500">共 {statistics.total}</span>
      </div>
      <div className="mt-3 space-y-2">
        {entries.length > 0 ? entries.map(([status, count]) => (
          <div key={status}>
            <div className="flex justify-between text-xs text-slate-500"><span>{requestLabel(status)}</span><span>{count}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${statistics.total ? Math.max(6, (count / statistics.total) * 100) : 0}%` }} /></div>
          </div>
        )) : <p className="text-xs text-slate-400">暂无数据</p>}
      </div>
    </div>
  );
}

async function requestDashboard(url: string) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "看板数据读取失败。");
  return payload as { data: DashboardOverview };
}

export function DashboardPanel({ initialOverview }: { initialOverview: DashboardOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      setOverview((await requestDashboard(`/api/v1/dashboard/overview?${query.toString()}`)).data);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "看板数据读取失败。");
    } finally {
      setBusy(false);
    }
  }

  const taskCompletion = overview.tasks ? `${overview.tasks.completionRate.toFixed(2)}%` : "—";
  return (
    <section className="mt-8 space-y-6" aria-label="数据看板">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Overview</p><h2 className="mt-2 text-2xl font-semibold">数据看板</h2><p className="mt-2 text-sm text-slate-500">统计仅显示当前账号有权读取的业务分区。</p></div>
          <button type="button" onClick={refresh} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "刷新中…" : "应用筛选"}</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-500">项目 ID<input inputMode="numeric" value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)} placeholder="全部项目" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs text-slate-500">人员 UUID<input value={filters.personnelId} onChange={(event) => updateFilter("personnelId", event.target.value)} placeholder="当前任务负责人" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs text-slate-500">样品状态<select value={filters.sampleStatus} onChange={(event) => updateFilter("sampleStatus", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option value="">全部状态</option>{sampleStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs text-slate-500">任务状态<select value={filters.taskStatus} onChange={(event) => updateFilter("taskStatus", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option value="">全部状态</option>{taskStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs text-slate-500">开始时间<input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs text-slate-500">结束时间<input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs text-slate-500">库存提醒窗口（天）<input type="number" min="0" max="365" value={filters.inventoryDays} onChange={(event) => updateFilter("inventoryDays", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["样品总数", overview.samples?.total ?? "—"],
          ["任务总数", overview.tasks?.total ?? "—"],
          ["待审核任务", overview.pendingReviews?.length ?? "—"],
          ["库存预警", overview.inventory?.totalAlerts ?? "—"],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p></div>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {overview.samples ? <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Distribution title="样品状态分布" statistics={overview.samples} /></div> : null}
        {overview.tasks ? <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Distribution title="任务状态分布" statistics={overview.tasks} /><p className="mt-5 text-sm text-slate-600">已完成：<span className="font-semibold text-slate-900">{overview.tasks.completedCount}</span>，完成率：<span className="font-semibold text-slate-900">{taskCompletion}</span></p></div> : null}
        {overview.instruments ? <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Distribution title="设备状态分布" statistics={overview.instruments} /></div> : null}
        {overview.inventory ? <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-medium text-slate-700">库存预警分布</h3><span className="text-sm text-slate-500">{overview.inventory.totalAlerts} 条</span></div><div className="mt-4 flex flex-wrap gap-2">{Object.entries(overview.inventory.bySeverity).map(([key, value]) => <span key={key} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{requestLabel(key)}：{value}</span>)}{Object.entries(overview.inventory.byType).map(([key, value]) => <span key={key} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{requestLabel(key)}：{value}</span>)}</div><div className="mt-4 space-y-2">{overview.inventory.alerts.slice(0, 6).map((alert) => <div key={`${alert.itemId}-${alert.alertType}`} className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm"><span className="truncate text-slate-700">{alert.itemCode} · {alert.itemName}</span><span className="ml-3 shrink-0 text-xs text-slate-500">{requestLabel(alert.alertType)}</span></div>)}{overview.inventory.alerts.length === 0 ? <p className="text-sm text-slate-400">暂无库存预警</p> : null}</div></div> : null}
      </div>

      {overview.pendingReviews ? <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-medium text-slate-700">待审核任务</h3><span className="text-sm text-slate-500">{overview.pendingReviews.length} 条</span></div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2 pr-5">任务编号</th><th className="py-2 pr-5">名称</th><th className="py-2 pr-5">计划结束</th><th className="py-2">更新时间</th></tr></thead><tbody>{overview.pendingReviews.map((task) => <tr key={task.id} className="border-t border-slate-100"><td className="py-3 pr-5 font-medium text-slate-800">{task.taskCode}</td><td className="py-3 pr-5 text-slate-600">{task.name}</td><td className="py-3 pr-5 text-slate-600">{formatDate(task.plannedEnd)}</td><td className="py-3 text-slate-600">{formatDate(task.updatedAt)}</td></tr>)}</tbody></table>{overview.pendingReviews.length === 0 ? <p className="py-4 text-sm text-slate-400">暂无待审核任务</p> : null}</div></div> : null}

      {overview.abnormalData ? <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium text-slate-700">异常数据</h3><p className="mt-1 text-sm text-slate-500">处理运行被标记为 FLAGGED，或判定为 FAIL/REVIEW。</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">{overview.abnormalData.total} 条</span></div><div className="mt-4 flex flex-wrap gap-2">{Object.entries(overview.abnormalData.byStatus).map(([key, value]) => <span key={key} className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">{requestLabel(key)}：{value}</span>)}{Object.entries(overview.abnormalData.byDecision).map(([key, value]) => <span key={key} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">判定 {requestLabel(key)}：{value}</span>)}</div>{overview.abnormalData.items.length > 0 ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2 pr-5">运行 ID</th><th className="py-2 pr-5">任务 ID</th><th className="py-2 pr-5">状态</th><th className="py-2">执行时间</th></tr></thead><tbody>{overview.abnormalData.items.slice(0, 20).map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="py-3 pr-5 text-slate-800">#{item.id}</td><td className="py-3 pr-5 text-slate-600">#{item.taskId}</td><td className="py-3 pr-5 text-rose-700">{requestLabel(item.status)}</td><td className="py-3 text-slate-600">{formatDate(item.executedAt)}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-400">暂无异常数据</p>}</div> : null}
    </section>
  );
}
