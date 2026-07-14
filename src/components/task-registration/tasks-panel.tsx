"use client";

import { useState, type FormEvent } from "react";

import type { ProjectView, TaskView } from "@/lib/server/task-registration";

type Props = { initialTasks: TaskView[]; initialProjects: ProjectView[]; canManage: boolean };

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

const priorityLabels: Record<string, string> = { LOW: "低", NORMAL: "普通", HIGH: "高" };
const statusLabels: Record<string, string> = { DRAFT: "草稿", ASSIGNED: "已分配", IN_PROGRESS: "进行中", PENDING_REVIEW: "待审核", RETURNED: "已退回", APPROVED: "已通过", ARCHIVED: "已归档" };

export function TasksPanel({ initialTasks, initialProjects, canManage }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<TaskView | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [taskCode, setTaskCode] = useState("");
  const [projectId, setProjectId] = useState(initialProjects[0] ? String(initialProjects[0].id) : "");
  const [methodId, setMethodId] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [remark, setRemark] = useState("");
  const [sampleIds, setSampleIds] = useState("");

  function resetForm(task?: TaskView) {
    setTaskCode(task?.taskCode ?? "");
    setProjectId(String(task?.projectId ?? initialProjects[0]?.id ?? ""));
    setMethodId(task ? String(task.methodId) : "");
    setName(task?.name ?? "");
    setPriority(task?.priority ?? "NORMAL");
    setPlannedStart(task?.plannedStart ?? "");
    setPlannedEnd(task?.plannedEnd ?? "");
    setRemark(task?.remark ?? "");
    setSampleIds(task?.sampleIds.join(", ") ?? "");
  }

  function selectTask(task: TaskView) {
    setSelected(task);
    setEditing(false);
    resetForm(task);
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setMessage(null);
    const parsedSamples = sampleIds.split(",").map((item) => item.trim()).filter(Boolean).map(Number);
    const body = { taskCode, projectId: Number(projectId), methodId: Number(methodId), name, priority, plannedStart: plannedStart || null, plannedEnd: plannedEnd || null, remark: remark || null, sampleIds: parsedSamples };
    try {
      const isEdit = Boolean(selected && editing);
      const payload = await requestJson(isEdit ? `/api/v1/tasks/${selected?.id}` : "/api/v1/tasks", { method: isEdit ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const next = payload.data as TaskView;
      setTasks((items) => isEdit ? items.map((item) => item.id === next.id ? next : item) : [next, ...items]);
      setSelected(next);
      setEditing(false);
      resetForm(next);
      setMessage(isEdit ? "任务已保存。" : "任务已创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)]">
      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">任务列表</h2><p className="mt-1 text-sm text-slate-500">共 {tasks.length} 个任务</p></div>
        {tasks.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无实验任务。</div> : tasks.map((task) => (
          <button key={task.id} type="button" onClick={() => selectTask(task)} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selected?.id === task.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{task.taskCode}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{statusLabels[task.status] ?? task.status}</span></div>
            <p className="mt-2 text-sm text-slate-700">{task.name}</p><p className="mt-2 text-xs text-slate-400">{task.project?.projectCode ?? `项目 #${task.projectId}`} · 优先级 {priorityLabels[task.priority] ?? task.priority}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!selected && !canManage ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">请选择任务查看详情。</div> : null}
        {!selected && canManage ? <form className="space-y-4" onSubmit={submit}><h2 className="text-xl font-semibold">新建实验任务</h2><TaskFields taskCode={taskCode} setTaskCode={setTaskCode} projectId={projectId} setProjectId={setProjectId} methodId={methodId} setMethodId={setMethodId} name={name} setName={setName} priority={priority} setPriority={setPriority} plannedStart={plannedStart} setPlannedStart={setPlannedStart} plannedEnd={plannedEnd} setPlannedEnd={setPlannedEnd} remark={remark} setRemark={setRemark} sampleIds={sampleIds} setSampleIds={setSampleIds} projects={initialProjects} /><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" type="submit">创建任务</button>{message ? <p className="text-sm text-slate-600">{message}</p> : null}</form> : null}
        {selected ? <div className="space-y-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{selected.taskCode}</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2></div>{canManage ? <button type="button" className="text-sm text-blue-600" onClick={() => { setEditing(!editing); resetForm(selected); }}>{editing ? "取消编辑" : "编辑"}</button> : null}</div>{editing && canManage ? <form className="space-y-4" onSubmit={submit}><TaskFields taskCode={taskCode} setTaskCode={setTaskCode} projectId={projectId} setProjectId={setProjectId} methodId={methodId} setMethodId={setMethodId} name={name} setName={setName} priority={priority} setPriority={setPriority} plannedStart={plannedStart} setPlannedStart={setPlannedStart} plannedEnd={plannedEnd} setPlannedEnd={setPlannedEnd} remark={remark} setRemark={setRemark} sampleIds={sampleIds} setSampleIds={setSampleIds} projects={initialProjects} /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">保存任务</button></form> : <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2"><div><dt className="text-slate-500">状态</dt><dd className="mt-1 font-medium">{statusLabels[selected.status] ?? selected.status}</dd></div><div><dt className="text-slate-500">优先级</dt><dd className="mt-1 font-medium">{priorityLabels[selected.priority] ?? selected.priority}</dd></div><div><dt className="text-slate-500">项目</dt><dd className="mt-1 font-medium">{selected.project?.projectCode ?? `#${selected.projectId}`} · {selected.project?.name ?? "—"}</dd></div><div><dt className="text-slate-500">方法版本 ID</dt><dd className="mt-1 font-medium">{selected.methodId}</dd></div><div><dt className="text-slate-500">计划周期</dt><dd className="mt-1 font-medium">{selected.plannedStart ?? "—"} 至 {selected.plannedEnd ?? "—"}</dd></div><div><dt className="text-slate-500">样品 ID</dt><dd className="mt-1 font-medium">{selected.sampleIds.length ? selected.sampleIds.join(", ") : "—"}</dd></div><div className="md:col-span-2"><dt className="text-slate-500">备注</dt><dd className="mt-1 whitespace-pre-wrap">{selected.remark ?? "—"}</dd></div></dl>}{message ? <p className="text-sm text-slate-600">{message}</p> : null}<button className="text-sm text-slate-500" type="button" onClick={() => { setSelected(null); setEditing(false); resetForm(); }}>新建另一个任务</button></div> : null}
      </section>
    </div>
  );
}

function TaskFields({ taskCode, setTaskCode, projectId, setProjectId, methodId, setMethodId, name, setName, priority, setPriority, plannedStart, setPlannedStart, plannedEnd, setPlannedEnd, remark, setRemark, sampleIds, setSampleIds, projects }: { taskCode: string; setTaskCode: (value: string) => void; projectId: string; setProjectId: (value: string) => void; methodId: string; setMethodId: (value: string) => void; name: string; setName: (value: string) => void; priority: string; setPriority: (value: string) => void; plannedStart: string; setPlannedStart: (value: string) => void; plannedEnd: string; setPlannedEnd: (value: string) => void; remark: string; setRemark: (value: string) => void; sampleIds: string; setSampleIds: (value: string) => void; projects: ProjectView[] }) {
  return <div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-slate-600">任务编号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={taskCode} onChange={(event) => setTaskCode(event.target.value)} required /></label><label className="text-sm text-slate-600">任务名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm text-slate-600">所属项目<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={projectId} onChange={(event) => setProjectId(event.target.value)} required><option value="">请选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.name}</option>)}</select></label><label className="text-sm text-slate-600">方法版本 ID<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="1" value={methodId} onChange={(event) => setMethodId(event.target.value)} required /></label><label className="text-sm text-slate-600">优先级<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option></select></label><label className="text-sm text-slate-600">计划开始<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} /></label><label className="text-sm text-slate-600">计划结束<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={plannedEnd} onChange={(event) => setPlannedEnd(event.target.value)} /></label><label className="text-sm text-slate-600">样品 ID（逗号分隔）<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={sampleIds} onChange={(event) => setSampleIds(event.target.value)} placeholder="可留空" /></label><label className="text-sm text-slate-600 md:col-span-2">备注<textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} /></label></div>;
}
