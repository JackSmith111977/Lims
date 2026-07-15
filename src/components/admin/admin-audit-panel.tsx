"use client";

import { useState } from "react";

import type { AuditLogView } from "@/lib/server/audit-data";

type Props = {
  initialLogs: AuditLogView[];
};

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value);
}

export function AdminAuditPanel({ initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [objectType, setObjectType] = useState("");
  const [action, setAction] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function searchLogs() {
    setLoading(true);
    setMessage(null);
    const params = new URLSearchParams({ limit: "100" });
    if (objectType.trim()) params.set("objectType", objectType.trim());
    if (action.trim()) params.set("action", action.trim());
    if (operatorId.trim()) params.set("operatorId", operatorId.trim());

    try {
      const response = await fetch(`/api/v1/audit-logs?${params.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? "查询审计日志失败。");
      setLogs(payload.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "查询审计日志失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">筛选条件</h2>
          <p className="mt-1 text-sm text-slate-500">日志只读展示，查询权限由服务端再次校验。</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-600">对象类型<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={objectType} onChange={(event) => setObjectType(event.target.value)} placeholder="auth / task" /></label>
          <label className="text-sm text-slate-600">操作类型<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={action} onChange={(event) => setAction(event.target.value)} placeholder="LOGIN_SUCCESS" /></label>
          <label className="text-sm text-slate-600">操作人 UUID<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={operatorId} onChange={(event) => setOperatorId(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={searchLogs} disabled={loading}>{loading ? "查询中…" : "查询日志"}</button>
          {message ? <span className="text-sm text-rose-600" role="alert">{message}</span> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4"><h2 className="font-semibold">操作日志（{logs.length}）</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">时间</th><th className="px-6 py-3">操作人</th><th className="px-6 py-3">对象</th><th className="px-6 py-3">动作</th><th className="px-6 py-3">结果</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => <tr key={log.id} className="align-top"><td className="whitespace-nowrap px-6 py-4 text-slate-600">{new Date(log.occurredAt).toLocaleString()}</td><td className="px-6 py-4 font-mono text-xs text-slate-500">{log.operatorId ?? "匿名"}</td><td className="px-6 py-4"><div className="font-medium text-slate-800">{log.objectType}</div><div className="mt-1 break-all font-mono text-xs text-slate-400">{log.objectId}</div></td><td className="px-6 py-4 font-mono text-xs text-slate-700">{log.action}</td><td className="max-w-sm break-all px-6 py-4 font-mono text-xs text-slate-500">{formatJson(log.afterJson)}</td></tr>)}
              {logs.length === 0 ? <tr><td className="px-6 py-10 text-center text-slate-500" colSpan={5}>暂无匹配日志</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
