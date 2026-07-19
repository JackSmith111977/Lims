import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envFile = process.env.SIMULATED_INSTRUMENT_ENV_FILE ?? ".env.local";
  const values = Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
  }));
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY || !values.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Missing Supabase URL, anon key or service role key in ${envFile}`);
  }
  return values;
}

const env = loadEnv();
const tag = `sim_instrument_${Date.now()}`;
const baseUrl = process.env.SIMULATED_INSTRUMENT_BASE_URL ?? "http://127.0.0.1:3020";
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const created = { userId: null, methodId: null, projectId: null, taskId: null, sampleId: null, instrumentId: null, dataId: null };

function assert(condition, message) { if (!condition) throw new Error(message); }
async function must(promise, label) { const result = await promise; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }

function cookiesFrom(response) {
  return (response.headers.getSetCookie?.() ?? []).map((value) => value.split(";", 1)[0]).join("; ");
}

async function appRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => null);
  return { response, body, cookies: cookiesFrom(response) };
}

async function cleanup() {
  if (created.dataId) {
    await service.from("audit_log").delete().eq("object_type", "experiment_data").eq("object_id", String(created.dataId));
    await must(service.from("experiment_data").delete().eq("id", created.dataId), "delete simulated data");
  }
  if (created.taskId) {
    await must(service.from("task_sample").delete().eq("task_id", created.taskId), "delete task sample link");
    await must(service.from("experiment_task").delete().eq("id", created.taskId), "delete temporary task");
  }
  if (created.instrumentId) await must(service.from("instrument").delete().eq("id", created.instrumentId), "delete temporary instrument");
  if (created.sampleId) await must(service.from("sample").delete().eq("id", created.sampleId), "delete temporary sample");
  if (created.projectId) await must(service.from("research_project").delete().eq("id", created.projectId), "delete temporary project");
  if (created.methodId) await must(service.from("experiment_method").delete().eq("id", created.methodId), "delete temporary method");
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
  const password = `SimInstrument!${Date.now()}`;
  const authUser = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: tag, real_name: "Simulated instrument test" } });
  if (authUser.error || !authUser.data.user) throw new Error(`create temporary user failed: ${authUser.error?.message ?? "missing user"}`);
  created.userId = authUser.data.user.id;
  await must(service.from("sys_user_role").insert({ user_id: created.userId, role_id: role.id }), "assign system admin role");

  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Simulated instrument method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  created.methodId = method.id;
  const project = await must(service.from("research_project").insert({ project_code: `${tag}_P`, name: "Simulated instrument project", owner_id: created.userId, status: "ACTIVE" }).select("id").single(), "create project");
  created.projectId = project.id;
  const task = await must(service.from("experiment_task").insert({ task_code: `${tag}_T`, project_id: project.id, method_id: method.id, name: "Simulated instrument task", priority: "NORMAL", status: "DRAFT" }).select("id").single(), "create task");
  created.taskId = task.id;
  const sample = await must(service.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Simulated instrument sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  created.sampleId = sample.id;
  await must(service.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), "link sample to task");
  const instrument = await must(service.from("instrument").insert({ instrument_code: `${tag}_I`, name: "Simulated instrument", type: "SIMULATOR", status: "ACTIVE" }).select("id").single(), "create instrument");
  created.instrumentId = instrument.id;

  const login = await appRequest("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert(login.response.status === 200 && login.cookies, "temporary user login failed");
  const headers = { "content-type": "application/json", cookie: login.cookies };
  const simulated = await appRequest(`/api/v1/instruments/${created.instrumentId}/simulate-data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId: created.taskId, sampleId: created.sampleId, dataType: "RAW", metricName: "temperature", rawValue: 23.5, processedValue: null, unit: "°C", collectedAt: "2026-07-18T08:00:00Z" }),
  });
  assert(simulated.response.status === 201, `simulated data request failed with status ${simulated.response.status}`);
  assert(simulated.body?.data?.sourceType === "INSTRUMENT" && simulated.body?.data?.instrumentId === created.instrumentId, "simulated data source or instrument is incorrect");
  created.dataId = simulated.body.data.id;

  const forged = await appRequest(`/api/v1/instruments/${created.instrumentId}/simulate-data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId: created.taskId, sampleId: created.sampleId, dataType: "RAW", metricName: "forged", rawValue: 1, sourceType: "MANUAL", collectedAt: "2026-07-18T08:01:00Z" }),
  });
  assert(forged.response.status === 400 && forged.body?.error?.code === "INVALID_SIMULATOR_FIELD", "forged source type was accepted");

  await must(service.from("instrument").update({ status: "INACTIVE" }).eq("id", created.instrumentId), "disable temporary instrument");
  const inactive = await appRequest(`/api/v1/instruments/${created.instrumentId}/simulate-data`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId: created.taskId, sampleId: created.sampleId, dataType: "RAW", metricName: "inactive", rawValue: 1, collectedAt: "2026-07-18T08:02:00Z" }),
  });
  assert(inactive.response.status === 409 && inactive.body?.error?.code === "INSTRUMENT_NOT_ACTIVE", "inactive instrument was accepted");

  const audit = await must(service.from("audit_log").select("action, operator_id").eq("object_type", "experiment_data").eq("object_id", String(created.dataId)), "read simulated data audit");
  assert(audit.length === 1 && audit[0].action === "CREATE" && audit[0].operator_id === created.userId, "simulated data audit parity is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["ACTIVE instrument write", "forced INSTRUMENT source", "forged source rejection", "inactive instrument rejection", "audit parity"], cleanedByFinally: true }));
}

try {
  await main();
} catch (error) {
  console.error(`Simulated instrument integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(`Simulated instrument cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
