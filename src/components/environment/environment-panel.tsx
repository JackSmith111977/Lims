"use client";

import { useState } from "react";

import type { EnvironmentAlertView, EnvironmentLaboratoryView, EnvironmentRecordView, EnvironmentThresholdView } from "@/lib/server/environment";

type ThresholdForm = { metric: string; unit: string; thresholdMin: string; thresholdMax: string; status: string };
type RecordForm = { metric: string; unit: string; value: string; sourceType: string; collectedAt: string };

const emptyThreshold: ThresholdForm = { metric: "", unit: "", thresholdMin: "", thresholdMax: "", status: "ACTIVE" };
const emptyRecord: RecordForm = { metric: "", unit: "", value: "", sourceType: "MANUAL", collectedAt: "" };

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "请求失败。");
  return payload as { data: T };
}

export function EnvironmentPanel({
  initialLaboratories,
  initialThresholds,
  initialRecords,
  initialAlerts,
  canManage,
}: {
  initialLaboratories: EnvironmentLaboratoryView[];
  initialThresholds: EnvironmentThresholdView[];
  initialRecords: EnvironmentRecordView[];
  initialAlerts: EnvironmentAlertView[];
  canManage: boolean;
}) {
  const [laboratories] = useState(initialLaboratories);
  const [selectedLabId, setSelectedLabId] = useState(String(initialLaboratories[0]?.id ?? ""));
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [records, setRecords] = useState(initialRecords);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [thresholdForm, setThresholdForm] = useState(emptyThreshold);
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [editingThresholdId, setEditingThresholdId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLabData(laboratoryId: string) {
    if (!laboratoryId) return;
    setError(null);
    try {
      const [thresholdResult, recordResult, alertResult] = await Promise.all([
        requestJson<EnvironmentThresholdView[]>(`/api/v1/environment/thresholds?laboratoryId=${laboratoryId}`),
        requestJson<EnvironmentRecordView[]>(`/api/v1/environment/records?laboratoryId=${laboratoryId}`),
        requestJson<EnvironmentAlertView[]>(`/api/v1/environment/alerts?laboratoryId=${laboratoryId}&days=30`),
      ]);
      setThresholds(thresholdResult.data);
      setRecords(recordResult.data);
      setAlerts(alertResult.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "环境数据读取失败。");
    }
  }

  function changeLaboratory(value: string) {
    setSelectedLabId(value);
    setEditingThresholdId(null);
    setThresholdForm(emptyThreshold);
    void loadLabData(value);
  }

  function editThreshold(threshold: EnvironmentThresholdView) {
    setEditingThresholdId(threshold.id);
    setThresholdForm({ metric: threshold.metric, unit: threshold.unit, thresholdMin: threshold.thresholdMin === null ? "" : String(threshold.thresholdMin), thresholdMax: threshold.thresholdMax === null ? "" : String(threshold.thresholdMax), status: threshold.status });
  }

  async function saveThreshold() {
    if (!selectedLabId) return;
    setBusy(true);
    setError(null);
    const payload = { laboratoryId: Number(selectedLabId), metric: thresholdForm.metric, unit: thresholdForm.unit, thresholdMin: thresholdForm.thresholdMin || null, thresholdMax: thresholdForm.thresholdMax || null, status: thresholdForm.status };
    try {
      await requestJson<EnvironmentThresholdView>(editingThresholdId === null ? "/api/v1/environment/thresholds" : `/api/v1/environment/thresholds/${editingThresholdId}`, { method: editingThresholdId === null ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setThresholdForm(emptyThreshold);
      setEditingThresholdId(null);
      await loadLabData(selectedLabId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "阈值保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveRecord() {
    if (!selectedLabId) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson<EnvironmentRecordView>("/api/v1/environment/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ laboratoryId: Number(selectedLabId), metric: recordForm.metric, unit: recordForm.unit, value: recordForm.value, sourceType: recordForm.sourceType, collectedAt: recordForm.collectedAt || null }) });
      setRecordForm(emptyRecord);
      await loadLabData(selectedLabId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "环境记录保存失败。");
    } finally {
      setBusy(false);
    }
  }

  const selectedLaboratory = laboratories.find((lab) => String(lab.id) === selectedLabId);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Laboratory</p><h2 className="mt-2 text-xl font-semibold">{selectedLaboratory?.name ?? "未选择实验室"}</h2></div><label className="text-sm text-slate-600">实验室<select className="mt-1 min-w-56 rounded-lg border border-slate-300 bg-white px-3 py-2" value={selectedLabId} onChange={(event) => changeLaboratory(event.target.value)}>{laboratories.map((lab) => <option key={lab.id} value={lab.id}>{lab.code} · {lab.name}</option>)}</select></label></div>
    {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">环境提醒</h2><p className="mt-1 text-sm text-slate-500">最近 30 天内超出阈值的环境记录。</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">{alerts.length} 条</span></div>{alerts.length === 0 ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">当前没有超阈值提醒。</p> : <div className="mt-4 space-y-2">{alerts.map((alert) => <article key={alert.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{alert.metric} · {alert.value} {alert.unit}</span><time className="text-xs text-slate-500">{new Date(alert.collectedAt).toLocaleString("zh-CN")}</time></div><p className="mt-1 text-xs text-rose-700">阈值：{alert.thresholdMin ?? "-"} ～ {alert.thresholdMax ?? "-"}</p></article>)}</div>}</section>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="font-semibold">环境阈值配置</h2>{canManage ? <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm">指标<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={thresholdForm.metric} onChange={(event) => setThresholdForm({ ...thresholdForm, metric: event.target.value })} disabled={editingThresholdId !== null} /></label><label className="text-sm">单位<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={thresholdForm.unit} onChange={(event) => setThresholdForm({ ...thresholdForm, unit: event.target.value })} disabled={editingThresholdId !== null} /></label><label className="text-sm">最小阈值<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" step="any" value={thresholdForm.thresholdMin} onChange={(event) => setThresholdForm({ ...thresholdForm, thresholdMin: event.target.value })} /></label><label className="text-sm">最大阈值<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" step="any" value={thresholdForm.thresholdMax} onChange={(event) => setThresholdForm({ ...thresholdForm, thresholdMax: event.target.value })} /></label><label className="text-sm">状态<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={thresholdForm.status} onChange={(event) => setThresholdForm({ ...thresholdForm, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></label><button type="button" className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void saveThreshold()}>{editingThresholdId === null ? "新增阈值" : "保存阈值"}</button></div> : null}<div className="mt-5 space-y-2">{thresholds.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">暂无阈值配置。</p> : thresholds.map((threshold) => <button type="button" key={threshold.id} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300" onClick={() => canManage && editThreshold(threshold)}><span><span className="font-medium">{threshold.metric} ({threshold.unit})</span><span className="mt-1 block text-xs text-slate-500">{threshold.thresholdMin ?? "-"} ～ {threshold.thresholdMax ?? "-"}</span></span><span className="text-xs text-slate-500">{threshold.status}</span></button>)}</div></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="font-semibold">录入环境数据</h2>{canManage ? <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm">指标<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={recordForm.metric} onChange={(event) => setRecordForm({ ...recordForm, metric: event.target.value })} /></label><label className="text-sm">单位<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={recordForm.unit} onChange={(event) => setRecordForm({ ...recordForm, unit: event.target.value })} /></label><label className="text-sm">数值<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" step="any" value={recordForm.value} onChange={(event) => setRecordForm({ ...recordForm, value: event.target.value })} /></label><label className="text-sm">来源<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={recordForm.sourceType} onChange={(event) => setRecordForm({ ...recordForm, sourceType: event.target.value })}><option>MANUAL</option><option>SENSOR</option><option>API</option></select></label><label className="text-sm md:col-span-2">采集时间（可选）<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="datetime-local" value={recordForm.collectedAt} onChange={(event) => setRecordForm({ ...recordForm, collectedAt: event.target.value })} /></label><button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-2" disabled={busy} onClick={() => void saveRecord()}>保存环境记录</button></div> : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">当前账号只有查询权限。</p>}<div className="mt-5 space-y-2"><h3 className="text-sm font-semibold">最近记录</h3>{records.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">暂无环境记录。</p> : records.slice(0, 8).map((record) => <article key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="text-sm">{record.metric} · {record.value} {record.unit}</span><span className={record.status === "EXCEEDED" ? "text-xs text-rose-600" : "text-xs text-emerald-600"}>{record.status}</span></article>)}</div></section>
    </div>
  </div>;
}
