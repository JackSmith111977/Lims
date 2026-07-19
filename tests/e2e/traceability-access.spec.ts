import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or query report traceability", async ({ page, request }) => {
  await page.goto("/reports/trace/1");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Freports%2Ftrace%2F1/);

  const response = await request.get("/api/v1/trace/report/1");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTH_REQUIRED" } });
});
