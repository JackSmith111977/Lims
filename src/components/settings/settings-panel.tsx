"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Resource = "laboratories" | "departments" | "groups" | "categories" | "units" | "parameters" | "report-templates";
type SettingItem = { id: number; code: string; name: string; status: string; [key: string]: unknown };
type FormState = Record<string, string>;

const resources: Array<{ key: Resource; label: string }> = [
  { key: "laboratories", label: "实验室" },
  { key: "departments", label: "部门" },
  { key: "groups", label: "实验组" },
  { key: "categories", label: "通用分类" },
  { key: "units", label: "计量单位" },
  { key: "parameters", label: "系统参数" },
  { key: "report-templates", label: "报告模板" },
];

const emptyForm: FormState = {
  code: "", name: "", location: "", laboratoryId: "", parentId: "", leaderId: "", categoryType: "PROJECT",
  description: "", symbol: "", dimension: "", valueType: "STRING", value: "", status: "ACTIVE",
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

export function SettingsPanel() {
  const [selectedResource, setSelectedResource] = useState<Resource>("laboratories");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [data, setData] = useState<Record<Resource, SettingItem[]>>({ laboratories: [], departments: [], groups: [], categories: [], units: [], parameters: [], "report-templates": [] });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedLabel = useMemo(() => resources.find((item) => item.key === selectedResource)?.label ?? "设置", [selectedResource]);

  async function fetchAll() {
    const results = await Promise.all(resources.map(async ({ key }) => [key, (await requestJson(`/api/v1/settings/${key}`)).data as SettingItem[]] as const));
    return Object.fromEntries(results) as Record<Resource, SettingItem[]>;
  }

  async function loadAll() {
    setLoading(true);
    try {
      setData(await fetchAll());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "设置读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchAll().then((nextData) => {
      if (!cancelled) {
        setData(nextData);
        setLoading(false);
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setMessage(error instanceof Error ? error.message : "设置读取失败");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function payloadForResource() {
    const base = { code: form.code, name: form.name, status: form.status };
    if (selectedResource === "laboratories") return { ...base, location: form.location };
    if (selectedResource === "departments") return { ...base, laboratoryId: Number(form.laboratoryId), parentId: form.parentId ? Number(form.parentId) : null };
    if (selectedResource === "groups") return { ...base, laboratoryId: Number(form.laboratoryId), leaderId: form.leaderId || null };
    if (selectedResource === "categories") return { ...base, categoryType: form.categoryType, parentId: form.parentId ? Number(form.parentId) : null, description: form.description };
    if (selectedResource === "units") return { ...base, symbol: form.symbol, dimension: form.dimension };
    let value: unknown = form.value;
    const valueType = selectedResource === "report-templates" ? "JSON" : form.valueType;
    if (valueType === "NUMBER") value = Number(form.value);
    if (valueType === "BOOLEAN") value = form.value === "true";
    if (valueType === "JSON") value = form.value;
    return { ...base, valueType, value, description: form.description };
  }

  async function createSetting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await requestJson(`/api/v1/settings/${selectedResource}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payloadForResource()) });
      setForm(emptyForm);
      setMessage(`${selectedLabel}已创建`);
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    }
  }

  async function toggleStatus(resource: Resource, item: SettingItem) {
    setMessage(null);
    const identifier = resource === "parameters" ? item.code : item.id;
    try {
      await requestJson(`/api/v1/settings/${resource}/${identifier}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) });
      setMessage(`${item.name}状态已更新`);
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div><Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link><h1 className="mt-2 text-2xl font-semibold">基础设置</h1></div>
          <nav className="flex gap-4 text-sm"><Link href="/admin/users" className="text-blue-600">用户管理</Link><Link href="/dashboard" className="text-slate-500">返回工作台</Link></nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">基础设置统一经过 `settings.manage` 权限校验，停用代替物理删除，变更写入审计日志。</div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-3"><label className="text-sm text-slate-600">设置类型<select className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" value={selectedResource} onChange={(event) => setSelectedResource(event.target.value as Resource)}>{resources.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={createSetting}>
            <label className="text-sm text-slate-600">编码<input required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.code} onChange={(event) => update("code", event.target.value)} /></label>
            <label className="text-sm text-slate-600">名称<input required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            {(selectedResource === "departments" || selectedResource === "groups") && <label className="text-sm text-slate-600">实验室 ID<input required type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.laboratoryId} onChange={(event) => update("laboratoryId", event.target.value)} /></label>}
            {selectedResource === "laboratories" && <label className="text-sm text-slate-600">位置<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.location} onChange={(event) => update("location", event.target.value)} /></label>}
            {selectedResource === "categories" && <label className="text-sm text-slate-600">分类类型<input required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.categoryType} onChange={(event) => update("categoryType", event.target.value)} /></label>}
            {selectedResource === "units" && <><label className="text-sm text-slate-600">符号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.symbol} onChange={(event) => update("symbol", event.target.value)} /></label><label className="text-sm text-slate-600">量纲<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.dimension} onChange={(event) => update("dimension", event.target.value)} /></label></>}
            {(selectedResource === "parameters" || selectedResource === "report-templates") && <><label className="text-sm text-slate-600">值类型{selectedResource === "report-templates" ? <span className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">JSON（模板）</span> : <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.valueType} onChange={(event) => update("valueType", event.target.value)}><option>STRING</option><option>NUMBER</option><option>BOOLEAN</option><option>JSON</option></select>}</label><label className="text-sm text-slate-600">{selectedResource === "report-templates" ? "模板 JSON" : "参数值"}<input required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.value} onChange={(event) => update("value", event.target.value)} /></label></>}
            <label className="text-sm text-slate-600 md:col-span-2">说明<textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
            <div className="md:col-span-2 flex items-center gap-3"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" type="submit">创建{selectedLabel}</button>{message ? <span className="text-sm text-slate-600">{message}</span> : null}</div>
          </form>
        </section>
        {loading ? <p className="text-sm text-slate-500">正在读取设置…</p> : <div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <section key={resource.key} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{resource.label}</h2><span className="text-xs text-slate-400">{data[resource.key].length} 项</span></div><div className="mt-4 space-y-2">{data[resource.key].map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><div><p className="text-sm font-medium">{item.name}</p><p className="font-mono text-xs text-slate-400">{item.code}</p></div><button className="text-xs text-blue-600" type="button" onClick={() => void toggleStatus(resource.key, item)}>{item.status === "ACTIVE" ? "停用" : "启用"}</button></div>)}</div></section>)}</div>}
      </section>
    </main>
  );
}
