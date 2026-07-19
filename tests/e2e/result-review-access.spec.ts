import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call result review", async ({ page, request }) => {
  await page.goto("/reviews");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Freviews/);

  const listResponse = await request.get("/api/v1/tasks/1/reviews");
  expect(listResponse.status()).toBe(401);
  const reviewResponse = await request.post("/api/v1/tasks/1/reviews", { data: {} });
  expect(reviewResponse.status()).toBe(401);
});
