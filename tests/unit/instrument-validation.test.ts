import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildInstrumentPayload } from "@/lib/server/instruments";

describe("instrument validation", () => {
  it("normalizes a create payload", () => {
    expect(buildInstrumentPayload({ instrumentCode: " INS-1 ", name: "  Analyzer ", type: " TEST ", status: "active", model: " M1 " })).toEqual({
      instrument_code: "INS-1",
      name: "Analyzer",
      type: "TEST",
      model: "M1",
      status: "ACTIVE",
    });
  });

  it("keeps identity and lifecycle dates out of updates", () => {
    expect(() => buildInstrumentPayload({ instrumentCode: "NEW" }, true)).toThrowError(AdminApiError);
    expect(() => buildInstrumentPayload({ commissionedAt: "2026-07-01" }, true)).toThrowError(AdminApiError);
  });

  it("rejects invalid initial status and dates", () => {
    expect(() => buildInstrumentPayload({ instrumentCode: "INS-1", name: "Analyzer", type: "TEST", status: "SCRAPPED" })).toThrowError(AdminApiError);
    expect(() => buildInstrumentPayload({ instrumentCode: "INS-1", name: "Analyzer", type: "TEST", commissionedAt: "2026-02-30" })).toThrowError(AdminApiError);
  });
});
