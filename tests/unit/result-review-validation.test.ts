import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildReviewRequest } from "@/lib/server/result-review";

describe("result review validation", () => {
  it("normalizes an approval and keeps only client-owned fields", () => {
    expect(buildReviewRequest({ result: " approved ", comment: "  verified  " })).toEqual({
      result: "APPROVED",
      comment: "verified",
    });
  });

  it("requires an opinion for returned or additional-data decisions", () => {
    expect(() => buildReviewRequest({ result: "RETURNED" })).toThrowError(AdminApiError);
    expect(() => buildReviewRequest({ result: "NEED_MORE", comment: "   " })).toThrowError(AdminApiError);
  });

  it("rejects unsupported results and server-controlled fields", () => {
    expect(() => buildReviewRequest({ result: "REJECTED", comment: "reason" })).toThrowError(AdminApiError);
    expect(() => buildReviewRequest({ result: "APPROVED", reviewerId: "forged" })).toThrowError(AdminApiError);
  });
});
