import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildSimulatedInstrumentPayload } from "@/lib/server/simulated-instrument";

const base = {
  taskId: 21,
  sampleId: 11,
  dataType: "RAW",
  metricName: "temperature",
  rawValue: 23.5,
  processedValue: null,
  collectedAt: "2026-07-18T08:00:00+08:00",
};

describe("simulated instrument data", () => {
  it("uses the path instrument and forces the instrument source", () => {
    expect(buildSimulatedInstrumentPayload(base, "7")).toEqual({
      taskId: 21,
      body: {
        sampleId: 11,
        dataType: "RAW",
        metricName: "temperature",
        rawValue: 23.5,
        processedValue: null,
        collectedAt: "2026-07-18T08:00:00+08:00",
        instrumentId: 7,
        sourceType: "INSTRUMENT",
      },
    });
    expect(buildSimulatedInstrumentPayload(base, "7").body).not.toHaveProperty("taskId");
  });

  it("rejects client-controlled instrument identity and source", () => {
    expect(() => buildSimulatedInstrumentPayload({ ...base, instrumentId: 8 }, "7")).toThrowError(AdminApiError);
    expect(() => buildSimulatedInstrumentPayload({ ...base, sourceType: "MANUAL" }, "7")).toThrowError(AdminApiError);
  });

  it("requires a task and a valid instrument path", () => {
    expect(() => buildSimulatedInstrumentPayload({ ...base, taskId: null }, "7")).toThrowError(AdminApiError);
    expect(() => buildSimulatedInstrumentPayload(base, "not-an-id")).toThrowError(AdminApiError);
  });
});
