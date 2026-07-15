"use client";

import { useState } from "react";

import type { InstrumentMaintenanceView } from "@/lib/server/instrument-maintenance";
import type { InstrumentView } from "@/lib/server/instruments";

type InstrumentFormState = {
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

type MaintenanceFormState = {
  maintenanceType: string;
  occurredOn: string;
  result: string;
  cycleDays: string;
  nextDueOn: string;
  remark: string;
};

const emptyInstrumentForm: InstrumentFormState = {
  instrumentCode: "",
  name: "",
  type: "",
  model: "",
  manufacturer: "",
  location: "",
  ownerId: "",
  status: "ACTIVE",
  commissionedAt: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyMaintenanceForm(): MaintenanceFormState {
  return { maintenanceType: "MAINTENANCE", occurredOn: today(), result: "", cycleDays: "", nextDueOn: "", remark: "" };
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "请求失败。");
  return payload as { data: T };
}

function toInstrumentForm(instrument: InstrumentView): InstrumentFormState {
  return {
    instrumentCode: instrument.instrumentCode,
    name: instrument.name,
    type: instrument.type,
    model: instrument.model ?? "",
    manufacturer: instrument.manufacturer ?? "",
    location: instrument.location ?? "",
    ownerId: instrument.ownerId ?? "",
    status: instrument.status,
    commissionedAt: instrument.commissionedAt ?? "",
  };
}

function maintenanceTypeLabel(type: string) {
  return { MAINTENANCE: "维护", REPAIR: "维修", INSPECTION: "检查", CALIBRATION: "校准" }[type] ?? type;
}

export function InstrumentsPanel({
  initialInstruments,
  initialMaintenance = [],
  canManage,
}: {
  initialInstruments: InstrumentView[];
  initialMaintenance?: InstrumentMaintenanceView[];
  canManage: boolean;
}) {
  const [instruments, setInstruments] = useState(initialInstruments);
  const [selectedId, setSelectedId] = useState<number | null>(initialInstruments[0]?.id ?? null);
  const [form, setForm] = useState<InstrumentFormState>(initialInstruments[0] ? toInstrumentForm(initialInstruments[0]) : emptyInstrumentForm);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormState>(emptyMaintenanceForm);
  const [editing, setEditing] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadMaintenance(instrumentId: number) {
    setMaintenanceLoading(true);
    try {
      const result = await requestJson<InstrumentMaintenanceView[]>(`/api/v1/instruments/${instrumentId}/maintenance`);
      setMaintenance(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取维护记录。");
      setMaintenance([]);
    } finally {
      setMaintenanceLoading(false);
    }
  }

  function select(instrument: InstrumentView) {
    setSelectedId(instrument.id);
    setForm(toInstrumentForm(instrument));
    setMaintenance([]);
    setMaintenanceForm(emptyMaintenanceForm());
    setEditing(false);
    setError(null);
    void loadMaintenance(instrument.id);
  }

  function startCreate() {
    setSelectedId(null);
    setForm(emptyInstrumentForm);
    setMaintenance([]);
    setEditing(true);
    setError(null);
  }

  async function saveInstrument() {
    setBusy(true);
    setError(null);
    const payload = {
      instrumentCode: form.instrumentCode,
      name: form.name,
      type: form.type,
      model: form.model || null,
      manufacturer: form.manufacturer || null,
      location: form.location || null,
      ownerId: form.ownerId || null,
      status: form.status,
      commissionedAt: form.commissionedAt || null,
    };
    try {
      const result = selectedId === null
        ? await requestJson<InstrumentView>("/api/v1/instruments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        : await requestJson<InstrumentView>(`/api/v1/instruments/${selectedId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, instrumentCode: undefined, commissionedAt: undefined }) });
      setInstruments((current) => selectedId === null ? [result.data, ...current] : current.map((item) => item.id === result.data.id ? result.data : item));
      setSelectedId(result.data.id);
      setForm(toInstrumentForm(result.data));
      setMaintenance([]);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "设备保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveMaintenance() {
    if (selectedId === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestJson<InstrumentMaintenanceView>(`/api/v1/instruments/${selectedId}/maintenance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maintenanceType: maintenanceForm.maintenanceType,
          occurredOn: maintenanceForm.occurredOn,
          result: maintenanceForm.result || null,
          cycleDays: maintenanceForm.cycleDays || null,
          nextDueOn: maintenanceForm.nextDueOn || null,
          remark: maintenanceForm.remark || null,
        }),
      });
      setMaintenance((current) => [result.data, ...current]);
      if (maintenanceForm.maintenanceType === "CALIBRATION" && result.data.nextDueOn) {
        setInstruments((current) => current.map((instrument) => instrument.id === selectedId ? { ...instrument, nextCalibrationAt: result.data.nextDueOn } : instrument));
      }
      setMaintenanceForm(emptyMaintenanceForm());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "维护记录保存失败。");
    } finally {
      setBusy(false);
    }
  }

  const selected = selectedId === null ? null : instruments.find((instrument) => instrument.id === selectedId) ?? null;
  const isCalibration = maintenanceForm.maintenanceType === "CALIBRATION";

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">设备列表</h2>
          {canManage ? <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white" onClick={startCreate}>新增设备</button> : null}
        </div>
        <div className="mt-4 space-y-2">
          {instruments.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">暂无设备档案。</p> : instruments.map((instrument) => (
            <button key={instrument.id} className={`w-full rounded-xl border p-3 text-left ${instrument.id === selectedId ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`} onClick={() => select(instrument)}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{instrument.name}</span><span className="text-xs text-slate-500">{instrument.status}</span></div>
              <p className="mt-1 text-xs text-slate-500">{instrument.instrumentCode} · 使用 {instrument.usageCount} 次</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {error ? <p className="mb-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {editing && canManage ? (
          <div>
            <h2 className="text-xl font-semibold">{selectedId === null ? "新增设备档案" : "编辑设备档案"}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm">设备编号<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" disabled={selectedId !== null} value={form.instrumentCode} onChange={(event) => setForm({ ...form, instrumentCode: event.target.value })} /></label>
              <label className="text-sm">设备名称<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="text-sm">设备类型<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} /></label>
              <label className="text-sm">型号<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label>
              <label className="text-sm">生产厂商<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></label>
              <label className="text-sm">所在位置<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
              <label className="text-sm">负责人 UUID<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })} /></label>
              <label className="text-sm">状态<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option><option>MAINTENANCE</option><option>SCRAPPED</option></select></label>
              {selectedId === null ? <label className="text-sm">启用日期<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.commissionedAt} onChange={(event) => setForm({ ...form, commissionedAt: event.target.value })} /></label> : null}
            </div>
            <div className="mt-6 flex gap-2"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void saveInstrument()}>保存</button><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setEditing(false); if (selected) setForm(toInstrumentForm(selected)); }}>取消</button></div>
          </div>
        ) : selected ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{selected.instrumentCode}</p><h2 className="mt-2 text-2xl font-semibold">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.type} · {selected.status}</p></div>
              {canManage && selected.status !== "SCRAPPED" ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setEditing(true)}>编辑档案</button> : null}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">型号/厂商</p><p className="mt-1 text-sm font-medium">{selected.model ?? "未填写"} · {selected.manufacturer ?? "未填写"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">位置/负责人</p><p className="mt-1 break-all text-sm font-medium">{selected.location ?? "未填写"} · {selected.ownerId ?? "未分配"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">数据关联</p><p className="mt-1 text-sm font-medium">{selected.usageCount} 次，最近 {selected.lastUsedAt ? new Date(selected.lastUsedAt).toLocaleString("zh-CN") : "暂无"}</p></div></div>
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">启用日期：{selected.commissionedAt ?? "未填写"}；下次校准：{selected.nextCalibrationAt ?? "未安排"}。</div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-semibold">维护与校准记录</h3><p className="mt-1 text-sm text-slate-500">记录采用追加方式保存，校准会更新设备下次校准日期。</p></div>{maintenanceLoading ? <span className="text-xs text-slate-500">加载中…</span> : null}</div>
              {canManage && selected.status !== "SCRAPPED" ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm">记录类型<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={maintenanceForm.maintenanceType} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: event.target.value })}><option value="MAINTENANCE">维护</option><option value="REPAIR">维修</option><option value="INSPECTION">检查</option><option value="CALIBRATION">校准</option></select></label><label className="text-sm">发生日期<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" type="date" value={maintenanceForm.occurredOn} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, occurredOn: event.target.value })} /></label><label className="text-sm">结果<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={maintenanceForm.result} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, result: event.target.value })} /></label>{isCalibration ? <label className="text-sm">周期（天）<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" type="number" min="1" value={maintenanceForm.cycleDays} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, cycleDays: event.target.value })} /></label> : null}{isCalibration ? <label className="text-sm">下次到期日<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" type="date" value={maintenanceForm.nextDueOn} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, nextDueOn: event.target.value })} /></label> : null}<label className="text-sm md:col-span-2">备注<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={maintenanceForm.remark} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, remark: event.target.value })} /></label></div><button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void saveMaintenance()}>新增记录</button></div> : null}
              <div className="mt-4 space-y-3">{maintenance.length === 0 && !maintenanceLoading ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">暂无维护或校准记录。</p> : maintenance.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{maintenanceTypeLabel(item.maintenanceType)}</span><span className="text-sm text-slate-500">{item.occurredOn}</span></div><p className="mt-2 text-sm text-slate-700">{item.result ?? "未填写结果"}{item.cycleDays ? ` · 周期 ${item.cycleDays} 天` : ""}{item.nextDueOn ? ` · 下次到期 ${item.nextDueOn}` : ""}</p>{item.remark ? <p className="mt-1 text-xs text-slate-500">备注：{item.remark}</p> : null}</article>)}</div>
            </div>
          </div>
        ) : <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">选择设备或新增档案。</div>}
      </section>
    </div>
  );
}
