import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildAttachmentPayload, buildMethodPayload } from "@/lib/server/methods";

describe("method version validation", () => {
  it("builds a normalized method version payload", () => {
    expect(buildMethodPayload({
      methodCode: "  UV-001 ",
      name: "UV absorption",
      version: " v1.0 ",
      scope: "water",
      detectionLimit: "0.01",
      status: "active",
      effectiveAt: "2026-07-15T08:00:00+08:00",
      expiredAt: null,
    })).toEqual({
      method_code: "UV-001",
      name: "UV absorption",
      version: "v1.0",
      scope: "water",
      detection_limit: 0.01,
      status: "ACTIVE",
      effective_at: "2026-07-15T00:00:00.000Z",
      expired_at: null,
    });
  });

  it("requires a complete version on create and rejects identity mutation", () => {
    expect(() => buildMethodPayload({ methodCode: "M-001", name: "only name" })).toThrowError(AdminApiError);
    expect(() => buildMethodPayload({ version: "v2" }, true)).toThrowError(AdminApiError);
    expect(() => buildMethodPayload({ methodCode: "M-001" }, true)).toThrowError(AdminApiError);
  });

  it("rejects invalid states, limits and date ranges", () => {
    expect(() => buildMethodPayload({ methodCode: "M-001", name: "method", version: "v1", status: "BROKEN" })).toThrowError(AdminApiError);
    expect(() => buildMethodPayload({ methodCode: "M-001", name: "method", version: "v1", detectionLimit: -1 })).toThrowError(AdminApiError);
    expect(() => buildMethodPayload({ methodCode: "M-001", name: "method", version: "v1", effectiveAt: "2026-07-16T00:00:00Z", expiredAt: "2026-07-15T00:00:00Z" })).toThrowError(AdminApiError);
  });

  it("validates attachment metadata and keeps server-owned fields out", () => {
    expect(buildAttachmentPayload({ fileName: "method.pdf", storagePath: "methods/1/method.pdf", fileSize: "12", contentType: "application/pdf" })).toEqual({
      file_name: "method.pdf",
      storage_path: "methods/1/method.pdf",
      file_size: 12,
      content_type: "application/pdf",
    });
    expect(() => buildAttachmentPayload({ fileName: "method.pdf", storagePath: "x", fileSize: 1, contentType: "application/pdf", uploadedBy: "forged" })).toThrowError(AdminApiError);
    expect(() => buildAttachmentPayload({ fileName: "method.pdf", storagePath: "x", fileSize: 1.5, contentType: "application/pdf" })).toThrowError(AdminApiError);
  });
});
