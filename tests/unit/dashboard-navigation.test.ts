import { describe, expect, it } from "vitest";

import { isDashboardNavigationActive } from "@/components/dashboard/dashboard-navigation";

describe("dashboard navigation", () => {
  it("marks the exact module route as active", () => {
    expect(isDashboardNavigationActive("/tasks", "/tasks")).toBe(true);
    expect(isDashboardNavigationActive("/tasks/42", "/tasks")).toBe(true);
  });

  it("does not confuse similarly prefixed routes", () => {
    expect(isDashboardNavigationActive("/tasks-archive", "/tasks")).toBe(false);
    expect(isDashboardNavigationActive("/reports", "/tasks")).toBe(false);
  });
});
