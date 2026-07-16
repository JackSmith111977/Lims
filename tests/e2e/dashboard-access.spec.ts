import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or query dashboard statistics", async ({ page, request }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fdashboard/);

  for (const path of ["/api/v1/dashboard/overview", "/api/v1/dashboard/task-statistics", "/api/v1/dashboard/inventory-alerts"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTH_REQUIRED" } });
  }
});
