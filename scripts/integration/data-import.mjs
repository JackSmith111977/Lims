import fs from "node:fs";

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envFile = process.env.DATA_IMPORT_ENV_FILE ?? ".env.local";
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
const tag = `data_import_${Date.now()}`;
const baseUrl = process.env.DATA_IMPORT_BASE_URL ?? "http://127.0.0.1:3020";
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const created = { userId: null, taskId: null, projectId: null, sampleId: null, methodId: null, instrumentId: null };

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

async function deleteUser(userId) {
  if (!userId) return;
  await service.from("audit_log").delete().eq("operator_id", userId);
  await service.from("sys_user_role").delete().eq("user_id", userId);
  await service.from("sys_user").delete().eq("id", userId);
  const result = await service.auth.admin.deleteUser(userId);
  if (result.error && !result.error.message.toLowerCase().includes("not found")) throw new Error(`delete temporary user: ${result.error.message}`);
}

async function cleanup() {
  if (created.taskId) {
    const dataRows = await must(service.from("experiment_data").select("id").eq("task_id", created.taskId), "list imported data");
    const dataIds = dataRows.map((row) => row.id);
    if (dataIds.length) {
      await must(service.from("audit_log").delete().eq("object_type", "experiment_data").in("object_id", dataIds.map(String)), "delete imported data audit");
      await must(service.from("experiment_data").delete().in("id", dataIds), "delete imported data");
    }
    await must(service.from("audit_log").delete().eq("object_type", "experiment_data_import").eq("object_id", String(created.taskId)), "delete import audit");
    await must(service.from("task_sample").delete().eq("task_id", created.taskId), "delete task sample link");
    await must(service.from("experiment_task").delete().eq("id", created.taskId), "delete temporary task");
  }
  if (created.instrumentId) await must(service.from("instrument").delete().eq("id", created.instrumentId), "delete temporary instrument");
  if (created.sampleId) await must(service.from("sample").delete().eq("id", created.sampleId), "delete temporary sample");
  if (created.projectId) await must(service.from("research_project").delete().eq("id", created.projectId), "delete temporary project");
  if (created.methodId) await must(service.from("experiment_method").delete().eq("id", created.methodId), "delete temporary method");
  await deleteUser(created.userId);
}

async function main() {
  const role = await must(service.from("sys_role").select("id").eq("code", "SYSTEM_ADMIN").single(), "read system admin role");
  const email = `${tag}@example.invalid`;
  const password = `DataImport!${Date.now()}`;
  const authUser = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: tag, real_name: "Data import test" } });
  if (authUser.error || !authUser.data.user) throw new Error(`create temporary user failed: ${authUser.error?.message ?? "missing user"}`);
  created.userId = authUser.data.user.id;
  await must(service.from("sys_user_role").insert({ user_id: created.userId, role_id: role.id }), "assign system admin role");

  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Data import method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  created.methodId = method.id;
  const project = await must(service.from("research_project").insert({ project_code: `${tag}_P`, name: "Data import project", owner_id: created.userId, status: "ACTIVE" }).select("id").single(), "create project");
  created.projectId = project.id;
  const task = await must(service.from("experiment_task").insert({ task_code: `${tag}_T`, project_id: project.id, method_id: method.id, name: "Data import task", priority: "NORMAL", status: "DRAFT" }).select("id").single(), "create task");
  created.taskId = task.id;
  const sample = await must(service.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Data import sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  created.sampleId = sample.id;
  await must(service.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), "link sample");
  const instrument = await must(service.from("instrument").insert({ instrument_code: `${tag}_I`, name: "Data import instrument", type: "TEST", status: "ACTIVE" }).select("id").single(), "create instrument");
  created.instrumentId = instrument.id;

  const login = await appRequest("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert(login.response.status === 200 && login.cookies, `temporary user login failed: status=${login.response.status} error=${JSON.stringify(login.body?.error ?? null)}`);

  const csv = [
    "sampleId,dataType,metricName,rawValue,processedValue,collectedAt,instrumentId,unit,remark",
    `${created.sampleId},RAW,concentration,12.34,,2026-07-15T08:00:00Z,${created.instrumentId},mg/L,csv import`,
  ].join("\n");
  const csvForm = new FormData();
  csvForm.append("file", new Blob([csv], { type: "text/csv" }), "observations.csv");
  const csvResult = await appRequest(`/api/v1/tasks/${created.taskId}/data/import`, { method: "POST", headers: { cookie: login.cookies }, body: csvForm });
  assert(csvResult.response.status === 201 && csvResult.body?.importedCount === 1 && csvResult.body?.data?.[0]?.sourceType === "FILE", `CSV import failed: status=${csvResult.response.status} error=${JSON.stringify(csvResult.body?.error ?? null)}`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("data");
  worksheet.addRow(["sampleId", "dataType", "metricName", "rawValue", "processedValue", "collectedAt", "instrumentId", "unit", "remark"]);
  worksheet.addRow([created.sampleId, "PROCESSED", "concentration", null, 12.35, "2026-07-15T08:01:00Z", created.instrumentId, "mg/L", "xlsx import"]);
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const xlsxForm = new FormData();
  xlsxForm.append("file", new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "observations.xlsx");
  const xlsxResult = await appRequest(`/api/v1/tasks/${created.taskId}/data/import`, { method: "POST", headers: { cookie: login.cookies }, body: xlsxForm });
  assert(xlsxResult.response.status === 201 && xlsxResult.body?.importedCount === 1 && xlsxResult.body?.data?.[0]?.sourceType === "FILE", `XLSX import failed: status=${xlsxResult.response.status} error=${JSON.stringify(xlsxResult.body?.error ?? null)}`);

  const beforeInvalid = await must(service.from("experiment_data").select("id").eq("task_id", created.taskId), "count imported data");
  const invalidForm = new FormData();
  invalidForm.append("file", new Blob([`${csv}\n999999,RAW,invalid,1,,2026-07-15T08:02:00Z,,,invalid`], { type: "text/csv" }), "invalid.csv");
  const invalidResult = await appRequest(`/api/v1/tasks/${created.taskId}/data/import`, { method: "POST", headers: { cookie: login.cookies }, body: invalidForm });
  assert(invalidResult.response.status === 400 && invalidResult.body?.error?.code === "IMPORT_ROW_INVALID", "invalid row was not rejected");
  const afterInvalid = await must(service.from("experiment_data").select("id").eq("task_id", created.taskId), "verify invalid import did not write");
  assert(afterInvalid.length === beforeInvalid.length, "invalid import partially wrote data");

  const audits = await must(service.from("audit_log").select("action, after_json").eq("object_type", "experiment_data_import").eq("object_id", String(created.taskId)), "read import audit");
  assert(audits.length === 2 && audits.every((audit) => audit.action === "IMPORT" && !JSON.stringify(audit.after_json).includes("12.34")), "import audit summary is incomplete or contains row data");
  console.log(JSON.stringify({ ok: true, checks: ["CSV import", "XLSX import", "FILE source type", "invalid row atomic rejection", "import audit summary"], cleanedByFinally: true }));
}

try {
  await main();
} catch (error) {
  console.error(`Data import integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(`Data import cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
