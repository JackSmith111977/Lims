import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or query audit logs", async ({ page, request }) => {
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fadmin%2Faudit/);

  const response = await request.get("/api/v1/audit-logs");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTH_REQUIRED" } });
});

test("logout requires an authenticated session and login rejects invalid bodies", async ({ request }) => {
  const logoutResponse = await request.post("/api/v1/auth/logout");
  expect(logoutResponse.status()).toBe(401);
  await expect(logoutResponse.json()).resolves.toMatchObject({ error: { code: "AUTH_REQUIRED" } });

  const loginResponse = await request.post("/api/v1/auth/login", { data: {} });
  expect(loginResponse.status()).toBe(400);
  await expect(loginResponse.json()).resolves.toMatchObject({ error: { code: "INVALID_FIELD" } });
});
