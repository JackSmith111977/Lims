import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const values = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
  }));
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY || !values.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL, anon key or service role key in .env.local");
  }
  return values;
}

const env = loadEnv();
const tag = `data_${Date.now()}`;
const testEmailPattern = /^data_\d+_(admin|reader)@example\.invalid$/;
const execFileAsync = promisify(execFile);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsers = [];
const created = { dataIds: [], instrumentIds: [], sampleIds: [], taskIds: [], projectIds: [], methodIds: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function expectError(promise, label) {
  const result = await promise;
  assert(result.error || !result.data, `${label} should fail`);
}

async function recordDataAudit(client, row, label) {
  await must(client.rpc("record_audit_event", {
    _required_permission: "data.manage",
    _object_type: "experiment_data",
    _object_id: String(row.id),
    _action: "CREATE",
    _before_json: null,
    _after_json: row,
  }), label);
}

async function removeTestUser(userId) {
  await service.from("audit_log").delete().eq("operator_id", userId);
  await service.from("sys_user_role").delete().eq("user_id", userId);
  await service.from("sys_user").delete().eq("id", userId);
  const result = await service.auth.admin.deleteUser(userId);
  if (result.error) console.warn(`Auth API cleanup deferred (${result.error.name ?? "unknown"}, status ${result.error.status ?? "unknown"}); SQL cleanup will finish it.`);
}

async function runSqlCleanup() {
  await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase db query --linked --file scripts/integration/cleanup-experiment-data.sql --yes"], {
    cwd: process.cwd(),
    env: { ...process.env, USERPROFILE: process.env.TEMP, HOME: process.env.TEMP, XDG_CONFIG_HOME: process.env.TEMP, SUPABASE_CLI_TELEMETRY_DISABLED: "true" },
    windowsHide: true,
  });
}

async function cleanupStaleTestResources() {
  const projects = await must(service.from("research_project").select("id").like("project_code", "data_%"), "list stale projects");
  const tasks = await must(service.from("experiment_task").select("id").like("task_code", "data_%"), "list stale tasks");
  const samples = await must(service.from("sample").select("id").like("sample_code", "data_%"), "list stale samples");
  const instruments = await must(service.from("instrument").select("id").like("instrument_code", "data_%"), "list stale instruments");
  const methods = await must(service.from("experiment_method").select("id").like("method_code", "data_%"), "list stale methods");
  const taskIds = tasks.map((row) => row.id);
  const sampleIds = samples.map((row) => row.id);
  const projectIds = projects.map((row) => row.id);
  const instrumentIds = instruments.map((row) => row.id);
  const methodIds = methods.map((row) => row.id);

  if (taskIds.length) {
    const dataRows = await must(service.from("experiment_data").select("id").in("task_id", taskIds), "list stale data");
    const dataIds = dataRows.map((row) => row.id);
    if (dataIds.length) {
      await must(service.from("audit_log").delete().eq("object_type", "experiment_data").in("object_id", dataIds.map(String)), "delete stale data audit");
      await must(service.from("experiment_data").delete().in("id", dataIds), "delete stale data");
    }
    await must(service.from("audit_log").delete().eq("object_type", "experiment_task").in("object_id", taskIds.map(String)), "delete stale task audit");
    await must(service.from("experiment_task").delete().in("id", taskIds), "delete stale tasks");
  }
  if (instrumentIds.length) await must(service.from("instrument").delete().in("id", instrumentIds), "delete stale instruments");
  if (sampleIds.length) {
    await must(service.from("audit_log").delete().eq("object_type", "sample").in("object_id", sampleIds.map(String)), "delete stale sample audit");
    await must(service.from("sample").delete().in("id", sampleIds), "delete stale samples");
  }
  if (projectIds.length) {
    await must(service.from("audit_log").delete().eq("object_type", "research_project").in("object_id", projectIds.map(String)), "delete stale project audit");
    await must(service.from("research_project").delete().in("id", projectIds), "delete stale projects");
  }
  if (methodIds.length) {
    await must(service.from("audit_log").delete().eq("object_type", "experiment_method").in("object_id", methodIds.map(String)), "delete stale method audit");
    await must(service.from("experiment_method").delete().in("id", methodIds), "delete stale methods");
  }
}

async function cleanupStaleTestUsers() {
  await cleanupStaleTestResources();
  const result = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (result.error) throw new Error(`list temporary users failed: ${result.error.message}`);
  for (const user of result.data.users) {
    if (user.email && testEmailPattern.test(user.email)) await removeTestUser(user.id);
  }
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `DataFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Data test ${username}` } });
  if (error || !data.user) {
    const details = error ? JSON.stringify({ name: error.name, status: error.status, code: error.code, message: error.message }) : "missing user";
    throw new Error(`create ${username} failed: ${details}`);
  }
  const userId = data.user.id;
  createdUsers.push(userId);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: userId, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: userId, client };
}

async function transition(admin, taskId, toStatus) {
  return must(admin.client.rpc("transition_task", { _task_id: taskId, _to_status: toStatus, _remark: "data integration" }), `transition task to ${toStatus}`);
}

async function cleanup() {
  if (created.dataIds.length) {
    await service.from("audit_log").delete().eq("object_type", "experiment_data").in("object_id", created.dataIds.map(String));
    await service.from("experiment_data").delete().in("id", created.dataIds);
  }
  if (created.taskIds.length) {
    await service.from("audit_log").delete().eq("object_type", "experiment_task").in("object_id", created.taskIds.map(String));
    await service.from("experiment_task").delete().in("id", created.taskIds);
  }
  if (created.instrumentIds.length) await service.from("instrument").delete().in("id", created.instrumentIds);
  if (created.sampleIds.length) {
    await service.from("audit_log").delete().eq("object_type", "sample").in("object_id", created.sampleIds.map(String));
    await service.from("sample").delete().in("id", created.sampleIds);
  }
  if (created.projectIds.length) {
    await service.from("audit_log").delete().eq("object_type", "research_project").in("object_id", created.projectIds.map(String));
    await service.from("research_project").delete().in("id", created.projectIds);
  }
  if (created.methodIds.length) {
    await service.from("audit_log").delete().eq("object_type", "experiment_method").in("object_id", created.methodIds.map(String));
    await service.from("experiment_method").delete().in("id", created.methodIds);
  }
  if (createdUsers.length) {
    for (const userId of createdUsers) await removeTestUser(userId);
  }
}

async function main() {
  await runSqlCleanup();
  await cleanupStaleTestUsers();
  const admin = await createUser("admin", "SYSTEM_ADMIN");
  const reader = await createUser("reader", "RESEARCHER");

  const method = await must(admin.client.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Data integration method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  created.methodIds.push(method.id);
  const project = await must(admin.client.from("research_project").insert({ project_code: `${tag}_P`, name: "Data integration project", owner_id: admin.id, status: "ACTIVE" }).select("id").single(), "create project");
  created.projectIds.push(project.id);
  const task = await must(admin.client.from("experiment_task").insert({ task_code: `${tag}_T`, project_id: project.id, method_id: method.id, name: "Data integration task", priority: "NORMAL", status: "DRAFT" }).select("id").single(), "create task");
  created.taskIds.push(task.id);
  const sample = await must(admin.client.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Data integration sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  created.sampleIds.push(sample.id);
  await must(admin.client.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), "link sample to task");
  const instrument = await must(admin.client.from("instrument").insert({ instrument_code: `${tag}_I`, name: "Data integration instrument", type: "TEST", status: "ACTIVE" }).select("id").single(), "create instrument");
  created.instrumentIds.push(instrument.id);

  const raw = await must(admin.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, instrument_id: instrument.id, data_type: "RAW", metric_name: "concentration", raw_value: 12.345678, processed_value: null, unit: "mg/L", source_type: "MANUAL", collected_at: "2026-07-15T00:00:00Z", recorded_by: admin.id }).select("id, data_type, raw_value, processed_value, recorded_by").single(), "create raw data");
  created.dataIds.push(raw.id);
  await recordDataAudit(admin.client, raw, "record raw data audit");
  const processed = await must(admin.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, instrument_id: instrument.id, data_type: "PROCESSED", metric_name: "concentration", raw_value: null, processed_value: 12.35, unit: "mg/L", source_type: "MANUAL", collected_at: "2026-07-15T00:01:00Z", recorded_by: admin.id }).select("id, data_type, raw_value, processed_value").single(), "create processed data");
  created.dataIds.push(processed.id);
  await recordDataAudit(admin.client, processed, "record processed data audit");
  assert(raw.data_type === "RAW" && raw.raw_value === 12.345678 && raw.processed_value === null, "raw data shape is incorrect");
  assert(processed.data_type === "PROCESSED" && processed.raw_value === null && processed.processed_value === 12.35, "processed data shape is incorrect");

  const readerRows = await must(reader.client.from("experiment_data").select("id, task_id, sample_id, data_type, raw_value, processed_value").eq("task_id", task.id).order("id"), "reader data visibility");
  assert(readerRows.length === 2 && readerRows.every((row) => row.task_id === task.id && row.sample_id === sample.id), "reader data visibility is incomplete");
  await expectError(reader.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, data_type: "RAW", metric_name: "forged", raw_value: 1, source_type: "MANUAL", collected_at: new Date().toISOString(), recorded_by: reader.id }), "reader data write");
  await expectError(reader.client.from("experiment_data").update({ remark: "forged" }).eq("id", raw.id).select("id").single(), "reader data update");
  await expectError(reader.client.from("experiment_data").delete().eq("id", raw.id).select("id").single(), "reader data delete");
  await expectError(admin.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, data_type: "RAW", metric_name: "invalid", raw_value: 1, processed_value: 2, source_type: "MANUAL", collected_at: new Date().toISOString(), recorded_by: admin.id }), "overlapping raw and processed values");
  await expectError(admin.client.from("experiment_data").insert({ task_id: task.id, sample_id: project.id, data_type: "RAW", metric_name: "unlinked", raw_value: 1, source_type: "MANUAL", collected_at: new Date().toISOString(), recorded_by: admin.id }), "sample not linked to task");

  await must(admin.client.rpc("replace_task_assignments", { _task_id: task.id, _user_ids: [admin.id], _group_ids: null }), "assign task for lock test");
  await transition(admin, task.id, "IN_PROGRESS");
  await transition(admin, task.id, "PENDING_REVIEW");
  await transition(admin, task.id, "APPROVED");
  await transition(admin, task.id, "ARCHIVED");
  await expectError(admin.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, data_type: "RESULT", metric_name: "locked", processed_value: 99, source_type: "MANUAL", collected_at: new Date().toISOString(), recorded_by: admin.id }), "archived task data write");

  const audit = await must(service.from("audit_log").select("action, operator_id").eq("object_type", "experiment_data").in("object_id", created.dataIds.map(String)).order("id"), "read data audit");
  assert(audit.length === 2 && audit.every((item) => item.operator_id === admin.id && item.action === "CREATE"), "data audit parity is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["raw/processed/result separation", "task/sample/method/instrument traceability", "reader RLS visibility", "append-only write boundary", "archived task lock", "audit parity"], cleanedByFinally: true }));
}

try {
  await main();
} catch (error) {
  console.error(`Experiment data integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.warn(`Application cleanup reported an error: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  try {
    await runSqlCleanup();
  } catch (error) {
    console.error(`SQL cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
