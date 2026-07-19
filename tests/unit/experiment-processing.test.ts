import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import {
  applyProcessingRule,
  buildProcessingRequest,
  type ProcessingRuleView,
} from "@/lib/server/experiment-processing";

const roundRule: ProcessingRuleView = {
  id: 1,
  ruleCode: "ROUND-DEFAULT",
  name: "Default rounding",
  version: "1.0",
  ruleType: "ROUND",
  config: { scale: 2, roundingMode: "HALF_UP" },
  status: "ACTIVE",
};

const thresholdRule: ProcessingRuleView = {
  id: 2,
  ruleCode: "THRESHOLD-DEFAULT",
  name: "Default threshold",
  version: "1.0",
  ruleType: "THRESHOLD",
  config: { min: 0, max: 100, inclusiveMin: true, inclusiveMax: true },
  status: "ACTIVE",
};

describe("experiment processing rules", () => {
  it("normalizes a processing request and rejects server-owned fields", () => {
    expect(buildProcessingRequest({
      ruleId: "1",
      sourceDataIds: ["10"],
      executionMode: "manual",
    })).toEqual({ ruleId: 1, sourceDataIds: [10], executionMode: "MANUAL" });
    expect(() => buildProcessingRequest({
      ruleId: 1,
      sourceDataIds: [10],
      executionMode: "MANUAL",
      outputDataId: 99,
    })).toThrowError(AdminApiError);
  });

  it("rounds numeric data into a new processed value", () => {
    expect(applyProcessingRule(roundRule, {
      data_type: "RAW",
      raw_value: 12.345,
      processed_value: null,
    })).toMatchObject({
      outputType: "PROCESSED",
      processedValue: 12.35,
      status: "SUCCEEDED",
      decision: "PASS",
    });
  });

  it("marks an out-of-range threshold as flagged without changing the input", () => {
    expect(applyProcessingRule(thresholdRule, {
      data_type: "RAW",
      raw_value: 101,
      processed_value: null,
    })).toMatchObject({
      outputType: "RESULT",
      processedValue: 101,
      status: "FLAGGED",
      decision: "FAIL",
    });
  });

  it("rejects a source row without a finite numeric value", () => {
    expect(() => applyProcessingRule(roundRule, {
      data_type: "PROCESSED",
      raw_value: null,
      processed_value: null,
    })).toThrowError(AdminApiError);
  });
});
