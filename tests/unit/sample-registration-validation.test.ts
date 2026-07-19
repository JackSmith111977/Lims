import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildSamplePayload } from "@/lib/server/sample-registration";

describe("sample registration validation", () => {
  it("normalizes manual codes and parses registration fields", () => {
    expect(buildSamplePayload({
      sampleCode: "  smp-20260715-a1  ",
      projectId: "12",
      name: "  水样  ",
      specification: "  过滤后  ",
      batchNo: "B-01",
      quantity: "1.250000",
      unit: "mL",
      source: "采样点 A",
      storageCondition: "4°C",
      taskIds: [7, "7", 8],
    })).toEqual({
      payload: {
        sample_code: "SMP-20260715-A1",
        project_id: 12,
        name: "水样",
        specification: "过滤后",
        batch_no: "B-01",
        quantity: 1.25,
        unit: "mL",
        source: "采样点 A",
        storage_condition: "4°C",
      },
      taskIds: [7, 8],
    });
  });

  it("allows nullable registration fields and leaves task links optional", () => {
    expect(buildSamplePayload({
      projectId: 12,
      name: "试剂",
      quantity: 0,
      unit: "g",
      specification: null,
      batchNo: null,
      source: null,
      storageCondition: null,
    })).toEqual({
      payload: {
        project_id: 12,
        name: "试剂",
        specification: null,
        batch_no: null,
        quantity: 0,
        unit: "g",
        source: null,
        storage_condition: null,
      },
      taskIds: undefined,
    });
  });

  it("keeps sample status under the T-204 flow boundary", () => {
    expect(() => buildSamplePayload({
      projectId: 12,
      name: "样品",
      quantity: 1,
      unit: "件",
      status: "ARCHIVED",
    })).toThrowError(AdminApiError);
    try {
      buildSamplePayload({ status: "ARCHIVED" });
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: "SAMPLE_STATUS_DEFERRED" });
    }
  });

  it("rejects invalid codes, quantities, task IDs, and empty updates", () => {
    expect(() => buildSamplePayload({ sampleCode: "样品 1", projectId: 1, name: "样品", quantity: 1, unit: "件" })).toThrowError(AdminApiError);
    expect(() => buildSamplePayload({ projectId: 1, name: "样品", quantity: "1.1234567", unit: "件" })).toThrowError(AdminApiError);
    expect(() => buildSamplePayload({ projectId: 1, name: "样品", quantity: -1, unit: "件" })).toThrowError(AdminApiError);
    expect(() => buildSamplePayload({ projectId: 1, name: "样品", quantity: 1, unit: "件", taskIds: [0] })).toThrowError(AdminApiError);
    expect(() => buildSamplePayload({}, true)).toThrowError(AdminApiError);
  });
});
