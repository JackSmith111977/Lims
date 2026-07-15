import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call inventory management", async ({ page, request }) => {
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Finventory/);

  const listResponse = await request.get("/api/v1/inventory/items");
  expect(listResponse.status()).toBe(401);
  const alertsResponse = await request.get("/api/v1/inventory/alerts");
  expect(alertsResponse.status()).toBe(401);
  const detailResponse = await request.get("/api/v1/inventory/items/1");
  expect(detailResponse.status()).toBe(401);
  const createResponse = await request.post("/api/v1/inventory/items", { data: {} });
  expect(createResponse.status()).toBe(401);
  const updateResponse = await request.patch("/api/v1/inventory/items/1", { data: {} });
  expect(updateResponse.status()).toBe(401);
  const transactionListResponse = await request.get("/api/v1/inventory/items/1/transactions");
  expect(transactionListResponse.status()).toBe(401);
  const transactionResponse = await request.post("/api/v1/inventory/items/1/transactions", { data: {} });
  expect(transactionResponse.status()).toBe(401);
});
