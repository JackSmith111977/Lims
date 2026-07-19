"use client";

import { useState, type FormEvent } from "react";

import type { MethodView } from "@/lib/server/methods";

type Props = {
  initialMethods: MethodView[];
  canManage: boolean;
};

const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "启用",
  INACTIVE: "停用",
  EXPIRED: "过期",
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

function toInputDateTime(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function toApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function MethodsPanel({ initialMethods, canManage }: Props) {
  const [methods, setMethods] = useState(initialMethods);
  const [selected, setSelected] = useState<MethodView | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [methodCode, setMethodCode] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [scope, setScope] = useState("");
  const [detectionLimit, setDetectionLimit] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [expiredAt, setExpiredAt] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  function resetForm(method?: MethodView) {
    setMethodCode(method?.methodCode ?? "");
    setName(method?.name ?? "");
    setVersion(method?.version ?? "");
    setScope(method?.scope ?? "");
    setDetectionLimit(method?.detectionLimit === null || method?.detectionLimit === undefined ? "" : String(method.detectionLimit));
    setStatus(method?.status ?? "DRAFT");
    setEffectiveAt(toInputDateTime(method?.effectiveAt ?? null));
    setExpiredAt(toInputDateTime(method?.expiredAt ?? null));
  }

  function selectMethod(method: MethodView) {
    setSelected(method);
    setEditing(false);
    setMessage(null);
    resetForm(method);
  }

  async function refreshMethod(id: number) {
    const payload = await requestJson(`/api/v1/methods/${id}`);
    const next = payload.data as MethodView;
    setMethods((items) => items.map((item) => item.id === next.id ? next : item));
    setSelected(next);
    resetForm(next);
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMessage(null);
    const body = {
      methodCode,
      name,
      version,
      scope: scope || null,
      detectionLimit: detectionLimit === "" ? null : Number(detectionLimit),
      status,
      effectiveAt: toApiDateTime(effectiveAt),
      expiredAt: toApiDateTime(expiredAt),
    };
    try {
      const isEdit = Boolean(selected && editing);
      const payload = await requestJson(isEdit ? `/api/v1/methods/${selected?.id}` : "/api/v1/methods", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isEdit ? { name, scope: scope || null, detectionLimit: body.detectionLimit, status, effectiveAt: body.effectiveAt, expiredAt: body.expiredAt } : body),
      });
      const next = payload.data as MethodView;
      setMethods((items) => isEdit ? items.map((item) => item.id === next.id ? next : item) : [next, ...items]);
      setSelected(next);
      setEditing(false);
      resetForm(next);
      setMessage(isEdit ? "方法版本已更新。" : "方法版本已创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "方法保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function submitAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage) return;
    if (!attachmentFile) {
      setMessage("请先选择附件文件。");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", attachmentFile);
      await requestJson(`/api/v1/methods/${selected.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      await refreshMethod(selected.id);
      setAttachmentFile(null);
      event.currentTarget.reset();
      setMessage("方法附件已成功上传并登记。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "附件登记失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">方法版本列表</h2>
          <p className="mt-1 text-sm text-slate-500">共 {methods.length} 个版本实体</p>
        </div>
        {methods.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无实验方法版本。</div> : methods.map((method) => (
          <button key={method.id} type="button" onClick={() => selectMethod(method)} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selected?.id === method.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{method.methodCode} / {method.version}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{statusLabels[method.status] ?? method.status}</span></div>
            <p className="mt-2 text-sm text-slate-700">{method.name}</p>
            <p className="mt-2 text-xs text-slate-400">{method.scope ?? "未填写适用范围"}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!selected && canManage ? <form className="space-y-4" onSubmit={submit}><h2 className="text-xl font-semibold">新建实验方法版本</h2><MethodFields {...{ methodCode, setMethodCode, name, setName, version, setVersion, scope, setScope, detectionLimit, setDetectionLimit, status, setStatus, effectiveAt, setEffectiveAt, expiredAt, setExpiredAt }} editableIdentity /><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">创建方法版本</button>{message ? <p className="text-sm text-slate-600">{message}</p> : null}</form> : null}
        {!selected && !canManage ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">请选择方法查看详情。</div> : null}
        {selected ? <div className="space-y-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{selected.methodCode} / {selected.version}</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2></div>{canManage ? <button type="button" className="text-sm text-blue-600" onClick={() => { setEditing(!editing); resetForm(selected); }}>{editing ? "取消编辑" : "编辑"}</button> : null}</div>
          {editing && canManage ? <form className="space-y-4" onSubmit={submit}><MethodFields {...{ methodCode, setMethodCode, name, setName, version, setVersion, scope, setScope, detectionLimit, setDetectionLimit, status, setStatus, effectiveAt, setEffectiveAt, expiredAt, setExpiredAt }} /><button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">保存变更</button></form> : <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2"><div><dt className="text-slate-500">状态</dt><dd className="mt-1 font-medium">{statusLabels[selected.status] ?? selected.status}</dd></div><div><dt className="text-slate-500">检出限</dt><dd className="mt-1 font-medium">{selected.detectionLimit ?? "—"}</dd></div><div><dt className="text-slate-500">适用范围</dt><dd className="mt-1 font-medium">{selected.scope ?? "—"}</dd></div><div><dt className="text-slate-500">生效时间</dt><dd className="mt-1 font-medium">{selected.effectiveAt ?? "—"}</dd></div><div><dt className="text-slate-500">失效时间</dt><dd className="mt-1 font-medium">{selected.expiredAt ?? "—"}</dd></div><div><dt className="text-slate-500">版本身份</dt><dd className="mt-1 font-medium">{selected.methodCode} / {selected.version}</dd></div></dl>}

          {canManage ? <form className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4" onSubmit={submitAttachment}><div><h3 className="font-semibold">上传方法附件</h3><p className="mt-1 text-xs text-slate-500">文件会上传到私有 Supabase Storage，并仅保存文件元数据。单个文件不得超过 50 MiB。</p></div><label className="block text-sm text-slate-600">方法文件<input className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} required /></label><button disabled={busy || !attachmentFile} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">上传附件</button></form> : null}

          <section className="space-y-3"><h3 className="font-semibold">变更历史（{selected.history.length}）</h3>{selected.history.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">暂无变更历史。</p> : <ol className="space-y-3 border-l-2 border-slate-200 pl-4">{selected.history.map((item) => <li key={item.id} className="relative"><span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full bg-blue-500" /><p className="text-sm font-medium">{item.changeType}：{item.fromStatus ?? "—"} → {item.toStatus}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.occurredAt).toLocaleString()} · 操作人 {item.operatorId}</p></li>)}</ol>}</section>
          <section className="space-y-3"><h3 className="font-semibold">附件（{selected.attachments.length}）</h3>{selected.attachments.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">暂无附件。</p> : <ul className="space-y-2">{selected.attachments.map((item) => <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{item.fileName}</p><p className="mt-1 text-xs text-slate-500">{item.storagePath} · {item.fileSize} bytes · {item.contentType}</p></li>)}</ul>}</section>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <button className="text-sm text-slate-500" type="button" onClick={() => { setSelected(null); setEditing(false); resetForm(); }}>新建或选择其他方法</button>
        </div> : null}
      </section>
    </div>
  );
}

type MethodFieldsProps = {
  methodCode: string; setMethodCode: (value: string) => void;
  name: string; setName: (value: string) => void;
  version: string; setVersion: (value: string) => void;
  scope: string; setScope: (value: string) => void;
  detectionLimit: string; setDetectionLimit: (value: string) => void;
  status: string; setStatus: (value: string) => void;
  effectiveAt: string; setEffectiveAt: (value: string) => void;
  expiredAt: string; setExpiredAt: (value: string) => void;
  editableIdentity?: boolean;
};

function MethodFields({ methodCode, setMethodCode, name, setName, version, setVersion, scope, setScope, detectionLimit, setDetectionLimit, status, setStatus, effectiveAt, setEffectiveAt, expiredAt, setExpiredAt, editableIdentity = false }: MethodFieldsProps) {
  return <div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-slate-600">方法编号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" value={methodCode} onChange={(event) => setMethodCode(event.target.value)} required disabled={!editableIdentity} /></label><label className="text-sm text-slate-600">方法名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm text-slate-600">版本号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" value={version} onChange={(event) => setVersion(event.target.value)} required disabled={!editableIdentity} /></label><label className="text-sm text-slate-600">状态<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">草稿</option><option value="ACTIVE">启用</option><option value="INACTIVE">停用</option><option value="EXPIRED">过期</option></select></label><label className="text-sm text-slate-600">适用范围<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={scope} onChange={(event) => setScope(event.target.value)} /></label><label className="text-sm text-slate-600">检出限<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" step="any" value={detectionLimit} onChange={(event) => setDetectionLimit(event.target.value)} /></label><label className="text-sm text-slate-600">生效时间<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} /></label><label className="text-sm text-slate-600">失效时间<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="datetime-local" value={expiredAt} onChange={(event) => setExpiredAt(event.target.value)} /></label></div>;
}
