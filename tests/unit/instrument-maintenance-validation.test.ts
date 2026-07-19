import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildMaintenancePayload } from "@/lib/server/instrument-maintenance";

describe("instrument maintenance validation", () => {
  it("normalizes a regular maintenance record", () => {
    expect(buildMaintenancePayload({ maintenanceType: " repair ", occurredOn: "2026-07-10", result: " PASS ", remark: " checked " })).toEqual({
      maintenance_type: "REPAIR",
      occurred_on: "2026-07-10",
      result: "PASS",
      cycle_days: null,
      next_due_on: null,
      remark: "checked",
    });
  });

  it("requires and validates the exact calibration schedule", () => {
    expect(buildMaintenancePayload({ maintenanceType: "CALIBRATION", occurredOn: "2026-07-10", cycleDays: 30, nextDueOn: "2026-08-09" })).toMatchObject({
      maintenance_type: "CALIBRATION",
      cycle_days: 30,
      next_due_on: "2026-08-09",
    });
    expect(() => buildMaintenancePayload({ maintenanceType: "CALIBRATION", occurredOn: "2026-07-10" })).toThrowError(AdminApiError);
    expect(() => buildMaintenancePayload({ maintenanceType: "CALIBRATION", occurredOn: "2026-07-10", cycleDays: 30, nextDueOn: "2026-08-10" })).toThrowError(AdminApiError);
  });

  it("rejects unsupported types and client-controlled fields", () => {
    expect(() => buildMaintenancePayload({ maintenanceType: "OTHER", occurredOn: "2026-07-10" })).toThrowError(AdminApiError);
    expect(() => buildMaintenancePayload({ maintenanceType: "INSPECTION", occurredOn: "2026-07-10", operatorId: "client" })).toThrowError(AdminApiError);
  });
});
