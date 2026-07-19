"use client";

import { useState } from "react";

import type { ReportSignatureView, ReportView } from "@/lib/server/reporting";

async function requestJson<T = ReportView>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "请求失败。");
  return payload as { data: T };
}

type ReportsPanelProps = {
  initialReports: ReportView[];
  canManage: boolean;
  canPublish: boolean;
};

export function ReportsPanel({ initialReports, canManage, canPublish }: ReportsPanelProps) {
  const [reports, setReports] = useState(initialReports);
  const [selected, setSelected] = useState<ReportView | null>(initialReports[0] ?? null);
  const [taskId, setTaskId] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState<string | null>(null);

  async function selectReport(id: number) {
    setError(null);
    try {
      const payload = await requestJson(`/api/v1/reports/${id}`);
      setSelected(payload.data);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "无法读取报告。");
    }
  }

  async function generate() {
    if (!taskId.trim()) {
      setError("请输入已审核通过的任务 ID。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await requestJson(`/api/v1/tasks/${taskId.trim()}/reports`, { method: "POST" });
      setReports((current) => [payload.data, ...current.filter((report) => report.id !== payload.data.id)]);
      setSelected(payload.data);
      setTaskId("");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "报告生成失败。");
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "submit-review" | "publish" | "archive") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await requestJson(`/api/v1/reports/${selected.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remark: remark.trim() || undefined }),
      });
      setReports((current) => current.map((report) => report.id === payload.data.id ? payload.data : report));
      setSelected(payload.data);
      setRemark("");
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "报告状态变更失败。");
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setSignatureMessage(null);
    try {
      const payload = await requestJson<ReportSignatureView>(`/api/v1/reports/${selected.id}/sign`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ remark: remark.trim() || undefined }) });
      const signed = { ...selected, signature: payload.data };
      setSelected(signed);
      setReports((current) => current.map((report) => report.id === signed.id ? signed : report));
      setRemark("");
      setSignatureMessage(`电子签名已生成：${payload.data.signatureHash}`);
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : "报告签署失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {canManage ? (
          <div className="border-b border-slate-200 pb-5">
            <h2 className="font-semibold">生成报告</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">仅允许从 APPROVED 任务生成新的不可变草稿版本。</p>
            <div className="mt-4 flex gap-2">
              <input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="任务 ID" inputMode="numeric" />
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void generate()}>生成</button>
            </div>
          </div>
        ) : null}
        <div className="mt-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">报告列表</h2><span className="text-xs text-slate-400">{reports.length} 个</span></div>
          <div className="mt-3 space-y-2">
            {reports.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">暂无报告。</p> : reports.map((report) => (
              <button key={report.id} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === report.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`} onClick={() => void selectReport(report.id)}>
                <div className="flex items-center justify-between gap-2"><span className="font-medium text-slate-800">{report.reportCode}</span><span className="text-xs text-slate-500">v{report.versionNo}</span></div>
                <p className="mt-1 text-xs text-slate-500">任务 {report.taskId} · {report.status}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {error ? <p className="mb-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {!selected ? <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">选择报告查看不可变快照。</div> : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{selected.reportCode}</p><h2 className="mt-2 text-2xl font-semibold">报告 v{selected.versionNo}</h2><p className="mt-1 text-sm text-slate-500">任务 {selected.taskId} · {selected.status}</p></div>
              <div className="flex flex-wrap gap-2"><a className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-blue-300" href={`/api/v1/reports/${selected.id}/export`}>导出 JSON</a><a className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:border-blue-300" href={`/reports/trace/${selected.id}`}>查看追溯</a></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canManage && selected.status === "DRAFT" ? <button className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void transition("submit-review")}>提交审核</button> : null}
              {canPublish && selected.status === "REVIEW" ? <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void transition("publish")}>发布</button> : null}
              {canPublish && selected.status === "PUBLISHED" ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50" disabled={busy} onClick={() => void transition("archive")}>归档</button> : null}
              {canPublish && selected.status === "PUBLISHED" && !selected.signature ? <button className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-700 disabled:opacity-50" disabled={busy} onClick={() => void sign()}>电子签名</button> : null}
              {selected.status === "DRAFT" || selected.status === "REVIEW" ? <input className="min-w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="状态变更说明（可选）" /> : null}
            </div>
            {signatureMessage ? <p className="mt-3 rounded-lg bg-violet-50 p-3 text-xs text-violet-800">{signatureMessage}</p> : null}
            {selected.signature ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">已签署：{selected.signature.signatureHash}（{new Date(selected.signature.signedAt).toLocaleString("zh-CN")}）</p> : null}
            <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">生成时间</p><p className="mt-1 text-sm font-medium">{new Date(selected.generatedAt).toLocaleString("zh-CN")}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">历史变更</p><p className="mt-1 text-sm font-medium">{selected.history.length} 条</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">快照对象</p><p className="mt-1 text-sm font-medium">任务、样品、数据、审核</p></div></div>
            <div className="mt-6"><h3 className="font-semibold">报告快照</h3><pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">{JSON.stringify(selected.reportPayload, null, 2)}</pre></div>
            <div className="mt-6"><h3 className="font-semibold">状态历史</h3><div className="mt-3 space-y-2">{selected.history.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm"><span className="font-medium">{item.fromStatus ?? "新建"} → {item.toStatus}</span><span className="ml-3 text-xs text-slate-500">{new Date(item.occurredAt).toLocaleString("zh-CN")}</span>{item.remark ? <p className="mt-1 text-slate-600">{item.remark}</p> : null}</div>)}</div></div>
          </>
        )}
      </section>
    </div>
  );
}
