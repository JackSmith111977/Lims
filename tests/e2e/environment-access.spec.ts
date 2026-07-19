import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call environment monitoring", async ({ page, request }) => {
  await page.goto("/environment");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fenvironment/);

  for (const [method, url] of [
    ["GET", "/api/v1/environment/thresholds"],
    ["POST", "/api/v1/environment/thresholds"],
    ["PATCH", "/api/v1/environment/thresholds/1"],
    ["GET", "/api/v1/environment/records"],
    ["POST", "/api/v1/environment/records"],
    ["GET", "/api/v1/environment/alerts"],
  ] as const) {
    const response = method === "GET" ? await request.get(url) : method === "POST" ? await request.post(url, { data: {} }) : await request.patch(url, { data: {} });
    expect(response.status()).toBe(401);
  }
});
