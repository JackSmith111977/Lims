"use client";

import { useState } from "react";

import type { InstrumentView } from "@/lib/server/instruments";

type FormState = {
  instrumentCode: string;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  location: string;
  ownerId: string;
  status: string;
  commissionedAt: string;
};

const emptyForm: FormState = { instrumentCode: "", name: "", type: "", model: "", manufacturer: "", location: "", ownerId: "", status: "ACTIVE", commissionedAt: "" };

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "请求失败。");
  return payload as { data: T };
}

function toForm(instrument: InstrumentView): FormState {
  return { instrumentCode: instrument.instrumentCode, name: instrument.name, type: instrument.type, model: instrument.model ?? "", manufacturer: instrument.manufacturer ?? "", location: instrument.location ?? "", ownerId: instrument.ownerId ?? "", status: instrument.status, commissionedAt: instrument.commissionedAt ?? "" };
}

export function InstrumentsPanel({ initialInstruments, canManage }: { initialInstruments: InstrumentView[]; canManage: boolean }) {
  const [instruments, setInstruments] = useState(initialInstruments);
  const [selectedId, setSelectedId] = useState<number | null>(initialInstruments[0]?.id ?? null);
  const [form, setForm] = useState<FormState>(initialInstruments[0] ? toForm(initialInstruments[0]) : emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function select(instrument: InstrumentView) {
    setSelectedId(instrument.id);
    setForm(toForm(instrument));
    setEditing(false);
    setError(null);
  }

  function startCreate() {
    setSelectedId(null);
    setForm(emptyForm);
    setEditing(true);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = { instrumentCode: form.instrumentCode, name: form.name, type: form.type, model: form.model || null, manufacturer: form.manufacturer || null, location: form.location || null, ownerId: form.ownerId || null, status: form.status, commissionedAt: form.commissionedAt || null };
    try {
      const result = selectedId === null
        ? await requestJson<InstrumentView>("/api/v1/instruments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        : await requestJson<InstrumentView>(`/api/v1/instruments/${selectedId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, instrumentCode: undefined, commissionedAt: undefined }) });
      setInstruments((current) => selectedId === null ? [result.data, ...current] : current.map((item) => item.id === result.data.id ? result.data : item));
      setSelectedId(result.data.id);
      setForm(toForm(result.data));
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "设备保存失败。");
    } finally {
      setBusy(false);
    }
  }

  const selected = selectedId === null ? null : instruments.find((instrument) => instrument.id === selectedId) ?? null;

  return <div className="grid gap-6 lg:grid-cols-[20rem_1fr]"><aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between"><h2 className="font-semibold">设备列表</h2>{canManage ? <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white" onClick={startCreate}>新增设备</button> : null}</div><div className="mt-4 space-y-2">{instruments.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">暂无设备档案。</p> : instruments.map((instrument) => <button key={instrument.id} className={`w-full rounded-xl border p-3 text-left ${instrument.id === selectedId ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`} onClick={() => select(instrument)}><div className="flex items-center justify-between gap-2"><span className="font-medium">{instrument.name}</span><span className="text-xs text-slate-500">{instrument.status}</span></div><p className="mt-1 text-xs text-slate-500">{instrument.instrumentCode} · 使用 {instrument.usageCount} 次</p></button>)}</div></aside><section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">{error ? <p className="mb-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}{editing && canManage ? <div><h2 className="text-xl font-semibold">{selectedId === null ? "新增设备档案" : "编辑设备档案"}</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm">设备编号<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" disabled={selectedId !== null} value={form.instrumentCode} onChange={(event) => setForm({ ...form, instrumentCode: event.target.value })} /></label><label className="text-sm">设备名称<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="text-sm">设备类型<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} /></label><label className="text-sm">型号<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label><label className="text-sm">生产厂商<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></label><label className="text-sm">所在位置<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="text-sm">负责人 UUID<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })} /></label><label className="text-sm">状态<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option><option>MAINTENANCE</option><option>SCRAPPED</option></select></label>{selectedId === null ? <label className="text-sm">启用日期<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.commissionedAt} onChange={(event) => setForm({ ...form, commissionedAt: event.target.value })} /></label> : null}</div><div className="mt-6 flex gap-2"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void save()}>保存</button><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setEditing(false); if (selected) setForm(toForm(selected)); }}>取消</button></div></div> : selected ? <div><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{selected.instrumentCode}</p><h2 className="mt-2 text-2xl font-semibold">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.type} · {selected.status}</p></div>{canManage && selected.status !== "SCRAPPED" ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setEditing(true)}>编辑档案</button> : null}</div><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">型号/厂商</p><p className="mt-1 text-sm font-medium">{selected.model ?? "未填写"} · {selected.manufacturer ?? "未填写"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">位置/负责人</p><p className="mt-1 break-all text-sm font-medium">{selected.location ?? "未填写"} · {selected.ownerId ?? "未分配"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">数据关联</p><p className="mt-1 text-sm font-medium">{selected.usageCount} 次，最近 {selected.lastUsedAt ? new Date(selected.lastUsedAt).toLocaleString("zh-CN") : "暂无"}</p></div></div><div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">启用日期：{selected.commissionedAt ?? "未填写"}；下次校准：{selected.nextCalibrationAt ?? "由维护/校准模块管理"}。维护、校准记录将在 T-402 中接入。</div></div> : <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">选择设备或新增档案。</div>}</section></div>;
}
