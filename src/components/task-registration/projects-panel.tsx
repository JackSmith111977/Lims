"use client";

import { useState, type FormEvent } from "react";

import type { ProjectView } from "@/lib/server/task-registration";

type Props = { initialProjects: ProjectView[]; canManage: boolean };

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

const statusLabels: Record<string, string> = { DRAFT: "草稿", ACTIVE: "进行中", ARCHIVED: "已归档" };

export function ProjectsPanel({ initialProjects, canManage }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [selected, setSelected] = useState<ProjectView | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function resetForm(project?: ProjectView) {
    setCode(project?.projectCode ?? "");
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? "DRAFT");
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
  }

  function selectProject(project: ProjectView) {
    setSelected(project);
    setEditing(false);
    resetForm(project);
    setMessage(null);
  }

  async function refresh(id?: number) {
    const payload = await requestJson(id ? `/api/v1/projects/${id}` : "/api/v1/projects");
    if (id) {
      const next = payload.data as ProjectView;
      setSelected(next);
      setProjects((items) => items.map((item) => item.id === next.id ? next : item));
      resetForm(next);
    } else setProjects(payload.data as ProjectView[]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setMessage(null);
    const body = { projectCode: code, name, description: description || null, status, startDate: startDate || null, endDate: endDate || null };
    try {
      const payload = await requestJson(selected && editing ? `/api/v1/projects/${selected.id}` : "/api/v1/projects", {
        method: selected && editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = payload.data as ProjectView;
      setProjects((items) => selected && editing ? items.map((item) => item.id === next.id ? next : item) : [next, ...items]);
      setSelected(next);
      setEditing(false);
      resetForm(next);
      setMessage(selected && editing ? "项目已保存。" : "项目已创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.5fr)]">
      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">项目列表</h2><p className="mt-1 text-sm text-slate-500">共 {projects.length} 个项目</p></div>
        {projects.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无科研项目。</div> : projects.map((project) => (
          <button key={project.id} type="button" onClick={() => selectProject(project)} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selected?.id === project.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{project.projectCode}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{statusLabels[project.status] ?? project.status}</span></div>
            <p className="mt-2 text-sm text-slate-700">{project.name}</p><p className="mt-2 text-xs text-slate-400">任务 {project.taskCount} 个 · 负责人 {project.ownerId.slice(0, 8)}…</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!selected && !canManage ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">请选择项目查看详情。</div> : null}
        {!selected && canManage ? <form className="space-y-4" onSubmit={submit}><h2 className="text-xl font-semibold">新建科研项目</h2><ProjectFields code={code} setCode={setCode} name={name} setName={setName} description={description} setDescription={setDescription} status={status} setStatus={setStatus} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} /><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" type="submit">创建项目</button>{message ? <p className="text-sm text-slate-600">{message}</p> : null}</form> : null}
        {selected ? <div className="space-y-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{selected.projectCode}</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2></div>{canManage ? <button type="button" className="text-sm text-blue-600" onClick={() => { setEditing(!editing); resetForm(selected); }}>{editing ? "取消编辑" : "编辑"}</button> : null}</div>{editing && canManage ? <form className="space-y-4" onSubmit={submit}><ProjectFields code={code} setCode={setCode} name={name} setName={setName} description={description} setDescription={setDescription} status={status} setStatus={setStatus} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">保存项目</button></form> : <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2"><div><dt className="text-slate-500">状态</dt><dd className="mt-1 font-medium">{statusLabels[selected.status] ?? selected.status}</dd></div><div><dt className="text-slate-500">任务数量</dt><dd className="mt-1 font-medium">{selected.taskCount}</dd></div><div><dt className="text-slate-500">计划周期</dt><dd className="mt-1 font-medium">{selected.startDate ?? "—"} 至 {selected.endDate ?? "—"}</dd></div><div><dt className="text-slate-500">负责人</dt><dd className="mt-1 font-medium break-all">{selected.ownerId}</dd></div><div className="md:col-span-2"><dt className="text-slate-500">项目说明</dt><dd className="mt-1 whitespace-pre-wrap">{selected.description ?? "—"}</dd></div></dl>}{message ? <p className="text-sm text-slate-600">{message}</p> : null}<button className="text-sm text-slate-500" type="button" onClick={() => { setSelected(null); setEditing(false); resetForm(); void refresh(); }}>新建另一个项目</button></div> : null}
      </section>
    </div>
  );
}

function ProjectFields({ code, setCode, name, setName, description, setDescription, status, setStatus, startDate, setStartDate, endDate, setEndDate }: { code: string; setCode: (value: string) => void; name: string; setName: (value: string) => void; description: string; setDescription: (value: string) => void; status: string; setStatus: (value: string) => void; startDate: string; setStartDate: (value: string) => void; endDate: string; setEndDate: (value: string) => void }) {
  return <div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-slate-600">项目编号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={code} onChange={(event) => setCode(event.target.value)} required /></label><label className="text-sm text-slate-600">项目名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm text-slate-600">状态<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">草稿</option><option value="ACTIVE">进行中</option><option value="ARCHIVED">已归档</option></select></label><label className="text-sm text-slate-600">开始日期<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="text-sm text-slate-600">结束日期<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><label className="text-sm text-slate-600 md:col-span-2">项目说明<textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label></div>;
}
