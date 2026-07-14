"use client";

import { useState, type FormEvent } from "react";

import type { TaskHistoryView } from "@/lib/server/task-flow";
import type { ProjectView, TaskView } from "@/lib/server/task-registration";

type Props = {
  initialTasks: TaskView[];
  initialProjects: ProjectView[];
  canManage: boolean;
  canAssign: boolean;
};

type TaskFieldProps = {
  taskCode: string;
  setTaskCode: (value: string) => void;
  projectId: string;
  setProjectId: (value: string) => void;
  methodId: string;
  setMethodId: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  priority: string;
  setPriority: (value: string) => void;
  plannedStart: string;
  setPlannedStart: (value: string) => void;
  plannedEnd: string;
  setPlannedEnd: (value: string) => void;
  remark: string;
  setRemark: (value: string) => void;
  sampleIds: string;
  setSampleIds: (value: string) => void;
  projects: ProjectView[];
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

function parseCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const priorityLabels: Record<string, string> = { LOW: "低", NORMAL: "普通", HIGH: "高" };
const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  ASSIGNED: "已分配",
  IN_PROGRESS: "执行中",
  PENDING_REVIEW: "待审核",
  RETURNED: "已退回",
  APPROVED: "已通过",
  ARCHIVED: "已归档",
};
const nextStatuses: Record<string, string[]> = {
  DRAFT: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["RETURNED", "APPROVED"],
  RETURNED: ["IN_PROGRESS"],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function TasksPanel({ initialTasks, initialProjects, canManage, canAssign }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<TaskView | null>(null);
  const [history, setHistory] = useState<TaskHistoryView[]>([]);
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
  const [userIds, setUserIds] = useState("");
  const [groupIds, setGroupIds] = useState("");
  const [toStatus, setToStatus] = useState("");
  const [transitionRemark, setTransitionRemark] = useState("");
  const [busy, setBusy] = useState(false);

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

  function resetFlowForm(task: TaskView) {
    setUserIds(task.userAssignments.map((item) => item.userId).join(", "));
    setGroupIds(task.groupAssignments.map((item) => String(item.groupId)).join(", "));
    setToStatus(nextStatuses[task.status]?.[0] ?? "");
    setTransitionRemark("");
  }

  async function loadHistory(taskId: number) {
    const payload = await requestJson(`/api/v1/tasks/${taskId}/history`);
    setHistory((payload.data ?? []) as TaskHistoryView[]);
  }

  function selectTask(task: TaskView) {
    setSelected(task);
    setEditing(false);
    resetForm(task);
    resetFlowForm(task);
    setMessage(null);
    void loadHistory(task.id).catch((error) => setMessage(error instanceof Error ? error.message : "无法读取任务历史"));
  }

  async function refreshTask(taskId: number) {
    const payload = await requestJson(`/api/v1/tasks/${taskId}`);
    const next = payload.data as TaskView;
    setTasks((items) => items.map((item) => (item.id === next.id ? next : item)));
    setSelected(next);
    resetFlowForm(next);
    await loadHistory(next.id);
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setMessage(null);
    const parsedSamples = parseCsv(sampleIds).map(Number);
    const body = {
      taskCode,
      projectId: Number(projectId),
      methodId: Number(methodId),
      name,
      priority,
      plannedStart: plannedStart || null,
      plannedEnd: plannedEnd || null,
      remark: remark || null,
      sampleIds: parsedSamples,
    };
    try {
      const isEdit = Boolean(selected && editing);
      const payload = await requestJson(isEdit ? `/api/v1/tasks/${selected?.id}` : "/api/v1/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = payload.data as TaskView;
      setTasks((items) => (isEdit ? items.map((item) => (item.id === next.id ? next : item)) : [next, ...items]));
      setSelected(next);
      resetFlowForm(next);
      setEditing(false);
      resetForm(next);
      await loadHistory(next.id);
      setMessage(isEdit ? "任务已保存。" : "任务已创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canAssign) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestJson(`/api/v1/tasks/${selected.id}/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIds: parseCsv(userIds), groupIds: parseCsv(groupIds).map(Number) }),
      });
      await refreshTask(selected.id);
      setMessage("任务分配已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任务分配失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage || !toStatus) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestJson(`/api/v1/tasks/${selected.id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toStatus, remark: transitionRemark || null }),
      });
      await refreshTask(selected.id);
      setMessage("任务状态已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任务状态更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">任务列表</h2>
          <p className="mt-1 text-sm text-slate-500">共 {tasks.length} 个任务</p>
        </div>
        {tasks.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无实验任务。</div> : tasks.map((task) => (
          <button key={task.id} type="button" onClick={() => selectTask(task)} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selected?.id === task.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{task.taskCode}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{statusLabels[task.status] ?? task.status}</span></div>
            <p className="mt-2 text-sm text-slate-700">{task.name}</p>
            <p className="mt-2 text-xs text-slate-400">{task.project?.projectCode ?? `项目 #${task.projectId}`} · 优先级 {priorityLabels[task.priority] ?? task.priority}</p>
            <p className="mt-2 text-xs text-slate-400">个人分配 {task.userAssignments.length} · 实验组分配 {task.groupAssignments.length}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!selected && !canManage ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">请选择任务查看详情。</div> : null}
        {!selected && canManage ? <form className="space-y-4" onSubmit={submit}><h2 className="text-xl font-semibold">新建实验任务</h2><TaskFields {...{ taskCode, setTaskCode, projectId, setProjectId, methodId, setMethodId, name, setName, priority, setPriority, plannedStart, setPlannedStart, plannedEnd, setPlannedEnd, remark, setRemark, sampleIds, setSampleIds, projects: initialProjects }} /><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" type="submit">创建任务</button>{message ? <p className="text-sm text-slate-600">{message}</p> : null}</form> : null}

        {selected ? <div className="space-y-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{selected.taskCode}</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2></div>{canManage ? <button type="button" className="text-sm text-blue-600" onClick={() => { setEditing(!editing); resetForm(selected); }}>{editing ? "取消编辑" : "编辑"}</button> : null}</div>
          {editing && canManage ? <form className="space-y-4" onSubmit={submit}><TaskFields {...{ taskCode, setTaskCode, projectId, setProjectId, methodId, setMethodId, name, setName, priority, setPriority, plannedStart, setPlannedStart, plannedEnd, setPlannedEnd, remark, setRemark, sampleIds, setSampleIds, projects: initialProjects }} /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">保存任务</button></form> : <>
            <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2"><div><dt className="text-slate-500">状态</dt><dd className="mt-1 font-medium">{statusLabels[selected.status] ?? selected.status}</dd></div><div><dt className="text-slate-500">优先级</dt><dd className="mt-1 font-medium">{priorityLabels[selected.priority] ?? selected.priority}</dd></div><div><dt className="text-slate-500">项目</dt><dd className="mt-1 font-medium">{selected.project?.projectCode ?? `#${selected.projectId}`} · {selected.project?.name ?? "未知项目"}</dd></div><div><dt className="text-slate-500">方法版本 ID</dt><dd className="mt-1 font-medium">{selected.methodId}</dd></div><div><dt className="text-slate-500">计划周期</dt><dd className="mt-1 font-medium">{selected.plannedStart ?? "—"} 至 {selected.plannedEnd ?? "—"}</dd></div><div><dt className="text-slate-500">样品 ID</dt><dd className="mt-1 font-medium">{selected.sampleIds.length ? selected.sampleIds.join(", ") : "—"}</dd></div><div className="md:col-span-2"><dt className="text-slate-500">备注</dt><dd className="mt-1 whitespace-pre-wrap">{selected.remark ?? "—"}</dd></div></dl>

            {canAssign ? <form className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4" onSubmit={submitAssignment}><div><h3 className="font-semibold">任务分配</h3><p className="mt-1 text-xs text-slate-500">用逗号分隔用户 UUID 或实验组 ID；提交会替换当前分配。</p></div><label className="block text-sm text-slate-600">人员 UUID<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={userIds} onChange={(event) => setUserIds(event.target.value)} placeholder="可留空" /></label><label className="block text-sm text-slate-600">实验组 ID<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={groupIds} onChange={(event) => setGroupIds(event.target.value)} placeholder="可留空" /></label><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">保存分配</button></form> : null}

            {canManage && nextStatuses[selected.status]?.length ? <form className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4" onSubmit={submitTransition}><div><h3 className="font-semibold">状态流转</h3><p className="mt-1 text-xs text-slate-500">服务端会校验当前状态、分配关系和操作权限。</p></div><label className="block text-sm text-slate-600">目标状态<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={toStatus} onChange={(event) => setToStatus(event.target.value)}>{nextStatuses[selected.status].map((status) => <option key={status} value={status}>{statusLabels[status] ?? status}</option>)}</select></label><label className="block text-sm text-slate-600">流转备注<textarea className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={transitionRemark} onChange={(event) => setTransitionRemark(event.target.value)} rows={2} /></label><button disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">提交状态</button></form> : null}

            <section className="space-y-3"><div><h3 className="font-semibold">状态历史</h3><p className="mt-1 text-xs text-slate-500">共 {history.length} 条记录</p></div>{history.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">暂无状态流转记录。</p> : <ol className="space-y-3 border-l-2 border-slate-200 pl-4">{history.map((item) => <li key={item.id} className="relative"><span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full bg-blue-500" /><p className="text-sm font-medium">{item.fromStatus ? `${statusLabels[item.fromStatus] ?? item.fromStatus} → ` : "初始 → "}{statusLabels[item.toStatus] ?? item.toStatus}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.occurredAt).toLocaleString()} · 操作人 {item.operatorId}</p>{item.remark ? <p className="mt-1 text-sm text-slate-600">{item.remark}</p> : null}</li>)}</ol>}</section>
          </>}
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}<button className="text-sm text-slate-500" type="button" onClick={() => { setSelected(null); setHistory([]); setEditing(false); resetForm(); }}>新建另一个任务</button>
        </div> : null}
      </section>
    </div>
  );
}

function TaskFields({ taskCode, setTaskCode, projectId, setProjectId, methodId, setMethodId, name, setName, priority, setPriority, plannedStart, setPlannedStart, plannedEnd, setPlannedEnd, remark, setRemark, sampleIds, setSampleIds, projects }: TaskFieldProps) {
  return <div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-slate-600">任务编号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={taskCode} onChange={(event) => setTaskCode(event.target.value)} required /></label><label className="text-sm text-slate-600">任务名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm text-slate-600">所属项目<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={projectId} onChange={(event) => setProjectId(event.target.value)} required><option value="">请选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.name}</option>)}</select></label><label className="text-sm text-slate-600">方法版本 ID<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="1" value={methodId} onChange={(event) => setMethodId(event.target.value)} required /></label><label className="text-sm text-slate-600">优先级<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option></select></label><label className="text-sm text-slate-600">计划开始<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} /></label><label className="text-sm text-slate-600">计划结束<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={plannedEnd} onChange={(event) => setPlannedEnd(event.target.value)} /></label><label className="text-sm text-slate-600">样品 ID（逗号分隔）<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={sampleIds} onChange={(event) => setSampleIds(event.target.value)} placeholder="可留空" /></label><label className="text-sm text-slate-600 md:col-span-2">备注<textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} /></label></div>;
}
