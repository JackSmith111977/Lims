"use client";

import { useState, type FormEvent } from "react";

import type { ProjectView, TaskView } from "@/lib/server/task-registration";
import type { SampleView } from "@/lib/server/sample-registration";

type Props = {
  initialSamples: SampleView[];
  initialProjects: ProjectView[];
  initialTasks: TaskView[];
  canManage: boolean;
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

const statusLabels: Record<string, string> = {
  REGISTERED: "已登记",
  PROCESSING: "处理中",
  PROCESSED: "已处理",
  ARCHIVED: "已归档",
  DISPOSED: "已处置",
};

export function SamplesPanel({ initialSamples, initialProjects, initialTasks, canManage }: Props) {
  const [samples, setSamples] = useState(initialSamples);
  const [selected, setSelected] = useState<SampleView | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sampleCode, setSampleCode] = useState("");
  const [projectId, setProjectId] = useState(initialProjects[0] ? String(initialProjects[0].id) : "");
  const [name, setName] = useState("");
  const [specification, setSpecification] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("");
  const [storageCondition, setStorageCondition] = useState("");
  const [taskIds, setTaskIds] = useState("");

  function resetForm(sample?: SampleView) {
    setSampleCode(sample?.sampleCode ?? "");
    setProjectId(String(sample?.projectId ?? initialProjects[0]?.id ?? ""));
    setName(sample?.name ?? "");
    setSpecification(sample?.specification ?? "");
    setBatchNo(sample?.batchNo ?? "");
    setQuantity(sample ? String(sample.quantity) : "");
    setUnit(sample?.unit ?? "");
    setSource(sample?.source ?? "");
    setStorageCondition(sample?.storageCondition ?? "");
    setTaskIds(sample?.tasks.map((task) => String(task.id)).join(", ") ?? "");
  }

  function selectSample(sample: SampleView) {
    setSelected(sample);
    setEditing(false);
    resetForm(sample);
    setMessage(null);
  }

  function parseTaskIds() {
    const values = taskIds.split(",").map((item) => item.trim()).filter(Boolean);
    if (values.some((value) => !/^\d+$/.test(value))) throw new Error("taskIds 必须是逗号分隔的数字 ID。");
    return [...new Set(values.map(Number))];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setMessage(null);
    try {
      const isEdit = Boolean(selected && editing);
      const parsedTaskIds = parseTaskIds();
      const body = {
        ...(sampleCode.trim() ? { sampleCode } : {}),
        projectId: Number(projectId),
        name,
        specification: specification || null,
        batchNo: batchNo || null,
        quantity,
        unit,
        source: source || null,
        storageCondition: storageCondition || null,
        ...(parsedTaskIds.length > 0 || isEdit ? { taskIds: parsedTaskIds } : {}),
      };
      const payload = await requestJson(isEdit ? `/api/v1/samples/${selected?.id}` : "/api/v1/samples", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = payload.data as SampleView;
      setSamples((items) => isEdit ? items.map((item) => item.id === next.id ? next : item) : [next, ...items]);
      setSelected(next);
      setEditing(false);
      resetForm(next);
      setMessage(isEdit ? "样品已保存。" : "样品已登记。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)]">
      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">样品列表</h2><p className="mt-1 text-sm text-slate-500">共 {samples.length} 个样品</p></div>
        {samples.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无样品记录。</div> : samples.map((sample) => (
          <button key={sample.id} type="button" onClick={() => selectSample(sample)} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selected?.id === sample.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{sample.sampleCode}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{statusLabels[sample.status] ?? sample.status}</span></div>
            <p className="mt-2 text-sm text-slate-700">{sample.name}</p><p className="mt-2 text-xs text-slate-400">{sample.project?.projectCode ?? `项目 #${sample.projectId}`} · {sample.quantity} {sample.unit} · 任务 {sample.tasks.length} 个</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!selected && !canManage ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">请选择样品查看详情。</div> : null}
        {!selected && canManage ? <form className="space-y-4" onSubmit={submit}><h2 className="text-xl font-semibold">登记新样品</h2><SampleFields sampleCode={sampleCode} setSampleCode={setSampleCode} projectId={projectId} setProjectId={setProjectId} name={name} setName={setName} specification={specification} setSpecification={setSpecification} batchNo={batchNo} setBatchNo={setBatchNo} quantity={quantity} setQuantity={setQuantity} unit={unit} setUnit={setUnit} source={source} setSource={setSource} storageCondition={storageCondition} setStorageCondition={setStorageCondition} taskIds={taskIds} setTaskIds={setTaskIds} projects={initialProjects} tasks={initialTasks} /><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" type="submit">登记样品</button>{message ? <p className="text-sm text-slate-600">{message}</p> : null}</form> : null}
        {selected ? <div className="space-y-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{selected.sampleCode}</p><h2 className="mt-1 text-xl font-semibold">{selected.name}</h2></div>{canManage ? <button type="button" className="text-sm text-blue-600" onClick={() => { setEditing(!editing); resetForm(selected); }}>{editing ? "取消编辑" : "编辑"}</button> : null}</div>{editing && canManage ? <form className="space-y-4" onSubmit={submit}><SampleFields sampleCode={sampleCode} setSampleCode={setSampleCode} projectId={projectId} setProjectId={setProjectId} name={name} setName={setName} specification={specification} setSpecification={setSpecification} batchNo={batchNo} setBatchNo={setBatchNo} quantity={quantity} setQuantity={setQuantity} unit={unit} setUnit={setUnit} source={source} setSource={setSource} storageCondition={storageCondition} setStorageCondition={setStorageCondition} taskIds={taskIds} setTaskIds={setTaskIds} projects={initialProjects} tasks={initialTasks} /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">保存样品</button></form> : <div className="space-y-4"><dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2"><div><dt className="text-slate-500">状态</dt><dd className="mt-1 font-medium">{statusLabels[selected.status] ?? selected.status}</dd></div><div><dt className="text-slate-500">项目</dt><dd className="mt-1 font-medium">{selected.project?.projectCode ?? `#${selected.projectId}`} · {selected.project?.name ?? "—"}</dd></div><div><dt className="text-slate-500">数量</dt><dd className="mt-1 font-medium">{selected.quantity} {selected.unit}</dd></div><div><dt className="text-slate-500">批号</dt><dd className="mt-1 font-medium">{selected.batchNo ?? "—"}</dd></div><div><dt className="text-slate-500">规格</dt><dd className="mt-1 font-medium">{selected.specification ?? "—"}</dd></div><div><dt className="text-slate-500">来源</dt><dd className="mt-1 font-medium">{selected.source ?? "—"}</dd></div><div><dt className="text-slate-500">存储条件</dt><dd className="mt-1 font-medium">{selected.storageCondition ?? "—"}</dd></div><div><dt className="text-slate-500">登记时间</dt><dd className="mt-1 font-medium">{new Date(selected.registeredAt).toLocaleString("zh-CN")}</dd></div></dl><div className="rounded-xl border border-slate-100 p-4"><h3 className="font-semibold">关联任务和方法</h3>{selected.tasks.length === 0 ? <p className="mt-2 text-sm text-slate-500">暂无任务关联。</p> : <div className="mt-3 space-y-2">{selected.tasks.map((task) => <div key={task.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{task.taskCode} · {task.name}</p><p className="mt-1 text-xs text-slate-500">{statusLabels[task.status] ?? task.status} · 方法：{task.method ? `${task.method.methodCode} / ${task.method.version}` : "—"}</p></div>)}</div>}</div></div>}{message ? <p className="text-sm text-slate-600">{message}</p> : null}<button className="text-sm text-slate-500" type="button" onClick={() => { setSelected(null); setEditing(false); resetForm(); }}>登记另一个样品</button></div> : null}
      </section>
    </div>
  );
}

function SampleFields({ sampleCode, setSampleCode, projectId, setProjectId, name, setName, specification, setSpecification, batchNo, setBatchNo, quantity, setQuantity, unit, setUnit, source, setSource, storageCondition, setStorageCondition, taskIds, setTaskIds, projects, tasks }: { sampleCode: string; setSampleCode: (value: string) => void; projectId: string; setProjectId: (value: string) => void; name: string; setName: (value: string) => void; specification: string; setSpecification: (value: string) => void; batchNo: string; setBatchNo: (value: string) => void; quantity: string; setQuantity: (value: string) => void; unit: string; setUnit: (value: string) => void; source: string; setSource: (value: string) => void; storageCondition: string; setStorageCondition: (value: string) => void; taskIds: string; setTaskIds: (value: string) => void; projects: ProjectView[]; tasks: TaskView[] }) {
  const availableTasks = tasks.filter((task) => String(task.projectId) === projectId && task.status !== "ARCHIVED");
  return <div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-slate-600">样品编号（可留空自动生成）<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={sampleCode} onChange={(event) => setSampleCode(event.target.value)} placeholder="SMP-YYYYMMDD-XXXXXXXX" /></label><label className="text-sm text-slate-600">所属项目<select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={projectId} onChange={(event) => setProjectId(event.target.value)} required><option value="">请选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.name}</option>)}</select></label><label className="text-sm text-slate-600">样品名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm text-slate-600">规格<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={specification} onChange={(event) => setSpecification(event.target.value)} /></label><label className="text-sm text-slate-600">批号<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={batchNo} onChange={(event) => setBatchNo(event.target.value)} /></label><label className="text-sm text-slate-600">数量<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" step="0.000001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label className="text-sm text-slate-600">单位<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="mg、mL、件" required /></label><label className="text-sm text-slate-600">来源<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={source} onChange={(event) => setSource(event.target.value)} /></label><label className="text-sm text-slate-600 md:col-span-2">存储条件<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={storageCondition} onChange={(event) => setStorageCondition(event.target.value)} placeholder="温度、避光、湿度等" /></label><label className="text-sm text-slate-600 md:col-span-2">关联任务 ID（逗号分隔，可留空）<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={taskIds} onChange={(event) => setTaskIds(event.target.value)} placeholder={availableTasks.length ? availableTasks.map((task) => task.id).join(", ") : "暂无可选任务"} /></label>{availableTasks.length ? <p className="text-xs text-slate-500 md:col-span-2">当前项目可关联任务：{availableTasks.map((task) => `${task.id}（${task.taskCode}）`).join("、")}</p> : null}</div>;
}
