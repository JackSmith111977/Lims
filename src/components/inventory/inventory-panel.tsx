"use client";

import { useState } from "react";

import type { InventoryItemView, InventoryTransactionView } from "@/lib/server/inventory";

type ItemFormState = {
  itemCode: string;
  type: string;
  name: string;
  batchNo: string;
  manufacturer: string;
  unit: string;
  expiryDate: string;
  storageCondition: string;
  location: string;
  status: string;
};

type TransactionFormState = {
  transactionType: string;
  quantity: string;
  remark: string;
};

const emptyItemForm: ItemFormState = { itemCode: "", type: "", name: "", batchNo: "", manufacturer: "", unit: "", expiryDate: "", storageCondition: "", location: "", status: "ACTIVE" };
const emptyTransactionForm: TransactionFormState = { transactionType: "INBOUND", quantity: "", remark: "" };

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "请求失败。");
  return payload as { data: T };
}

function toItemForm(item: InventoryItemView): ItemFormState {
  return { itemCode: item.itemCode, type: item.type, name: item.name, batchNo: item.batchNo ?? "", manufacturer: item.manufacturer ?? "", unit: item.unit, expiryDate: item.expiryDate ?? "", storageCondition: item.storageCondition ?? "", location: item.location ?? "", status: item.status };
}

function transactionLabel(type: string) {
  return { INBOUND: "入库", OUTBOUND: "领用", RETURN: "退库", SCRAP: "报废" }[type] ?? type;
}

export function InventoryPanel({ initialItems, initialTransactions = [], canManage }: { initialItems: InventoryItemView[]; initialTransactions?: InventoryTransactionView[]; canManage: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<number | null>(initialItems[0]?.id ?? null);
  const [form, setForm] = useState<ItemFormState>(initialItems[0] ? toItemForm(initialItems[0]) : emptyItemForm);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(emptyTransactionForm);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [editing, setEditing] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTransactions(itemId: number) {
    setLoadingTransactions(true);
    try {
      const result = await requestJson<InventoryTransactionView[]>(`/api/v1/inventory/items/${itemId}/transactions`);
      setTransactions(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取库存变动。");
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }

  function select(item: InventoryItemView) {
    setSelectedId(item.id);
    setForm(toItemForm(item));
    setTransactions([]);
    setTransactionForm(emptyTransactionForm);
    setEditing(false);
    setError(null);
    void loadTransactions(item.id);
  }

  function startCreate() {
    setSelectedId(null);
    setForm(emptyItemForm);
    setTransactions([]);
    setEditing(true);
    setError(null);
  }

  async function saveItem() {
    setBusy(true);
    setError(null);
    const payload = { itemCode: form.itemCode, type: form.type, name: form.name, batchNo: form.batchNo || null, manufacturer: form.manufacturer || null, unit: form.unit, expiryDate: form.expiryDate || null, storageCondition: form.storageCondition || null, location: form.location || null, status: form.status };
    try {
      const result = selectedId === null
        ? await requestJson<InventoryItemView>("/api/v1/inventory/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        : await requestJson<InventoryItemView>(`/api/v1/inventory/items/${selectedId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, itemCode: undefined }) });
      setItems((current) => selectedId === null ? [result.data, ...current] : current.map((item) => item.id === result.data.id ? result.data : item));
      setSelectedId(result.data.id);
      setForm(toItemForm(result.data));
      setTransactions([]);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "库存主档保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveTransaction() {
    if (selectedId === null) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson<InventoryTransactionView>(`/api/v1/inventory/items/${selectedId}/transactions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transactionType: transactionForm.transactionType, quantity: transactionForm.quantity, remark: transactionForm.remark || null }) });
      const [itemResult, transactionResult] = await Promise.all([
        requestJson<InventoryItemView>(`/api/v1/inventory/items/${selectedId}`),
        requestJson<InventoryTransactionView[]>(`/api/v1/inventory/items/${selectedId}/transactions`),
      ]);
      setItems((current) => current.map((item) => item.id === itemResult.data.id ? itemResult.data : item));
      setForm(toItemForm(itemResult.data));
      setTransactions(transactionResult.data);
      setTransactionForm(emptyTransactionForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "库存变动保存失败。");
    } finally {
      setBusy(false);
    }
  }

  const selected = selectedId === null ? null : items.find((item) => item.id === selectedId) ?? null;

  return <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
    <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between"><h2 className="font-semibold">试剂耗材</h2>{canManage ? <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white" onClick={startCreate}>新增主档</button> : null}</div><div className="mt-4 space-y-2">{items.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">暂无库存主档。</p> : items.map((item) => <button key={item.id} className={`w-full rounded-xl border p-3 text-left ${item.id === selectedId ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`} onClick={() => select(item)}><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.name}</span><span className="text-xs text-slate-500">{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{item.itemCode} · {item.quantity} {item.unit}</p></button>)}</div></aside>
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">{error ? <p className="mb-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}{editing && canManage ? <div><h2 className="text-xl font-semibold">{selectedId === null ? "新增试剂耗材主档" : "编辑试剂耗材主档"}</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm">物料编号<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" disabled={selectedId !== null} value={form.itemCode} onChange={(event) => setForm({ ...form, itemCode: event.target.value })} /></label><label className="text-sm">名称<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="text-sm">类型<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} /></label><label className="text-sm">单位<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label><label className="text-sm">批号<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.batchNo} onChange={(event) => setForm({ ...form, batchNo: event.target.value })} /></label><label className="text-sm">厂家<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></label><label className="text-sm">有效期<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></label><label className="text-sm">位置<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="text-sm">存储条件<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.storageCondition} onChange={(event) => setForm({ ...form, storageCondition: event.target.value })} /></label><label className="text-sm">状态<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></label></div><div className="mt-6 flex gap-2"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void saveItem()}>保存</button><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setEditing(false); if (selected) setForm(toItemForm(selected)); }}>取消</button></div></div> : selected ? <div><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{selected.itemCode}</p><h2 className="mt-2 text-2xl font-semibold">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.type} · {selected.status}</p></div>{canManage ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setEditing(true)}>编辑主档</button> : null}</div><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">当前库存</p><p className="mt-1 text-xl font-semibold">{selected.quantity} {selected.unit}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">批号/厂家</p><p className="mt-1 text-sm font-medium">{selected.batchNo ?? "未填写"} · {selected.manufacturer ?? "未填写"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">位置/有效期</p><p className="mt-1 text-sm font-medium">{selected.location ?? "未填写"} · {selected.expiryDate ?? "未填写"}</p></div></div>{canManage ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">追加库存变动</h3><div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm">变动类型<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={transactionForm.transactionType} onChange={(event) => setTransactionForm({ ...transactionForm, transactionType: event.target.value })}><option value="INBOUND">入库</option><option value="OUTBOUND">领用</option><option value="RETURN">退库</option><option value="SCRAP">报废</option></select></label><label className="text-sm">数量<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" type="number" min="0.000001" step="0.000001" value={transactionForm.quantity} onChange={(event) => setTransactionForm({ ...transactionForm, quantity: event.target.value })} /></label><label className="text-sm">备注<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={transactionForm.remark} onChange={(event) => setTransactionForm({ ...transactionForm, remark: event.target.value })} /></label></div><button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void saveTransaction()}>保存变动</button></div> : null}<div className="mt-8 border-t border-slate-200 pt-6"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">库存变动历史</h3>{loadingTransactions ? <span className="text-xs text-slate-500">加载中…</span> : null}</div><div className="mt-4 space-y-3">{transactions.length === 0 && !loadingTransactions ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">暂无变动记录。</p> : transactions.map((transaction) => <article key={transaction.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{transactionLabel(transaction.transactionType)} · {transaction.quantity} {selected.unit}</span><time className="text-sm text-slate-500">{new Date(transaction.occurredAt).toLocaleString("zh-CN")}</time></div>{transaction.remark ? <p className="mt-1 text-xs text-slate-500">备注：{transaction.remark}</p> : null}</article>)}</div></div></div> : <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">选择物料或新增主档。</div>}</section>
  </div>;
}
