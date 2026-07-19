import { describe, expect, it, vi } from "vitest";

import { getRequestIp, normalizeAuditEmail, recordSystemAudit } from "@/lib/server/audit";
import { AdminApiError } from "@/lib/server/admin";
import { parseAuditFilters, redactAuditJson } from "@/lib/server/audit-data";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

describe("audit logging validation", () => {
  it("normalizes login identifiers without preserving surrounding whitespace", () => {
    expect(normalizeAuditEmail("  Lab.User@Example.COM ")).toBe("lab.user@example.com");
  });

  it("rejects forged forwarding headers before writing the inet column", () => {
    expect(getRequestIp(new Request("http://localhost", { headers: { "x-forwarded-for": "999.999.999.999" } }))).toBeUndefined();
    expect(getRequestIp(new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.10" } }))).toBe("203.0.113.10");
  });

  it("keeps authentication audit payloads to the safe allowlist", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({ insert }),
    } as never);

    await recordSystemAudit({
      action: "LOGIN_SUCCESS",
      objectId: "user-id",
      operatorId: "user-id",
      afterJson: {
        result: "SUCCESS",
        password: "must-not-be-stored",
        accessToken: "must-not-be-stored",
        headers: { authorization: "must-not-be-stored" },
      },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      after_json: { result: "SUCCESS" },
      before_json: null,
    }));
  });

  it("parses bounded filters with the documented default limit", () => {
    expect(parseAuditFilters(new URLSearchParams("objectType=auth&action=LOGIN_FAILURE"))).toEqual({
      objectType: "auth",
      action: "LOGIN_FAILURE",
      operatorId: undefined,
      from: undefined,
      to: undefined,
      limit: 100,
    });
  });

  it("redacts sensitive keys from existing audit payloads before query responses", () => {
    expect(redactAuditJson({ result: "SUCCESS", password: "hidden", nested: { access_token: "hidden", keep: "value" } })).toEqual({
      result: "SUCCESS",
      nested: { keep: "value" },
    });
  });

  it("validates operator, dates and result limits", () => {
    expect(parseAuditFilters(new URLSearchParams("operatorId=feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5&limit=200"))).toMatchObject({
      operatorId: "feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5",
      limit: 200,
    });
    expect(() => parseAuditFilters(new URLSearchParams("operatorId=not-a-uuid"))).toThrowError(AdminApiError);
    expect(() => parseAuditFilters(new URLSearchParams("from=not-a-date"))).toThrowError(AdminApiError);
    expect(() => parseAuditFilters(new URLSearchParams("limit=201"))).toThrowError(AdminApiError);
  });
});
