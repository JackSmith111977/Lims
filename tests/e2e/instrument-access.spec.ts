import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call instrument management", async ({ page, request }) => {
  await page.goto("/instruments");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Finstruments/);

  const listResponse = await request.get("/api/v1/instruments");
  expect(listResponse.status()).toBe(401);
  const detailResponse = await request.get("/api/v1/instruments/1");
  expect(detailResponse.status()).toBe(401);
  const createResponse = await request.post("/api/v1/instruments", { data: {} });
  expect(createResponse.status()).toBe(401);
  const updateResponse = await request.patch("/api/v1/instruments/1", { data: {} });
  expect(updateResponse.status()).toBe(401);
  const maintenanceResponse = await request.get("/api/v1/instruments/1/maintenance");
  expect(maintenanceResponse.status()).toBe(401);
  const createMaintenanceResponse = await request.post("/api/v1/instruments/1/maintenance", { data: {} });
  expect(createMaintenanceResponse.status()).toBe(401);
  const reminderResponse = await request.get("/api/v1/instruments/maintenance/reminders");
  expect(reminderResponse.status()).toBe(401);
});
