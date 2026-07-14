"use client";

import { useState, type FormEvent } from "react";

import type { PersonnelView } from "@/lib/server/personnel";

type Props = {
  initialPersonnel: PersonnelView[];
  canManage: boolean;
};

type RecordType = "skills" | "qualifications" | "training";
type RecordValue = Record<string, unknown>;

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

function valueOf(record: RecordValue, key: string) {
  const value = record[key];
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function recordTitle(recordType: RecordType) {
  if (recordType === "skills") return "技能";
  if (recordType === "qualifications") return "资质";
  return "培训";
}

function recordNameKey(recordType: RecordType) {
  if (recordType === "skills") return "skillName";
  if (recordType === "qualifications") return "qualificationName";
  return "trainingName";
}

function AvailabilityBadge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    AVAILABLE: "可用",
    ON_LEAVE: "离岗",
    QUALIFICATION_SUSPENDED: "资格暂停",
    UNAVAILABLE: "不可用",
  };
  const active = value === "AVAILABLE";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{labels[value] ?? value}</span>;
}

function RecordList({ recordType, records, canManage, userId, onChanged }: { recordType: RecordType; records: RecordValue[]; canManage: boolean; userId: string; onChanged: () => void }) {
  async function remove(recordId: unknown) {
    if (!canManage || !window.confirm(`确认删除这条${recordTitle(recordType)}记录吗？`)) return;
    try {
      await requestJson(`/api/v1/personnel/${userId}/${recordType}/${String(recordId)}`, { method: "DELETE" });
      onChanged();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <div className="space-y-2">
      {records.length === 0 ? <p className="text-sm text-slate-500">暂无{recordTitle(recordType)}记录。</p> : records.map((record) => (
        <div key={String(record.id)} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
          <div>
            <p className="font-medium text-slate-800">{valueOf(record, recordNameKey(recordType))}</p>
            <p className="mt-1 text-xs text-slate-500">
              {recordType === "skills" ? `级别：${valueOf(record, "level")} · 失效：${valueOf(record, "expiresAt")}` : null}
              {recordType === "qualifications" ? `状态：${valueOf(record, "status")} · 证书：${valueOf(record, "certificateNo")} · 失效：${valueOf(record, "expiresAt")}` : null}
              {recordType === "training" ? `机构：${valueOf(record, "provider")} · 失效：${valueOf(record, "expiresAt")}` : null}
            </p>
            {valueOf(record, "notes") !== "—" ? <p className="mt-1 text-xs text-slate-500">备注：{valueOf(record, "notes")}</p> : null}
          </div>
          {canManage ? <button className="text-xs text-rose-600 hover:text-rose-700" type="button" onClick={() => void remove(record.id)}>删除</button> : null}
        </div>
      ))}
    </div>
  );
}

export function PersonnelPanel({ initialPersonnel, canManage }: Props) {
  const personnel = initialPersonnel;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PersonnelView | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [realName, setRealName] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("AVAILABLE");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [availabilityUntil, setAvailabilityUntil] = useState("");
  const [recordType, setRecordType] = useState<RecordType>("skills");
  const [recordName, setRecordName] = useState("");
  const [recordStatus, setRecordStatus] = useState("ACTIVE");
  const [recordExpiresAt, setRecordExpiresAt] = useState("");
  const [recordNotes, setRecordNotes] = useState("");

  async function loadDetail(userId: string) {
    setSelectedId(userId);
    setLoading(true);
    setMessage(null);
    try {
      const payload = await requestJson(`/api/v1/personnel/${userId}`);
      const next = payload.data as PersonnelView;
      setDetail(next);
      setRealName(next.realName);
      setAvailabilityStatus(next.availabilityStatus);
      setAvailabilityNote(next.availabilityNote ?? "");
      setAvailabilityUntil(next.availabilityUntil ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取人员详情");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !canManage) return;
    setMessage(null);
    try {
      await requestJson(`/api/v1/personnel/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ realName, availabilityStatus, availabilityNote: availabilityNote || null, availabilityUntil: availabilityUntil || null }),
      });
      setMessage("人员档案已保存。");
      await loadDetail(detail.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !canManage) return;
    const name = recordName.trim();
    if (!name) {
      setMessage("请填写记录名称。");
      return;
    }
    const body: Record<string, unknown> = {
      [recordNameKey(recordType)]: name,
      ...(recordType === "qualifications" ? { status: recordStatus } : {}),
      ...(recordExpiresAt ? { expiresAt: recordExpiresAt } : {}),
      ...(recordNotes.trim() ? { notes: recordNotes.trim() } : {}),
    };
    try {
      await requestJson(`/api/v1/personnel/${detail.id}/${recordType}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setRecordName("");
      setRecordExpiresAt("");
      setRecordNotes("");
      setMessage(`${recordTitle(recordType)}记录已新增。`);
      await loadDetail(detail.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增记录失败");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div><h2 className="text-lg font-semibold">人员列表</h2><p className="mt-1 text-sm text-slate-500">共 {personnel.length} 人</p></div>
        </div>
        {personnel.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无人员档案。</div> : personnel.map((item) => (
          <button key={item.id} type="button" onClick={() => void loadDetail(item.id)} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selectedId === item.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-900">{item.realName}</span><AvailabilityBadge value={item.availabilityStatus} /></div>
            <p className="mt-2 text-sm text-slate-500">{item.position?.name ?? "未设置岗位"} · 部门 #{item.departmentId ?? "—"}</p>
            <p className="mt-2 text-xs text-slate-400">当前任务 {item.taskSummary.total} 个 · 提醒 {item.alerts.length} 条</p>
          </button>
        ))}
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!detail ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">请选择人员查看档案详情。</div> : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
              <div><h2 className="text-xl font-semibold">{detail.realName}</h2><p className="mt-1 text-sm text-slate-500">{detail.username} · {detail.email ?? "未设置邮箱"}</p></div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs ${detail.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{detail.status === "ACTIVE" ? "账户启用" : "账户停用"}</span><AvailabilityBadge value={detail.availabilityStatus} /></div>
            </div>
            {detail.alerts.length > 0 ? <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50 p-4">{detail.alerts.map((alert, index) => <p key={`${alert.code}-${index}`} className={`text-sm ${alert.severity === "BLOCKING" ? "text-rose-700" : "text-amber-700"}`}>{alert.message}</p>)}</div> : <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">当前没有人员状态提醒。</p>}

            {canManage ? <form className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2" onSubmit={saveProfile}>
              <label className="text-sm text-slate-600">姓名<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={realName} onChange={(event) => setRealName(event.target.value)} required /></label>
              <label className="text-sm text-slate-600">业务可用状态<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value)}><option value="AVAILABLE">可用</option><option value="ON_LEAVE">离岗</option><option value="QUALIFICATION_SUSPENDED">资格暂停</option><option value="UNAVAILABLE">不可用</option></select></label>
              <label className="text-sm text-slate-600">状态说明<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={availabilityNote} onChange={(event) => setAvailabilityNote(event.target.value)} /></label>
              <label className="text-sm text-slate-600">预计恢复日期<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="date" value={availabilityUntil} onChange={(event) => setAvailabilityUntil(event.target.value)} /></label>
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white md:col-span-2 md:w-fit" type="submit">保存档案</button>
            </form> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4"><h3 className="font-semibold">任务状态</h3><p className="mt-2 text-sm text-slate-500">当前有效分配：{detail.taskSummary.total} 个</p><div className="mt-3 space-y-2">{detail.taskSummary.tasks.length === 0 ? <p className="text-sm text-slate-500">暂无当前任务。</p> : detail.taskSummary.tasks.map((task) => <div key={task.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{task.taskCode} · {task.name}</p><p className="mt-1 text-xs text-slate-500">{task.status} · 计划结束：{task.plannedEnd ?? "—"}</p></div>)}</div></div>
              <div className="rounded-xl border border-slate-100 p-4"><h3 className="font-semibold">人员信息</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">岗位</dt><dd>{detail.position?.name ?? "未设置"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">部门</dt><dd>#{detail.departmentId ?? "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">状态说明</dt><dd className="text-right">{detail.availabilityNote ?? "—"}</dd></div></dl></div>
            </div>

            {canManage ? <form className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 md:grid-cols-2" onSubmit={addRecord}><h3 className="font-semibold md:col-span-2">新增能力记录</h3><label className="text-sm text-slate-600">记录类型<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={recordType} onChange={(event) => setRecordType(event.target.value as RecordType)}><option value="skills">技能</option><option value="qualifications">资质</option><option value="training">培训</option></select></label><label className="text-sm text-slate-600">名称<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={recordName} onChange={(event) => setRecordName(event.target.value)} required /></label>{recordType === "qualifications" ? <label className="text-sm text-slate-600">资质状态<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)}><option value="ACTIVE">有效</option><option value="SUSPENDED">暂停</option><option value="EXPIRED">失效</option></select></label> : null}<label className="text-sm text-slate-600">失效日期<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="date" value={recordExpiresAt} onChange={(event) => setRecordExpiresAt(event.target.value)} /></label><label className="text-sm text-slate-600 md:col-span-2">备注<textarea className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={recordNotes} onChange={(event) => setRecordNotes(event.target.value)} rows={2} /></label><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white md:w-fit" type="submit">新增记录</button></form> : null}

            <div className="grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-slate-100 p-4"><h3 className="mb-3 font-semibold">技能</h3><RecordList recordType="skills" records={detail.skills} canManage={canManage} userId={detail.id} onChanged={() => void loadDetail(detail.id)} /></div><div className="rounded-xl border border-slate-100 p-4"><h3 className="mb-3 font-semibold">资质</h3><RecordList recordType="qualifications" records={detail.qualifications} canManage={canManage} userId={detail.id} onChanged={() => void loadDetail(detail.id)} /></div><div className="rounded-xl border border-slate-100 p-4"><h3 className="mb-3 font-semibold">培训</h3><RecordList recordType="training" records={detail.training} canManage={canManage} userId={detail.id} onChanged={() => void loadDetail(detail.id)} /></div></div>
            {loading ? <p className="text-sm text-slate-500">正在刷新详情…</p> : null}
            {message ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
