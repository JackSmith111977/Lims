"use client";

import { useEffect, useState } from "react";

import type { ReviewContext, ReviewResult } from "@/lib/server/result-review";
import type { TaskView } from "@/lib/server/task-registration";

const RESULT_OPTIONS: Array<{ value: ReviewResult; label: string; hint: string }> = [
  { value: "APPROVED", label: "通过", hint: "任务进入已通过状态。" },
  { value: "RETURNED", label: "退回", hint: "任务退回实验人员补充或重新处理。" },
  { value: "NEED_MORE", label: "要求补充", hint: "任务退回并要求补充数据或说明。" },
];

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "审核请求失败。");
  return payload as { data: ReviewContext };
}

function formatValue(rawValue: number | null, processedValue: number | null, unit: string | null) {
  const value = rawValue ?? processedValue;
  return value === null ? "—" : `${value}${unit ? ` ${unit}` : ""}`;
}

export function ResultReviewPanel({ initialTasks, canManage }: { initialTasks: TaskView[]; canManage: boolean }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0] ? String(initialTasks[0].id) : "");
  const [context, setContext] = useState<ReviewContext | null>(null);
  const [result, setResult] = useState<ReviewResult>("APPROVED");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(initialTasks.length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedTaskId) return;
    void requestJson(`/api/v1/tasks/${selectedTaskId}/reviews`)
      .then((payload) => setContext(payload.data))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "无法读取审核上下文。"))
      .finally(() => setLoading(false));
  }, [selectedTaskId]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTaskId) return;
    if (result !== "APPROVED" && comment.trim().length === 0) {
      setMessage("退回或要求补充时必须填写审核意见。");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const payload = await requestJson(`/api/v1/tasks/${selectedTaskId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ result, comment: comment.trim() || null }),
      });
      setContext(payload.data);
      setTasks((current) => current.filter((task) => String(task.id) !== selectedTaskId));
      setSelectedTaskId("");
      setComment("");
      setMessage("审核已提交，任务状态和审核历史已刷新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  if (tasks.length === 0 && !context) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">暂无待审核任务。</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">待审核任务</h2>
            <span className="text-xs text-slate-400">{tasks.length} 个</span>
          </div>
          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? <p className="text-sm text-slate-500">待审核列表已处理完。</p> : tasks.map((task) => (
              <button key={task.id} type="button" onClick={() => { setContext(null); setLoading(true); setMessage(""); setSelectedTaskId(String(task.id)); }} className={`w-full rounded-xl border p-3 text-left text-sm transition ${selectedTaskId === String(task.id) ? "border-blue-400 bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-blue-200"}`}>
                <p className="font-medium text-slate-900">{task.taskCode}</p>
                <p className="mt-1 text-xs text-slate-500">{task.name}</p>
                <p className="mt-2 text-xs text-amber-700">待审核 · {task.priority}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="space-y-5">
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">正在读取审核上下文…</div> : null}
        {context ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{context.task.taskCode}</p><h2 className="mt-1 text-2xl font-semibold">{context.task.name}</h2><p className="mt-2 text-sm text-slate-500">状态：{context.task.status} · 优先级：{context.task.priority}</p></div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">结果审核</span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-xs text-slate-500">实验数据</p><p className="mt-1 font-semibold">{context.data.length} 条</p></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-xs text-slate-500">处理运行</p><p className="mt-1 font-semibold">{context.processingRuns.length} 次</p></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-xs text-slate-500">历史审核</p><p className="mt-1 font-semibold">{context.reviews.length} 条</p></div></div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold">实验结果上下文</h3>
              <div className="mt-4 space-y-3">{context.data.length === 0 ? <p className="text-sm text-slate-500">暂无实验数据。</p> : context.data.map((item) => <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.metricName} · {item.dataType}</p><span className="text-xs text-slate-500">#{item.id}</span></div><p className="mt-2 text-slate-700">值：{formatValue(item.rawValue, item.processedValue, item.unit)} · 来源：{item.sourceType}</p><p className="mt-1 text-xs text-slate-500">采集时间：{new Date(item.collectedAt).toLocaleString("zh-CN")} · 样品 #{item.sampleId}</p>{item.remark ? <p className="mt-2 text-xs text-slate-600">说明：{item.remark}</p> : null}</article>)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold">处理运行与血缘</h3>
              <div className="mt-4 space-y-3">{context.processingRuns.length === 0 ? <p className="text-sm text-slate-500">暂无处理运行。</p> : context.processingRuns.map((run) => <article key={run.id} className="rounded-xl border border-slate-100 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">运行 #{run.id} · 规则 #{run.ruleId}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{run.status}</span></div><p className="mt-2 text-slate-700">判定：{run.decision ?? "—"} · 输出：{run.outputDataId ? `#${run.outputDataId}` : "无"}</p>{run.explanation ? <p className="mt-1 text-xs text-slate-600">说明：{run.explanation}</p> : null}<p className="mt-1 text-xs text-slate-500">血缘：{run.lineage.length ? run.lineage.map((lineage) => `#${lineage.sourceDataId} → #${lineage.outputDataId}`).join("；") : "无"}</p></article>)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold">审核历史</h3>
              <div className="mt-4 space-y-3">{context.reviews.length === 0 ? <p className="text-sm text-slate-500">暂无审核记录。</p> : context.reviews.map((review) => <article key={review.id} className="border-l-2 border-blue-200 pl-3 text-sm"><p className="font-medium">{review.result} · {new Date(review.reviewedAt).toLocaleString("zh-CN")}</p><p className="mt-1 text-xs text-slate-500">审核人：{review.reviewerId}</p>{review.comment ? <p className="mt-1 text-slate-600">{review.comment}</p> : null}</article>)}</div>
            </div>

            {canManage && context.task.status === "PENDING_REVIEW" ? <form className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6" onSubmit={submitReview}><h3 className="font-semibold">提交审核</h3><div className="mt-4 grid gap-3 md:grid-cols-3">{RESULT_OPTIONS.map((option) => <label key={option.value} className={`cursor-pointer rounded-xl border p-3 text-sm ${result === option.value ? "border-blue-400 bg-white" : "border-transparent bg-white/60"}`}><input className="mr-2" type="radio" name="review-result" value={option.value} checked={result === option.value} onChange={() => setResult(option.value)} />{option.label}<span className="mt-1 block text-xs text-slate-500">{option.hint}</span></label>)}</div><label className="mt-4 block text-sm text-slate-600">审核意见{result === "APPROVED" ? "（可选）" : "（必填）"}<textarea className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="记录审核依据、异常或需要补充的内容" /></label><button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={submitting}>{submitting ? "提交中…" : "提交审核"}</button></form> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">当前任务不是待审核状态，或当前账号只有审核查看权限。</p>}
          </>
        ) : null}
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </section>
    </div>
  );
}
