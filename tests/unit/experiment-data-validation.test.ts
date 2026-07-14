import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildExperimentDataPayload } from "@/lib/server/experiment-data";

const base = {
  sampleId: 11,
  dataType: "RAW",
  metricName: "pH",
  rawValue: 7.2,
  processedValue: null,
  sourceType: "MANUAL",
  collectedAt: "2026-07-15T08:00:00+08:00",
};

describe("experiment data validation", () => {
  it("builds an immutable raw data payload", () => {
    expect(buildExperimentDataPayload(base)).toMatchObject({
      sample_id: 11,
      data_type: "RAW",
      raw_value: 7.2,
      processed_value: null,
      collected_at: "2026-07-15T00:00:00.000Z",
    });
  });

  it("requires processed values for processed and result records", () => {
    expect(() => buildExperimentDataPayload({ ...base, dataType: "PROCESSED", rawValue: null, processedValue: 7.1 })).not.toThrow();
    expect(() => buildExperimentDataPayload({ ...base, dataType: "RESULT", rawValue: 7.2, processedValue: null })).toThrowError(AdminApiError);
  });

  it("rejects overlapping raw and processed values", () => {
    expect(() => buildExperimentDataPayload({ ...base, rawValue: 7.2, processedValue: 7.1 })).toThrowError(AdminApiError);
  });

  it("rejects forged server fields, invalid source and non-finite values", () => {
    expect(() => buildExperimentDataPayload({ ...base, recordedBy: "forged" })).toThrowError(AdminApiError);
    expect(() => buildExperimentDataPayload({ ...base, sourceType: "UNKNOWN" })).toThrowError(AdminApiError);
    expect(() => buildExperimentDataPayload({ ...base, rawValue: Number.NaN })).toThrowError(AdminApiError);
  });
});
