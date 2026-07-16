import { describe, expect, it } from "vitest";

import {
  aggregateStatus,
  calculateCompletionRate,
  parseDashboardFilters,
} from "@/lib/server/dashboard";

describe("dashboard filters", () => {
  it("normalizes supported filters and ISO time bounds", () => {
    const filters = parseDashboardFilters(new URLSearchParams({
      projectId: "7",
      personnelId: "11111111-1111-4111-8111-111111111111",
      sampleStatus: "processed",
      taskStatus: "pending_review",
      from: "2026-07-01",
      to: "2026-07-10T00:00:00+08:00",
      inventoryDays: "45",
    }));

    expect(filters).toMatchObject({
      projectId: 7,
      personnelId: "11111111-1111-4111-8111-111111111111",
      sampleStatus: "PROCESSED",
      taskStatus: "PENDING_REVIEW",
      inventoryDays: 45,
    });
    expect(filters.from).toBe("2026-07-01T00:00:00.000Z");
    expect(filters.to).toBe("2026-07-09T16:00:00.000Z");
  });

  it.each([
    ["invalid project id", { projectId: "0" }],
    ["invalid personnel uuid", { personnelId: "not-a-uuid" }],
    ["invalid sample status", { sampleStatus: "UNKNOWN" }],
    ["invalid task status", { taskStatus: "UNKNOWN" }],
    ["invalid inventory window", { inventoryDays: "366" }],
    ["reversed time range", { from: "2026-07-10", to: "2026-07-01" }],
  ])("rejects %s", (_, values) => {
    expect(() => parseDashboardFilters(new URLSearchParams(values))).toThrowError(/INVALID_QUERY|格式|不受支持|早于|0-365/);
  });
});

describe("dashboard aggregation", () => {
  it("counts status distributions without losing unknown statuses", () => {
    expect(aggregateStatus([{ status: "REGISTERED" }, { status: "REGISTERED" }, { status: "CUSTOM" }], (row) => row.status)).toEqual({
      total: 3,
      byStatus: { REGISTERED: 2, CUSTOM: 1 },
    });
  });

  it("calculates a bounded percentage and handles empty tasks", () => {
    expect(calculateCompletionRate(0, 0)).toBe(0);
    expect(calculateCompletionRate(3, 2)).toBe(66.67);
    expect(calculateCompletionRate(4, 4)).toBe(100);
  });
});
