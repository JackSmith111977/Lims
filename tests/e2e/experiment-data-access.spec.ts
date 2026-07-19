import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open or call experiment data entry", async ({ page, request }) => {
  await page.goto("/data");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fdata/);

  const listResponse = await request.get("/api/v1/tasks/1/data");
  expect(listResponse.status()).toBe(401);
  const createResponse = await request.post("/api/v1/tasks/1/data", { data: {} });
  expect(createResponse.status()).toBe(401);
  const importResponse = await request.post("/api/v1/tasks/1/data/import", {
    multipart: { file: { name: "observations.csv", mimeType: "text/csv", buffer: Buffer.from("sampleId,dataType,metricName,rawValue,processedValue,collectedAt\n11,RAW,pH,7.2,,2026-07-15T08:00:00Z") } },
  });
  expect(importResponse.status()).toBe(401);
  const rulesResponse = await request.get("/api/v1/processing-rules");
  expect(rulesResponse.status()).toBe(401);
  const processResponse = await request.post("/api/v1/tasks/1/data/process", { data: {} });
  expect(processResponse.status()).toBe(401);
  const runsResponse = await request.get("/api/v1/tasks/1/data/process-runs");
  expect(runsResponse.status()).toBe(401);
});
