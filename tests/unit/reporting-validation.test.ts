import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildReportTransitionRequest } from "@/lib/server/reporting";

describe("report transition validation", () => {
  it("accepts an optional trimmed remark", () => {
    expect(buildReportTransitionRequest({ remark: "  reviewed  " })).toEqual({ remark: "reviewed" });
    expect(buildReportTransitionRequest({})).toEqual({ remark: null });
  });

  it("rejects client-controlled report identity and snapshot fields", () => {
    expect(() => buildReportTransitionRequest({ status: "PUBLISHED" })).toThrowError(AdminApiError);
    expect(() => buildReportTransitionRequest({ reportPayload: {} })).toThrowError(AdminApiError);
    expect(() => buildReportTransitionRequest({ signatureHash: "a".repeat(64) })).toThrowError(AdminApiError);
    expect(() => buildReportTransitionRequest({ signedBy: "forged-user" })).toThrowError(AdminApiError);
  });

  it("rejects an oversized remark", () => {
    expect(() => buildReportTransitionRequest({ remark: "x".repeat(1001) })).toThrowError(AdminApiError);
  });
});
