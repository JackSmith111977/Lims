import type { ReportTraceView } from "@/lib/server/traceability";

export function TraceabilityPanel({ trace }: { trace: ReportTraceView }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">报告</p><p className="mt-1 font-semibold">{trace.report.reportCode} · v{trace.report.versionNo}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">状态</p><p className="mt-1 font-semibold">{trace.report.status}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">任务</p><p className="mt-1 font-semibold">{trace.task.taskCode}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">生成时间</p><p className="mt-1 text-sm font-medium">{new Date(trace.report.generatedAt).toLocaleString("zh-CN")}</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">任务上下文</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm"><div><p className="text-slate-500">任务编号</p><p className="mt-1 font-medium">{trace.task.taskCode}</p></div><div><p className="text-slate-500">任务名称</p><p className="mt-1 font-medium">{trace.task.name}</p></div><div><p className="text-slate-500">项目 ID</p><p className="mt-1 font-mono">{trace.task.projectId ?? "-"}</p></div><div><p className="text-slate-500">方法版本 ID</p><p className="mt-1 font-mono">{trace.task.methodId ?? "-"}</p></div></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-4"><h2 className="font-semibold">样品（{trace.samples.length}）</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-3">样品编号</th><th className="px-6 py-3">名称</th><th className="px-6 py-3">批号</th><th className="px-6 py-3">状态</th></tr></thead><tbody className="divide-y divide-slate-100">{trace.samples.map((sample) => <tr key={sample.id}><td className="px-6 py-3 font-medium">{sample.sampleCode}</td><td className="px-6 py-3">{sample.name}</td><td className="px-6 py-3">{sample.batchNo ?? "-"}</td><td className="px-6 py-3">{sample.status ?? "-"}</td></tr>)}{trace.samples.length === 0 ? <tr><td className="px-6 py-6 text-center text-slate-500" colSpan={4}>快照中没有样品</td></tr> : null}</tbody></table></div></section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-4"><h2 className="font-semibold">实验数据（{trace.data.length}）</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-3">数据 ID</th><th className="px-6 py-3">样品 ID</th><th className="px-6 py-3">类型</th><th className="px-6 py-3">指标</th><th className="px-6 py-3">数值</th><th className="px-6 py-3">采集时间</th></tr></thead><tbody className="divide-y divide-slate-100">{trace.data.map((item) => <tr key={item.id}><td className="px-6 py-3 font-mono text-xs">{item.id}</td><td className="px-6 py-3 font-mono text-xs">{item.sampleId ?? "-"}</td><td className="px-6 py-3">{item.dataType ?? "-"}</td><td className="px-6 py-3">{item.metricName ?? "-"}</td><td className="px-6 py-3">{item.processedValue ?? item.rawValue ?? "-"} {item.unit ?? ""}</td><td className="px-6 py-3 text-slate-600">{item.collectedAt ? new Date(item.collectedAt).toLocaleString("zh-CN") : "-"}</td></tr>)}{trace.data.length === 0 ? <tr><td className="px-6 py-6 text-center text-slate-500" colSpan={6}>快照中没有实验数据</td></tr> : null}</tbody></table></div></section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-4"><h2 className="font-semibold">审核记录（{trace.reviews.length}）</h2></div><div className="divide-y divide-slate-100">{trace.reviews.map((review) => <article key={review.id} className="px-6 py-4"><div className="flex flex-wrap items-center gap-3"><span className="font-semibold">{review.result ?? "未知"}</span><span className="font-mono text-xs text-slate-400">审核记录 #{review.id}</span><span className="text-xs text-slate-500">{review.reviewedAt ? new Date(review.reviewedAt).toLocaleString("zh-CN") : "-"}</span></div>{review.comment ? <p className="mt-2 text-sm text-slate-600">{review.comment}</p> : null}</article>)}{trace.reviews.length === 0 ? <p className="px-6 py-6 text-center text-slate-500">快照中没有审核记录</p> : null}</div></section>
    </div>
  );
}
