import { expect, test } from "@playwright/test";

test("unauthenticated users cannot open user administration", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fadmin%2Fusers/);
});

test("unauthenticated users cannot call administration APIs", async ({ request }) => {
  const usersResponse = await request.get("/api/v1/users");
  expect(usersResponse.status()).toBe(401);
  await expect(usersResponse.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });

  const rolesResponse = await request.get("/api/v1/roles");
  expect(rolesResponse.status()).toBe(401);
  await expect(rolesResponse.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });
});

test("unauthenticated users cannot open or call settings management", async ({ page, request }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fadmin%2Fsettings/);

  const response = await request.get("/api/v1/settings/laboratories");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });
});

test("unauthenticated users cannot open or call personnel management", async ({ page, request }) => {
  await page.goto("/personnel");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fpersonnel/);

  const response = await request.get("/api/v1/personnel");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });
});

test("unauthenticated users cannot open or call project and task registration", async ({ page, request }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fprojects/);

  const projectResponse = await request.get("/api/v1/projects");
  expect(projectResponse.status()).toBe(401);
  await expect(projectResponse.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });

  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Ftasks/);

  const taskResponse = await request.get("/api/v1/tasks");
  expect(taskResponse.status()).toBe(401);
  await expect(taskResponse.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });
});

test("unauthenticated users cannot open or call sample registration", async ({ page, request }) => {
  await page.goto("/samples");
  await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fsamples/);

  const response = await request.get("/api/v1/samples");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: { code: "AUTH_REQUIRED", message: "请先登录。" },
  });
});
