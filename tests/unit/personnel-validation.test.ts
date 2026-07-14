import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import {
  buildPersonnelRecordPayload,
  buildPersonnelUpdate,
  parseAvailabilityStatus,
} from "@/lib/server/personnel";

describe("personnel validation", () => {
  it("separates account status from business availability fields", () => {
    expect(buildPersonnelUpdate({
      realName: "  张三  ",
      departmentId: "12",
      positionId: null,
      availabilityStatus: "ON_LEAVE",
      availabilityNote: "外出培训",
      availabilityUntil: "2026-08-01",
    })).toEqual({
      real_name: "张三",
      department_id: 12,
      position_id: null,
      availability_status: "ON_LEAVE",
      availability_note: "外出培训",
      availability_until: "2026-08-01",
    });
  });

  it("does not allow personnel API to change login status", () => {
    expect(() => buildPersonnelUpdate({ status: "INACTIVE" })).toThrowError(AdminApiError);
    try {
      buildPersonnelUpdate({ status: "INACTIVE" });
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: "PERSONNEL_ACCOUNT_STATUS_FORBIDDEN" });
    }
  });

  it("validates availability and date ranges", () => {
    expect(parseAvailabilityStatus("AVAILABLE")).toBe("AVAILABLE");
    expect(() => parseAvailabilityStatus("UNKNOWN")).toThrowError(AdminApiError);
    expect(() => buildPersonnelUpdate({ availabilityUntil: "2026-02-30" })).toThrowError(AdminApiError);
    expect(() => buildPersonnelRecordPayload("qualifications", {
      qualificationName: "危险化学品操作",
      issuedAt: "2026-07-10",
      expiresAt: "2026-07-01",
    })).toThrowError(AdminApiError);
  });

  it("builds typed capability record payloads", () => {
    expect(buildPersonnelRecordPayload("skills", {
      skillName: "液相色谱",
      level: "熟练",
      verifiedAt: "2026-07-01",
    })).toMatchObject({ skill_name: "液相色谱", level: "熟练", verified_at: "2026-07-01" });
    expect(buildPersonnelRecordPayload("training", {
      trainingName: "实验室安全",
      expiresAt: null,
      notes: "年度培训",
    })).toMatchObject({ training_name: "实验室安全", expires_at: null, notes: "年度培训" });
  });
});
