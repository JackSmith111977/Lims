import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildAssignmentPayload, buildTransitionPayload } from "@/lib/server/task-flow";

describe("task flow validation", () => {
  it("normalizes assignment targets and removes duplicate IDs", () => {
    expect(buildAssignmentPayload({
      userIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001"],
      groupIds: ["12", 12],
    })).toEqual({
      userIds: ["00000000-0000-4000-8000-000000000001"],
      groupIds: [12],
    });
  });

  it("allows an explicit empty target list for clearing assignments", () => {
    expect(buildAssignmentPayload({ userIds: [], groupIds: [] })).toEqual({ userIds: [], groupIds: [] });
  });

  it("requires assignment fields and rejects server-controlled transition fields", () => {
    expect(() => buildAssignmentPayload({})).toThrowError(AdminApiError);
    expect(() => buildAssignmentPayload({ userIds: ["not-a-uuid"] })).toThrowError(AdminApiError);
    expect(() => buildTransitionPayload({ toStatus: "IN_PROGRESS", operatorId: "forged" })).toThrowError(AdminApiError);
    expect(() => buildTransitionPayload({ toStatus: "DRAFT" })).toThrowError(AdminApiError);
  });

  it("normalizes transition status and optional remark", () => {
    expect(buildTransitionPayload({ toStatus: " pending_review ", remark: "  needs review  " })).toEqual({
      toStatus: "PENDING_REVIEW",
      remark: "needs review",
    });
  });
});
