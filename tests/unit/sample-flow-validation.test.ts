import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildFlowPayload, parseFlowNode } from "@/lib/server/sample-registration";

describe("sample flow validation", () => {
  it("normalizes supported nodes and optional event fields", () => {
    expect(buildFlowPayload({
      node: " transfer ",
      location: "  冷藏柜 A-03  ",
      handoverTo: "00000000-0000-4000-8000-000000000001",
      remark: "  转交检测人员  ",
    })).toEqual({
      node: "TRANSFER",
      location: "冷藏柜 A-03",
      handoverTo: "00000000-0000-4000-8000-000000000001",
      remark: "转交检测人员",
    });
  });

  it("rejects invalid nodes, handover IDs, and client-controlled state fields", () => {
    expect(() => parseFlowNode("UNKNOWN")).toThrowError(AdminApiError);
    expect(() => buildFlowPayload({ node: "COLLECT", handoverTo: "not-a-uuid" })).toThrowError(AdminApiError);
    expect(() => buildFlowPayload({ node: "PROCESS", toStatus: "ARCHIVED" })).toThrowError(AdminApiError);
    try {
      buildFlowPayload({ node: "PROCESS", operatorId: "forged" });
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "INVALID_FLOW_FIELD" });
    }
  });

  it("accepts nullable location, handover, and remark", () => {
    expect(buildFlowPayload({ node: "COLLECT", location: null, handoverTo: null, remark: null })).toEqual({
      node: "COLLECT",
      location: null,
      handoverTo: null,
      remark: null,
    });
  });
});
