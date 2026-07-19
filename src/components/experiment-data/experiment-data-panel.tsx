"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { ExperimentDataView } from "@/lib/server/experiment-data";
import type { ProcessingRuleView, ProcessingRunView } from "@/lib/server/experiment-processing";
import type { TaskView } from "@/lib/server/task-registration";

type Props = {
  initialTasks: TaskView[];
  canManage: boolean;
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "Operation failed. Please try again.");
  return payload;
}

export function ExperimentDataPanel({ initialTasks, canManage }: Props) {
  const [tasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0] ? String(initialTasks[0].id) : "");
  const [items, setItems] = useState<ExperimentDataView[]>([]);
  const [rules, setRules] = useState<ProcessingRuleView[]>([]);
  const [runs, setRuns] = useState<ProcessingRunView[]>([]);
  const [loadedTaskId, setLoadedTaskId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [executionMode, setExecutionMode] = useState("MANUAL");
  const [dataType, setDataType] = useState("RAW");
  const [sampleId, setSampleId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [metricName, setMetricName] = useState("");
  const [rawValue, setRawValue] = useState("");
  const [processedValue, setProcessedValue] = useState("");
  const [unit, setUnit] = useState("");
  const [sourceType, setSourceType] = useState("MANUAL");
  const [collectedAt, setCollectedAt] = useState("");
  const [remark, setRemark] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [processingBusy, setProcessingBusy] = useState(false);

  const selectedTask = tasks.find((task) => String(task.id) === selectedTaskId) ?? null;
  const visibleItems = loadedTaskId === selectedTaskId ? items : [];
  const selectedSource = visibleItems.find((item) => String(item.id) === selectedSourceId) ?? null;
  const effectiveSourceId = selectedSource ? String(selectedSource.id) : visibleItems[0] ? String(visibleItems[0].id) : "";
  const effectiveRuleId = rules.some((rule) => String(rule.id) === selectedRuleId) ? selectedRuleId : rules[0] ? String(rules[0].id) : "";
  const processingLocked = selectedTask ? ["APPROVED", "ARCHIVED"].includes(selectedTask.status) : false;
  const dataEntryLocked = selectedTask ? ["APPROVED", "ARCHIVED"].includes(selectedTask.status) : false;

  useEffect(() => {
    if (!selectedTaskId) return;
    let active = true;
    void Promise.all([
      requestJson(`/api/v1/tasks/${selectedTaskId}/data`),
      requestJson("/api/v1/processing-rules"),
      requestJson(`/api/v1/tasks/${selectedTaskId}/data/process-runs`),
    ])
      .then(([dataPayload, rulesPayload, runsPayload]) => {
        if (!active) return;
        setItems(dataPayload.data as ExperimentDataView[]);
        setRules(rulesPayload.data as ProcessingRuleView[]);
        setRuns(runsPayload.data as ProcessingRunView[]);
        setLoadedTaskId(selectedTaskId);
      })
      .catch((error) => {
        if (!active) return;
        setItems([]);
        setRules([]);
        setRuns([]);
        setLoadedTaskId(selectedTaskId);
        setMessage(error instanceof Error ? error.message : "Unable to load experiment data.");
      });
    return () => { active = false; };
  }, [selectedTaskId]);

  async function refreshProcessingState() {
    if (!selectedTaskId) return;
    const [dataPayload, runsPayload] = await Promise.all([
      requestJson(`/api/v1/tasks/${selectedTaskId}/data`),
      requestJson(`/api/v1/tasks/${selectedTaskId}/data/process-runs`),
    ]);
    setItems(dataPayload.data as ExperimentDataView[]);
    setRuns(runsPayload.data as ProcessingRunView[]);
    setLoadedTaskId(selectedTaskId);
  }

  function resetEntry() {
    setMetricName("");
    setRawValue("");
    setProcessedValue("");
    setUnit("");
    setRemark("");
    setCollectedAt("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTaskId || !canManage) return;
    setBusy(true);
    setMessage(null);
    const body = {
      sampleId: Number(sampleId),
      instrumentId: instrumentId ? Number(instrumentId) : null,
      dataType,
      metricName,
      rawValue: dataType === "RAW" ? Number(rawValue) : null,
      processedValue: dataType === "RAW" ? null : Number(processedValue),
      unit: unit || null,
      sourceType,
      collectedAt: new Date(collectedAt).toISOString(),
      remark: remark || null,
    };
    try {
      const payload = await requestJson(`/api/v1/tasks/${selectedTaskId}/data`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setItems((current) => [payload.data as ExperimentDataView, ...current]);
      setLoadedTaskId(selectedTaskId);
      resetEntry();
      setMessage("Experiment data recorded. Existing raw records remain immutable.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record experiment data.");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTaskId || !canManage || dataEntryLocked) return;
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setMessage("Choose a CSV or XLSX file first.");
      return;
    }
    setImportBusy(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const payload = await requestJson(`/api/v1/tasks/${selectedTaskId}/data/import`, { method: "POST", body });
      setItems((current) => [...(payload.data as ExperimentDataView[]), ...current]);
      setLoadedTaskId(selectedTaskId);
      form.reset();
      setMessage(`Imported ${payload.importedCount} immutable data record(s) from file.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import experiment data.");
    } finally {
      setImportBusy(false);
    }
  }

  async function processSelectedData() {
    if (!selectedTaskId || !canManage || !effectiveSourceId || !effectiveRuleId) return;
    setProcessingBusy(true);
    setMessage(null);
    try {
      const payload = await requestJson(`/api/v1/tasks/${selectedTaskId}/data/process`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ruleId: Number(effectiveRuleId),
          sourceDataIds: [Number(effectiveSourceId)],
          executionMode,
        }),
      });
      setRuns((current) => [payload.data as ProcessingRunView, ...current]);
      await refreshProcessingState();
      setMessage("Processing completed. A new immutable output record was created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to process experiment data.");
    } finally {
      setProcessingBusy(false);
    }
  }

  if (!tasks.length) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">No available experiment tasks. Register a task first.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.65fr)]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Select experiment task</h2>
          <p className="mt-1 text-sm text-slate-500">Data is traceable to the task, method version and project.</p>
        </div>
        {tasks.map((task) => (
          <button key={task.id} type="button" onClick={() => setSelectedTaskId(String(task.id))} className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selectedTaskId === String(task.id) ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{task.taskCode}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{task.status}</span></div>
            <p className="mt-2 text-sm text-slate-700">{task.name}</p>
            <p className="mt-2 text-xs text-slate-400">Method: {task.method ? `${task.method.methodCode} / ${task.method.version}` : `#${task.methodId}`} · Samples {task.sampleIds.length}</p>
          </button>
        ))}
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">{selectedTask?.taskCode} · Experiment data</h2>
          <p className="mt-1 text-sm text-slate-500">Method: {selectedTask?.method ? `${selectedTask.method.methodCode} / ${selectedTask.method.version}` : "—"}</p>
        </div>
        {canManage ? <form className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4" onSubmit={submit}>
          <h3 className="font-semibold">Record one immutable observation</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-600">Sample ID<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={sampleId} onChange={(event) => setSampleId(event.target.value)} required><option value="">Select a task sample</option>{selectedTask?.sampleIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
            <label className="text-sm text-slate-600">Instrument ID (optional)<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="number" min="1" value={instrumentId} onChange={(event) => setInstrumentId(event.target.value)} /></label>
            <label className="text-sm text-slate-600">Data type<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={dataType} onChange={(event) => { setDataType(event.target.value); setRawValue(""); setProcessedValue(""); }}><option value="RAW">Raw</option><option value="PROCESSED">Processed</option><option value="RESULT">Final result</option></select></label>
            <label className="text-sm text-slate-600">Metric name<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={metricName} onChange={(event) => setMetricName(event.target.value)} required /></label>
            {dataType === "RAW" ? <label className="text-sm text-slate-600">Raw value<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="number" step="any" value={rawValue} onChange={(event) => setRawValue(event.target.value)} required /></label> : <label className="text-sm text-slate-600">Processed/result value<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="number" step="any" value={processedValue} onChange={(event) => setProcessedValue(event.target.value)} required /></label>}
            <label className="text-sm text-slate-600">Unit<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={unit} onChange={(event) => setUnit(event.target.value)} /></label>
            <label className="text-sm text-slate-600">Source<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="MANUAL">Manual</option><option value="FILE">File</option><option value="INSTRUMENT">Instrument</option><option value="API">API</option></select></label>
            <label className="text-sm text-slate-600">Collected at<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" type="datetime-local" value={collectedAt} onChange={(event) => setCollectedAt(event.target.value)} required /></label>
            <label className="text-sm text-slate-600 md:col-span-2">Remark<textarea className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={remark} onChange={(event) => setRemark(event.target.value)} rows={2} /></label>
          </div>
          <button disabled={busy || dataEntryLocked || !selectedTask?.sampleIds.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">Record data</button>
        </form> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">This account has read-only data access.</p>}

        {canManage ? <form className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-4" onSubmit={importFile}>
          <div>
            <h3 className="font-semibold">Import CSV or XLSX</h3>
            <p className="mt-1 text-sm text-slate-500">Use the documented data columns. Imports are limited to 5 MiB and 500 rows.</p>
          </div>
          <input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={dataEntryLocked || importBusy} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button disabled={importBusy || dataEntryLocked} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">{importBusy ? "Importing..." : "Import file"}</button>
          {dataEntryLocked ? <p className="text-xs text-amber-800">This task is locked after approval or archiving.</p> : null}
        </form> : null}

        {canManage ? <section className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <div>
            <h3 className="font-semibold">Process selected data</h3>
            <p className="mt-1 text-sm text-slate-500">Processing creates a new immutable record and keeps the source unchanged.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-600">Source record<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={effectiveSourceId} onChange={(event) => setSelectedSourceId(event.target.value)} disabled={processingLocked || !visibleItems.length}><option value="">Select source data</option>{visibleItems.map((item) => <option key={item.id} value={item.id}>{item.metricName} / {item.dataType} / #{item.id}</option>)}</select></label>
            <label className="text-sm text-slate-600">Rule version<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={effectiveRuleId} onChange={(event) => setSelectedRuleId(event.target.value)} disabled={processingLocked || !rules.length}><option value="">Select processing rule</option>{rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} / {rule.version}</option>)}</select></label>
            <label className="text-sm text-slate-600">Execution mode<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={executionMode} onChange={(event) => setExecutionMode(event.target.value)} disabled={processingLocked}><option value="MANUAL">Manual</option><option value="SIMULATED">Simulated</option></select></label>
          </div>
          <button type="button" disabled={processingBusy || processingLocked || !effectiveSourceId || !effectiveRuleId} onClick={() => void processSelectedData()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{processingBusy ? "Processing..." : "Run processing"}</button>
          {processingLocked ? <p className="text-xs text-amber-800">This task is locked after approval or archiving.</p> : null}
        </section> : null}

        <section className="space-y-3"><h3 className="font-semibold">Historical data ({visibleItems.length})</h3>{visibleItems.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No data records yet.</p> : <div className="space-y-3">{visibleItems.map((item) => <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.metricName} · {item.dataType}</p><span className="text-xs text-slate-500">{new Date(item.collectedAt).toLocaleString()}</span></div><p className="mt-2 text-sm text-slate-700">Value: {item.rawValue ?? item.processedValue} {item.unit ?? ""} · Source: {item.sourceType}</p><p className="mt-1 text-xs text-slate-500">Sample: {item.sample?.sampleCode ?? `#${item.sampleId}`} · Instrument: {item.instrument?.instrumentCode ?? "Manual/not specified"} · Recorder: {item.recordedBy}</p>{item.remark ? <p className="mt-2 text-xs text-slate-600">Remark: {item.remark}</p> : null}</article>)}</div>}</section>
        <section className="space-y-3"><h3 className="font-semibold">Processing runs ({runs.length})</h3>{runs.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No processing runs yet.</p> : <div className="space-y-3">{runs.map((run) => <article key={run.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Run #{run.id} / {run.status}</p><span className="text-xs text-slate-500">{run.rule ? `${run.rule.ruleCode} v${run.rule.version}` : `Rule #${run.ruleId}`}</span></div><p className="mt-2 text-sm text-slate-700">Decision: {run.decision ?? "-"} / Output: {run.outputDataId ? `#${run.outputDataId}` : "none"}</p>{run.explanation ? <p className="mt-1 text-xs text-slate-600">{run.explanation}</p> : null}{run.errorMessage ? <p className="mt-1 text-xs text-rose-700">{run.errorCode}: {run.errorMessage}</p> : null}<p className="mt-1 text-xs text-slate-500">Lineage: {run.lineage.map((item) => `${item.sourceDataId} -> ${item.outputDataId}`).join(", ") || "none"}</p></article>)}</div>}</section>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </section>
    </div>
  );
}
