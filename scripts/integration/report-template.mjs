import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envFile = process.env.REPORT_TEMPLATE_ENV_FILE ?? ".env.local";
  const values = Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
  }));
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY || !values.SUPABASE_SERVICE_ROLE_KEY) throw new Error(`Missing Supabase URL, anon key or service role key in ${envFile}`);
  return values;
}

const env = loadEnv();
const tag = `report_template_${Date.now()}`;
const baseUrl = process.env.REPORT_TEMPLATE_BASE_URL ?? "http://127.0.0.1:3020";
const code = `REPORT_TEMPLATE_TEST_${Date.now()}`;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const created = { userId: null, rowId: null };

function assert(condition, message) { if (!condition) throw new Error(message); }
async function must(promise, label) { const result = await promise; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
function cookiesFrom(response) { return (response.headers.getSetCookie?.() ?? []).map((value) => value.split(";", 1)[0]).join("; "); }
async function appRequest(path, options = {}) { const response = await fetch(`${baseUrl}${path}`, options); const body = await response.json().catch(() => null); return { response, body, cookies: cookiesFrom(response) }; }

async function cleanup() {
  if (created.rowId) {
    await service.from("audit_log").delete().eq("object_type", "report_template").eq("object_id", String(created.rowId));
    await service.from("sys_parameter").delete().eq("id", created.rowId);
  }
  if (created.userId) {
    await service.from("audit_log").delete().eq("operator_id", created.userId);
    await service.from("sys_user_role").delete().eq("user_id", created.userId);
    await service.from("sys_user").delete().eq("id", created.userId);
    await service.auth.admin.deleteUser(created.userId);
  }
}

async function main() {
  const role = await must(service.from("sys_role").select("id").eq("code", "SYSTEM_ADMIN").single(), "read system admin role");
  const email = `${tag}@example.invalid`;
  const password = `ReportTemplate!${Date.now()}`;
  const authUser = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: tag, real_name: "Report template test" } });
  if (authUser.error || !authUser.data.user) throw new Error(`create temporary user failed: ${authUser.error?.message ?? "missing user"}`);
  created.userId = authUser.data.user.id;
  await must(service.from("sys_user_role").insert({ user_id: created.userId, role_id: role.id }), "assign system admin role");

  const login = await appRequest("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert(login.response.status === 200 && login.cookies, "temporary user login failed");
  const headers = { "content-type": "application/json", cookie: login.cookies };
  const invalid = await appRequest("/api/v1/settings/report-templates", { method: "POST", headers, body: JSON.stringify({ code: "BAD", name: "invalid", value: "{}" }) });
  assert(invalid.response.status === 400, "invalid report template code was accepted");

  const createdResponse = await appRequest("/api/v1/settings/report-templates", { method: "POST", headers, body: JSON.stringify({ code, name: "Integration template", value: JSON.stringify({ title: "Integration", fields: ["task", "data"] }) }) });
  assert(createdResponse.response.status === 201 && createdResponse.body?.data?.value?.fields?.includes("data"), "report template create failed");
  created.rowId = createdResponse.body.data.id;
  const updated = await appRequest(`/api/v1/settings/report-templates/${code}`, { method: "PATCH", headers, body: JSON.stringify({ value: JSON.stringify({ title: "Updated", fields: ["task", "samples", "data"] }) }) });
  assert(updated.response.status === 200 && updated.body?.data?.value?.title === "Updated", "report template update failed");
  const disabled = await appRequest(`/api/v1/settings/report-templates/${code}`, { method: "PATCH", headers, body: JSON.stringify({ status: "INACTIVE" }) });
  assert(disabled.response.status === 200 && disabled.body?.data?.status === "INACTIVE", "report template status update failed");

  const audit = await must(service.from("audit_log").select("action, operator_id").eq("object_type", "report_template").eq("object_id", String(created.rowId)).order("id"), "read report template audit");
  assert(audit.length === 3 && audit.every((row) => row.operator_id === created.userId), "report template audit parity is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["prefix validation", "template create", "template update", "template disable", "audit parity"], cleanedByFinally: true }));
}

try {
  await main();
} catch (error) {
  console.error(`Report template integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) { console.error(`Report template cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
}
