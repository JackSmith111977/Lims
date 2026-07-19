import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildProjectPayload, buildTaskPayload } from "@/lib/server/task-registration";

describe("task registration validation", () => {
  it("builds project registration fields and trims text", () => {
    expect(buildProjectPayload({
      projectCode: "  PRJ-001  ",
      name: "  稳定性研究  ",
      description: "  项目说明  ",
      status: "ACTIVE",
      startDate: "2026-07-01",
      endDate: "2026-12-31",
    })).toEqual({
      project_code: "PRJ-001",
      name: "稳定性研究",
      description: "项目说明",
      status: "ACTIVE",
      start_date: "2026-07-01",
      end_date: "2026-12-31",
    });
  });

  it("deduplicates sample IDs and keeps task status out of registration", () => {
    expect(buildTaskPayload({
      taskCode: "TASK-001",
      projectId: "10",
      methodId: "20",
      name: "  样品检测  ",
      priority: "HIGH",
      sampleIds: [1, "2", 1],
    })).toEqual({
      payload: { task_code: "TASK-001", project_id: 10, method_id: 20, name: "样品检测", priority: "HIGH" },
      sampleIds: [1, 2],
    });
    expect(() => buildTaskPayload({
      taskCode: "TASK-001",
      projectId: 10,
      methodId: 20,
      name: "样品检测",
      priority: "NORMAL",
      status: "APPROVED",
    })).toThrowError(AdminApiError);
  });

  it("rejects invalid dates, ranges, priorities, and IDs", () => {
    expect(() => buildProjectPayload({ projectCode: "P", name: "项目", startDate: "2026-02-30" })).toThrowError(AdminApiError);
    expect(() => buildProjectPayload({ projectCode: "P", name: "项目", startDate: "2026-08-01", endDate: "2026-07-01" })).toThrowError(AdminApiError);
    expect(() => buildTaskPayload({ taskCode: "T", projectId: 1, methodId: 2, name: "任务", priority: "URGENT" })).toThrowError(AdminApiError);
    expect(() => buildTaskPayload({ taskCode: "T", projectId: 1, methodId: 2, name: "任务", priority: "NORMAL", sampleIds: [0] })).toThrowError(AdminApiError);
  });
});
