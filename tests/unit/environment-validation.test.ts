import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildEnvironmentRecordPayload, buildEnvironmentThresholdPayload } from "@/lib/server/environment";

describe("environment monitoring validation", () => {
  it("normalizes threshold configuration and supports open bounds", () => {
    expect(buildEnvironmentThresholdPayload({
      laboratoryId: "12",
      metric: " temperature ",
      unit: " °C ",
      thresholdMin: "18.50000000",
      thresholdMax: null,
    })).toEqual({ laboratory_id: 12, metric: "temperature", unit: "°C", threshold_min: 18.5, threshold_max: null });
  });

  it("rejects invalid threshold values and forged identity fields", () => {
    expect(() => buildEnvironmentThresholdPayload({ laboratoryId: 1, metric: "TEMP", unit: "C", thresholdMin: 20, thresholdMax: 10 })).not.toThrow();
    expect(() => buildEnvironmentThresholdPayload({ laboratoryId: 1, metric: "TEMP", unit: "C", thresholdMin: "NaN" })).toThrowError(AdminApiError);
    expect(() => buildEnvironmentThresholdPayload({ laboratoryId: 1, metric: "TEMP", unit: "C", thresholdMin: 1, id: 99 })).toThrowError(AdminApiError);
    expect(() => buildEnvironmentThresholdPayload({}, true)).toThrowError(AdminApiError);
  });

  it("normalizes immutable reading payloads and timestamps", () => {
    expect(buildEnvironmentRecordPayload({
      laboratoryId: "7",
      metric: "humidity",
      value: "45.125",
      unit: "%",
      sourceType: "manual",
      collectedAt: "2026-07-16T08:00:00+08:00",
    })).toEqual({
      laboratory_id: 7,
      metric: "humidity",
      value: 45.125,
      unit: "%",
      source_type: "MANUAL",
      collected_at: "2026-07-16T00:00:00.000Z",
    });
  });

  it("rejects unsupported sources and server-controlled fields", () => {
    expect(() => buildEnvironmentRecordPayload({ laboratoryId: 1, metric: "TEMP", value: 20, unit: "C", sourceType: "DEVICE" })).toThrowError(AdminApiError);
    expect(() => buildEnvironmentRecordPayload({ laboratoryId: 1, metric: "TEMP", value: 20, unit: "C", status: "EXCEEDED" })).toThrowError(AdminApiError);
    expect(() => buildEnvironmentRecordPayload({ laboratoryId: 1, metric: "TEMP", value: Infinity, unit: "C" })).toThrowError(AdminApiError);
  });
});
