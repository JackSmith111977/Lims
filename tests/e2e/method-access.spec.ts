import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call method version management", async ({ page, request }) => {
  await page.goto("/methods");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fmethods/);

  const listResponse = await request.get("/api/v1/methods");
  expect(listResponse.status()).toBe(401);
  const createResponse = await request.post("/api/v1/methods", { data: {} });
  expect(createResponse.status()).toBe(401);
  const attachmentResponse = await request.post("/api/v1/methods/1/attachments", { data: {} });
  expect(attachmentResponse.status()).toBe(401);
});
