import fs from "node:fs";
import path from "node:path";
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
const tag = `processing_${Date.now()}`;
const testEmailPattern = /^processing_\d+_(admin|reader)@example\.invalid$/;
const execFileAsync = promisify(execFile);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

function cliEnvironment() {
  // With an explicit token, use an isolated profile so the CLI does not touch
  // the user's telemetry file. Without one, use the user's normal CLI login.
  if (!process.env.SUPABASE_ACCESS_TOKEN) return { ...process.env };
  return { ...process.env, USERPROFILE: process.env.TEMP, HOME: process.env.TEMP, XDG_CONFIG_HOME: process.env.TEMP };
}

async function runSqlCleanup() {
  const cliPath = path.join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
  const cliArgs = [cliPath, "db", "query"];
  if (databaseUrl) {
    cliArgs.push("--db-url", databaseUrl);
  } else {
    cliArgs.push("--linked");
  }
  cliArgs.push("--file", "scripts/integration/cleanup-experiment-processing.sql", "--yes");
  console.log(`[cleanup] mode=${databaseUrl ? "db-url" : "linked"}`);
  await execFileAsync(process.execPath, cliArgs, {
    cwd: process.cwd(),
    env: cliEnvironment(),
    windowsHide: true,
  });
}

async function verifyCleanup() {
  const [usersResult, tasks, samples, projects, instruments, methods] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    must(service.from("experiment_task").select("id").like("task_code", "processing_%"), "verify stale tasks"),
    must(service.from("sample").select("id").like("sample_code", "processing_%"), "verify stale samples"),
    must(service.from("research_project").select("id").like("project_code", "processing_%"), "verify stale projects"),
    must(service.from("instrument").select("id").like("instrument_code", "processing_%"), "verify stale instruments"),
    must(service.from("experiment_method").select("id").like("method_code", "processing_%"), "verify stale methods"),
  ]);
  if (usersResult.error) throw new Error(`verify stale users failed: ${usersResult.error.message}`);
  const staleUsers = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  let processingRuns = [];
  let dataRows = [];
  if (tasks.length) {
    processingRuns = await must(service.from("experiment_processing_run").select("id").in("task_id", tasks.map((task) => task.id)), "verify stale processing runs");
    dataRows = await must(service.from("experiment_data").select("id").in("task_id", tasks.map((task) => task.id)), "verify stale processing data");
  }
  const counts = {
    users: staleUsers.length,
    tasks: tasks.length,
    samples: samples.length,
    projects: projects.length,
    instruments: instruments.length,
    methods: methods.length,
    processingRuns: processingRuns.length,
    dataRows: dataRows.length,
  };
  assert(Object.values(counts).every((count) => count === 0), `temporary processing resources remain: ${JSON.stringify(counts)}`);
  return counts;
}

async function removeTestUser(userId) {
  await service.from("audit_log").delete().eq("operator_id", userId);
  await service.from("sys_user_role").delete().eq("user_id", userId);
  await service.from("sys_user").delete().eq("id", userId);
  const result = await service.auth.admin.deleteUser(userId);
  if (result.error) console.warn(`Auth API cleanup deferred (status ${result.error.status ?? "unknown"}); SQL cleanup will finish it.`);
}

async function cleanupStaleTestUsers() {
  const result = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (result.error) throw new Error(`list temporary users failed: ${result.error.message}`);
  for (const user of result.data.users) {
    if (user.email && testEmailPattern.test(user.email)) await removeTestUser(user.id);
  }
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `ProcessingFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `${username}_${tag}`, real_name: `Processing test ${username}` },
  });
  if (error || !data.user) throw new Error(`create ${username} failed: ${error?.message ?? "missing user"}`);
  const userId = data.user.id;
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: userId, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: userId, client, email, password };
}

async function dashboardRequest(admin, path) {
  const baseUrl = process.env.DASHBOARD_BASE_URL;
  if (!baseUrl) throw new Error("DASHBOARD_BASE_URL is required for dashboard integration");
  const loginResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: admin.password }),
  });
  assert(loginResponse.ok, `dashboard API login failed with status ${loginResponse.status}`);
  const setCookies = typeof loginResponse.headers.getSetCookie === "function"
    ? loginResponse.headers.getSetCookie()
    : [loginResponse.headers.get("set-cookie") ?? ""];
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { headers: { cookie } });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function verifyDashboard(admin, project, task, sample) {
  if (!process.env.DASHBOARD_BASE_URL) return;
  const query = new URLSearchParams({
    projectId: String(project.id),
    personnelId: admin.id,
    taskStatus: "PENDING_REVIEW",
    inventoryDays: "0",
  });
  const overview = await dashboardRequest(admin, `/api/v1/dashboard/overview?${query}`);
  assert(overview.response.ok, `dashboard overview failed with status ${overview.response.status}`);
  assert(overview.payload.data.samples.total >= 1, "dashboard sample statistics are missing the fixture");
  assert(overview.payload.data.tasks.total === 1, "dashboard task filter did not isolate the fixture");
  assert(overview.payload.data.pendingReviews.length === 1 && overview.payload.data.pendingReviews[0].id === task.id, "dashboard pending review list is incorrect");
  assert(overview.payload.data.abnormalData.total >= 1, "dashboard abnormal processing statistics are missing the flagged run");
  assert(overview.payload.data.filters.personnelId === admin.id && overview.payload.data.filters.projectId === project.id, "dashboard filters were not echoed");

  const taskStatistics = await dashboardRequest(admin, `/api/v1/dashboard/task-statistics?${query}`);
  assert(taskStatistics.response.ok && taskStatistics.payload.data.tasks.total === 1, "dashboard task statistics endpoint is inconsistent");
  const inventory = await dashboardRequest(admin, "/api/v1/dashboard/inventory-alerts?inventoryDays=0");
  assert(inventory.response.ok && inventory.payload.data.inventory.totalAlerts >= 0, "dashboard inventory endpoint failed");
  const invalid = await dashboardRequest(admin, "/api/v1/dashboard/overview?inventoryDays=366");
  assert(invalid.response.status === 400 && invalid.payload.error?.code === "INVALID_QUERY", "dashboard invalid query was not rejected");
  assert(sample.id > 0, "dashboard fixture sample was not created");
  console.log(JSON.stringify({ dashboardIntegration: true, checks: ["filtered sample and task statistics", "pending review list", "flagged processing anomaly", "task statistics endpoint parity", "inventory dashboard endpoint", "invalid filter rejection"] }));
}

async function transition(client, taskId, toStatus) {
  return must(client.rpc("transition_task", { _task_id: taskId, _to_status: toStatus, _remark: "processing integration" }), `transition task to ${toStatus}`);
}

async function execute(client, args, label) {
  return must(client.rpc("execute_experiment_processing", args), label);
}

async function createRawData(admin, sample, instrument, task, metricName, rawValue) {
  const row = await must(admin.client.from("experiment_data").insert({
    task_id: task.id,
    sample_id: sample.id,
    instrument_id: instrument.id,
    data_type: "RAW",
    metric_name: metricName,
    raw_value: rawValue,
    processed_value: null,
    unit: "mg/L",
    source_type: "MANUAL",
    collected_at: new Date().toISOString(),
    recorded_by: admin.id,
  }).select("id, task_id, data_type, raw_value, processed_value").single(), `create ${metricName} raw data`);
  return row;
}

async function main() {
  await runSqlCleanup();
  await cleanupStaleTestUsers();

  const admin = await createUser("admin", "SYSTEM_ADMIN");
  const reader = await createUser("reader", "RESEARCHER");
  const method = await must(admin.client.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Processing integration method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  const project = await must(admin.client.from("research_project").insert({ project_code: `${tag}_P`, name: "Processing integration project", owner_id: admin.id, status: "ACTIVE" }).select("id").single(), "create project");
  const task = await must(admin.client.from("experiment_task").insert({ task_code: `${tag}_T`, project_id: project.id, method_id: method.id, name: "Processing integration task", priority: "NORMAL", status: "DRAFT" }).select("id").single(), "create task");
  const sample = await must(admin.client.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Processing integration sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  await must(admin.client.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), "link sample to task");
  const instrument = await must(admin.client.rpc("create_instrument", {
    _payload: {
      instrument_code: `${tag}_I`,
      name: "Processing integration instrument",
      type: "TEST",
      status: "ACTIVE",
      owner_id: admin.id,
    },
  }), "create instrument");

  const raw = await createRawData(admin, sample, instrument, task, "rounding", 12.345678);
  const thresholdRaw = await createRawData(admin, sample, instrument, task, "threshold", 150);
  const rules = await must(admin.client.from("experiment_processing_rule").select("id, rule_code, rule_type, config, status").in("rule_code", ["ROUND-DEFAULT", "THRESHOLD-DEFAULT"]), "list processing rules");
  const roundRule = rules.find((rule) => rule.rule_code === "ROUND-DEFAULT");
  const thresholdRule = rules.find((rule) => rule.rule_code === "THRESHOLD-DEFAULT");
  assert(roundRule?.status === "ACTIVE" && thresholdRule?.status === "ACTIVE", "seed processing rules are not active");

  const rounded = await execute(admin.client, {
    _task_id: task.id,
    _rule_id: roundRule.id,
    _execution_mode: "MANUAL",
    _source_data_ids: [raw.id],
    _output_type: "PROCESSED",
    _processed_value: 12.35,
    _decision: "PASS",
    _status: "SUCCEEDED",
    _explanation: "Rounded to scale 2 using HALF_UP",
  }, "execute round processing");
  assert(rounded.status === "SUCCEEDED" && rounded.outputDataId, "round processing did not succeed");
  await expectError(admin.client.rpc("execute_experiment_processing", {
    _task_id: task.id,
    _rule_id: roundRule.id,
    _execution_mode: "MANUAL",
    _source_data_ids: [raw.id],
    _output_type: "PROCESSED",
    _processed_value: 999,
    _decision: "PASS",
    _status: "SUCCEEDED",
    _explanation: "forged result",
  }), "rule result forgery");

  const flagged = await execute(admin.client, {
    _task_id: task.id,
    _rule_id: thresholdRule.id,
    _execution_mode: "SIMULATED",
    _source_data_ids: [thresholdRaw.id],
    _output_type: "RESULT",
    _processed_value: 150,
    _decision: "FAIL",
    _status: "FLAGGED",
    _explanation: "Value exceeds inclusive maximum 100",
  }, "execute threshold flag");
  assert(flagged.status === "FLAGGED" && flagged.outputDataId, "threshold flag was not persisted");

  const failed = await must(admin.client.rpc("record_experiment_processing_failure", {
    _task_id: task.id,
    _rule_id: roundRule.id,
    _execution_mode: "MANUAL",
    _source_data_ids: [raw.id],
    _error_code: "PROCESSING_INPUT_INVALID",
    _error_message: "Synthetic failure path for integration verification",
  }), "record processing failure");
  assert(failed.status === "FAILED" && !failed.outputDataId, "failure path created an output");

  const output = await must(admin.client.from("experiment_data").select("id, task_id, data_type, processed_value, source_type").eq("id", rounded.outputDataId).single(), "read rounded output");
  assert(output.task_id === task.id && output.data_type === "PROCESSED" && output.processed_value === 12.35 && output.source_type === "API", "rounded output traceability is incorrect");
  const lineage = await must(admin.client.from("experiment_data_lineage").select("run_id, source_data_id, output_data_id, relation_type").eq("output_data_id", rounded.outputDataId).single(), "read rounded lineage");
  assert(lineage.source_data_id === raw.id && lineage.relation_type === "DERIVED_FROM", "lineage does not point to the raw input");

  const runs = await must(reader.client.from("experiment_processing_run").select("id, task_id, status, output_data_id, decision").eq("task_id", task.id).order("id"), "reader run visibility");
  assert(runs.length === 3 && runs.map((run) => run.status).sort().join(",") === "FAILED,FLAGGED,SUCCEEDED", "reader cannot see all processing terminal states");
  const visibleLineage = await must(reader.client.from("experiment_data_lineage").select("id").eq("run_id", rounded.runId), "reader lineage visibility");
  assert(visibleLineage.length === 1, "reader cannot see processing lineage");

  await expectError(reader.client.rpc("execute_experiment_processing", {
    _task_id: task.id,
    _rule_id: roundRule.id,
    _execution_mode: "MANUAL",
    _source_data_ids: [raw.id],
    _output_type: "PROCESSED",
    _processed_value: 1,
    _decision: "PASS",
    _status: "SUCCEEDED",
    _explanation: "forbidden",
  }), "reader processing execution");
  await expectError(admin.client.from("experiment_processing_rule").update({ name: "tampered" }).eq("id", roundRule.id).select("id").single(), "processing rule update");
  await expectError(admin.client.from("experiment_processing_run").update({ explanation: "tampered" }).eq("id", rounded.runId).select("id").single(), "terminal run update");
  await expectError(admin.client.from("experiment_processing_run").delete().eq("id", rounded.runId).select("id").single(), "processing run delete");
  await expectError(admin.client.from("experiment_data_lineage").delete().eq("run_id", rounded.runId).select("id").single(), "lineage delete");
  await expectError(admin.client.from("experiment_data").update({ raw_value: 99 }).eq("id", raw.id).select("id").single(), "raw data overwrite");

  await must(admin.client.rpc("replace_task_assignments", { _task_id: task.id, _user_ids: [admin.id], _group_ids: null }), "assign task for lock test");
  await transition(admin.client, task.id, "IN_PROGRESS");
  await transition(admin.client, task.id, "PENDING_REVIEW");
  await verifyDashboard(admin, project, task, sample);
  await transition(admin.client, task.id, "APPROVED");
  await expectError(admin.client.rpc("execute_experiment_processing", {
    _task_id: task.id,
    _rule_id: roundRule.id,
    _execution_mode: "MANUAL",
    _source_data_ids: [raw.id],
    _output_type: "PROCESSED",
    _processed_value: 12.35,
    _decision: "PASS",
    _status: "SUCCEEDED",
    _explanation: "locked task",
  }), "approved task processing");

  const audit = await must(service.from("audit_log").select("object_id, action").eq("object_type", "experiment_processing_run").in("object_id", [String(rounded.runId), String(flagged.runId), String(failed.runId)]).order("id"), "read processing audit");
  assert(audit.length === 3 && audit.every((entry) => entry.action === "EXECUTE"), "processing audit parity is incomplete");
  const unchangedRaw = await must(service.from("experiment_data").select("raw_value, processed_value").eq("id", raw.id).single(), "read unchanged raw data");
  assert(unchangedRaw.raw_value === 12.345678 && unchangedRaw.processed_value === null, "raw input changed during processing");

  console.log(JSON.stringify({ ok: true, checks: ["round success and immutable output", "threshold flagged result", "failed run without output", "lineage traceability", "reader RLS visibility", "forbidden mutation and execution", "approved task lock", "audit parity", "raw input immutability"] }));
}

try {
  await main();
} catch (error) {
  console.error(`Experiment processing integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  try {
    await runSqlCleanup();
    const cleanup = await verifyCleanup();
    console.log(JSON.stringify({ cleanupVerified: true, remaining: cleanup }));
  } catch (error) {
    console.error(`SQL cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
