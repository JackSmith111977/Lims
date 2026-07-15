import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call report management", async ({ page, request }) => {
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Freports/);

  const listResponse = await request.get("/api/v1/reports");
  expect(listResponse.status()).toBe(401);
  const detailResponse = await request.get("/api/v1/reports/1");
  expect(detailResponse.status()).toBe(401);
  const createResponse = await request.post("/api/v1/tasks/1/reports");
  expect(createResponse.status()).toBe(401);
  for (const path of ["/submit-review", "/publish", "/archive"]) {
    const response = await request.post(`/api/v1/reports/1${path}`, { data: {} });
    expect(response.status()).toBe(401);
  }
  const exportResponse = await request.get("/api/v1/reports/1/export");
  expect(exportResponse.status()).toBe(401);
});
