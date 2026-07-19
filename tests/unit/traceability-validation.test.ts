import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildReportTrace } from "@/lib/server/traceability";
import type { Database } from "@/types/database";

function reportWith(payload: Database["public"]["Tables"]["experiment_report"]["Row"]["report_payload"]) {
  return {
    id: 7,
    report_code: "RPT-7",
    task_id: 3,
    version_no: 2,
    status: "PUBLISHED",
    report_payload: payload,
    storage_path: null,
    generated_by: "feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5",
    generated_at: "2026-07-16T08:00:00.000Z",
    published_at: "2026-07-16T09:00:00.000Z",
    archived_at: null,
  } as Database["public"]["Tables"]["experiment_report"]["Row"];
}

describe("report traceability snapshot", () => {
  it("maps the immutable report snapshot into the complete trace chain", () => {
    const trace = buildReportTrace(reportWith({
      task: { id: 3, taskCode: "TASK-3", projectId: 1, methodId: 2, name: "pH test", priority: "NORMAL", status: "APPROVED", remark: null },
      samples: [{ id: 11, sampleCode: "S-11", name: "Buffer", specification: null, batchNo: "B1", quantity: 2, unit: "mL", status: "PROCESSED" }],
      data: [{ id: 20, sampleId: 11, instrumentId: 5, dataType: "RAW", metricName: "pH", rawValue: 7.1, processedValue: null, unit: null, sourceType: "MANUAL", collectedAt: "2026-07-16T08:00:00.000Z", recordedBy: "feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5", remark: null }],
      reviews: [{ id: 30, reviewerId: "feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5", result: "APPROVED", comment: "ok", reviewedAt: "2026-07-16T08:30:00.000Z", createdAt: "2026-07-16T08:30:00.000Z" }],
    }));

    expect(trace.report).toMatchObject({ id: 7, reportCode: "RPT-7", taskId: 3, versionNo: 2 });
    expect(trace.task.taskCode).toBe("TASK-3");
    expect(trace.samples).toHaveLength(1);
    expect(trace.data[0]).toMatchObject({ id: 20, sampleId: 11, dataType: "RAW" });
    expect(trace.reviews[0]).toMatchObject({ id: 30, result: "APPROVED" });
  });

  it("keeps absent optional arrays empty and rejects a corrupt task snapshot", () => {
    const trace = buildReportTrace(reportWith({ task: { id: 3, taskCode: "TASK-3", name: "pH test", status: "APPROVED" } }));
    expect(trace.samples).toEqual([]);
    expect(trace.data).toEqual([]);
    expect(trace.reviews).toEqual([]);
    expect(() => buildReportTrace(reportWith({ samples: [] }))).toThrowError(AdminApiError);
  });
});
