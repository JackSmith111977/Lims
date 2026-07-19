import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const values = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
  }));
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY || !values.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase URL, anon key or service role key in .env.local");
  return values;
}

const env = loadEnv();
const tag = `report_${Date.now()}`;
const testEmailPattern = /^report_\d+_(manager|publisher|reader)@example\.invalid$/;
const execFileAsync = promisify(execFile);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdReportIds = [];
const reportBaseUrl = process.env.REPORT_BASE_URL;

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
  if (!process.env.SUPABASE_ACCESS_TOKEN) return { ...process.env };
  return { ...process.env, USERPROFILE: process.env.TEMP, HOME: process.env.TEMP, XDG_CONFIG_HOME: process.env.TEMP };
}

async function runSqlCleanup() {
  await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase db query --linked --file scripts/integration/cleanup-reporting.sql --yes"], { cwd: process.cwd(), env: cliEnvironment(), windowsHide: true });
}

async function verifyCleanup() {
  const reportQuery = createdReportIds.length === 0
    ? Promise.resolve({ data: [] })
    : service.from("experiment_report").select("id").in("id", createdReportIds);
  const historyQuery = createdReportIds.length === 0
    ? Promise.resolve({ data: [] })
    : service.from("experiment_report_history").select("id").in("report_id", createdReportIds);
  const signatureQuery = createdReportIds.length === 0
    ? Promise.resolve({ data: [] })
    : service.from("experiment_report_signature").select("id").in("report_id", createdReportIds);
  const [usersResult, reports, history, signatures, tasks, samples, projects, instruments, methods] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    must(reportQuery, "verify reports"),
    must(historyQuery, "verify report history"),
    must(signatureQuery, "verify report signatures"),
    must(service.from("experiment_task").select("id").like("task_code", "report_%"), "verify stale tasks"),
    must(service.from("sample").select("id").like("sample_code", "report_%"), "verify stale samples"),
    must(service.from("research_project").select("id").like("project_code", "report_%"), "verify stale projects"),
    must(service.from("instrument").select("id").like("instrument_code", "report_%"), "verify stale instruments"),
    must(service.from("experiment_method").select("id").like("method_code", "report_%"), "verify stale methods"),
  ]);
  if (usersResult.error) throw new Error(`verify stale users failed: ${usersResult.error.message}`);
  const users = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  const counts = { users: users.length, reports: reports.length, history: history.length, signatures: signatures.length, tasks: tasks.length, samples: samples.length, projects: projects.length, instruments: instruments.length, methods: methods.length };
  assert(Object.values(counts).every((count) => count === 0), `temporary report resources remain: ${JSON.stringify(counts)}`);
  return counts;
}

async function createRole() {
  const roleCode = `REPORT_READER_${Date.now()}`;
  const role = await must(service.from("sys_role").insert({ code: roleCode, name: "Report integration reader", status: "ACTIVE" }).select("id").single(), "create report reader role");
  const permission = await must(service.from("sys_permission").select("id").eq("code", "report.read").single(), "read report permission");
  await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), "assign report reader permission");
  return roleCode;
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `ReportFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Report test ${username}` } });
  if (error || !data.user) throw new Error(`create ${username} failed: ${error?.message ?? "missing user"}`);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: data.user.id, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: data.user.id, client, email, password };
}

function cookiesFrom(response) {
  return (response.headers.getSetCookie?.() ?? []).map((value) => value.split(";", 1)[0]).join("; ");
}

async function verifyTraceRoute(reportId, user, taskId, sampleId, dataId) {
  if (!reportBaseUrl) return;
  const login = await fetch(`${reportBaseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  assert(login.status === 200, "trace integration user login failed");
  const cookie = cookiesFrom(login);
  assert(cookie.length > 0, "trace integration login did not establish a session");
  const response = await fetch(`${reportBaseUrl}/api/v1/trace/report/${reportId}`, { headers: { cookie } });
  const body = await response.json().catch(() => null);
  assert(response.status === 200, `trace API returned ${response.status}`);
  assert(body?.data?.task?.id === taskId, "trace API task node is incomplete");
  assert(body?.data?.samples?.some((item) => item.id === sampleId), "trace API sample node is incomplete");
  assert(body?.data?.data?.some((item) => item.id === dataId), "trace API data node is incomplete");
  assert(body?.data?.reviews?.some((item) => item.result === "APPROVED"), "trace API review node is incomplete");
}

async function transitionTask(client, taskId, toStatus) {
  return must(client.rpc("transition_task", { _task_id: taskId, _to_status: toStatus, _remark: "report integration" }), `transition task to ${toStatus}`);
}

async function makeApprovedTask(manager, project, method, sample, instrument, index, approve = true) {
  const task = await must(service.from("experiment_task").insert({ task_code: `${tag}_T${index}`, project_id: project.id, method_id: method.id, name: `Report integration task ${index}`, priority: "NORMAL", status: "DRAFT" }).select("id").single(), `create task ${index}`);
  await must(service.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), `link sample ${index}`);
  await must(manager.client.rpc("replace_task_assignments", { _task_id: task.id, _user_ids: [manager.id], _group_ids: null }), `assign task ${index}`);
  await transitionTask(manager.client, task.id, "IN_PROGRESS");
  await transitionTask(manager.client, task.id, "PENDING_REVIEW");
  const data = await must(service.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, instrument_id: instrument.id, data_type: "RAW", metric_name: `report_metric_${index}`, raw_value: 12.34 + index, processed_value: null, unit: "mg/L", source_type: "MANUAL", collected_at: new Date().toISOString(), recorded_by: manager.id }).select("id").single(), `create report data ${index}`);
  if (approve) await must(manager.client.rpc("review_task_result", { _task_id: task.id, _result: "APPROVED", _comment: "报告集成测试审核通过" }), `approve task ${index}`);
  return { id: task.id, dataId: data.id };
}

async function main() {
  await runSqlCleanup();
  const readerRole = await createRole();
  const manager = await createUser("manager", "LAB_ADMIN");
  const publisher = await createUser("publisher", "PROJECT_OWNER");
  const reader = await createUser("reader", readerRole);
  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Report integration method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  const project = await must(service.from("research_project").insert({ project_code: `${tag}_P`, name: "Report integration project", owner_id: publisher.id, status: "ACTIVE" }).select("id").single(), "create project");
  const sample = await must(service.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Report integration sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  const instrument = await must(service.from("instrument").insert({ instrument_code: `${tag}_I`, name: "Report integration instrument", type: "TEST", status: "ACTIVE" }).select("id").single(), "create instrument");
  const approvedTask = await makeApprovedTask(manager, project, method, sample, instrument, 1);
  const pendingTask = await makeApprovedTask(manager, project, method, sample, instrument, 2, false);
  await expectError(manager.client.rpc("generate_report", { _task_id: pendingTask.id }), "generate report for unapproved task");

  const first = await must(manager.client.rpc("generate_report", { _task_id: approvedTask.id }), "generate first report");
  createdReportIds.push(first.id);
  assert(first.status === "DRAFT" && first.version_no === 1 && first.report_payload.task.id === approvedTask.id, "first report snapshot is incorrect");
  assert(first.report_payload.samples?.[0]?.id === sample.id && first.report_payload.data?.[0]?.id === approvedTask.dataId, "report sample/data snapshot is incomplete");
  assert(first.report_payload.reviews?.[0]?.result === "APPROVED", "report review snapshot is incomplete");
  assert(first.report_payload.template?.fields?.includes("data"), "report template snapshot is incomplete");
  await verifyTraceRoute(first.id, manager, approvedTask.id, sample.id, approvedTask.dataId);
  await expectError(publisher.client.rpc("generate_report", { _task_id: approvedTask.id }), "publisher report generation");
  await expectError(reader.client.rpc("generate_report", { _task_id: approvedTask.id }), "reader report generation");
  const submitted = await must(manager.client.rpc("submit_report_for_review", { _report_id: first.id, _remark: "报告草稿已准备" }), "submit first report");
  assert(submitted.status === "REVIEW", "first report did not enter review");
  const published = await must(publisher.client.rpc("publish_report", { _report_id: first.id, _remark: "报告内容已确认" }), "publish first report");
  assert(published.status === "PUBLISHED" && published.published_at, "first report was not published");
  const signature = await must(publisher.client.rpc("sign_report", { _report_id: first.id, _remark: "report electronic signature" }), "sign first report");
  assert(signature.reportId === first.id && signature.signatureType === "ELECTRONIC_SHA256" && /^[a-f0-9]{64}$/.test(signature.signatureHash) && signature.signedBy === publisher.id && signature.signedAt, "first report signature receipt is invalid");
  await expectError(publisher.client.rpc("sign_report", { _report_id: first.id, _remark: "duplicate" }), "duplicate report signature");
  await expectError(reader.client.from("experiment_report_signature").insert({ report_id: first.id, signature_type: "ELECTRONIC_SHA256", signature_hash: "0".repeat(64), signed_by: reader.id }).select("id").single(), "direct signature insert");
  await expectError(reader.client.from("experiment_report_signature").update({ remark: "forged" }).eq("id", signature.id).select("id").single(), "direct signature update");
  await expectError(reader.client.from("experiment_report_signature").delete().eq("id", signature.id).select("id").single(), "direct signature delete");
  const signatureAudit = await must(service.from("audit_log").select("object_id, action, operator_id").eq("object_type", "experiment_report_signature").eq("object_id", String(signature.id)).order("id"), "signature audit");
  assert(signatureAudit.length === 1 && signatureAudit[0].action === "SIGN" && signatureAudit[0].operator_id === publisher.id, "signature audit is incomplete");
  const second = await must(manager.client.rpc("generate_report", { _task_id: approvedTask.id }), "generate second report");
  createdReportIds.push(second.id);
  assert(second.status === "DRAFT" && second.version_no === 2, "report version did not increment");
  await must(manager.client.rpc("submit_report_for_review", { _report_id: second.id, _remark: "新版本待发布" }), "submit second report");
  const publishedSecond = await must(publisher.client.rpc("publish_report", { _report_id: second.id, _remark: "发布新版本" }), "publish second report");
  assert(publishedSecond.status === "PUBLISHED", "second report was not published");
  const old = await must(service.from("experiment_report").select("status, version_no").eq("id", first.id).single(), "read archived first report");
  assert(old.status === "ARCHIVED" && old.version_no === 1, "previous published report was not archived");
  await must(publisher.client.rpc("archive_report", { _report_id: second.id, _remark: "归档测试" }), "archive second report");
  await expectError(publisher.client.rpc("publish_report", { _report_id: second.id, _remark: "invalid" }), "publish archived report");
  await expectError(reader.client.from("experiment_report").insert({ report_code: "FORGED", task_id: approvedTask.id, version_no: 99, status: "DRAFT", report_payload: {}, generated_by: reader.id }), "direct report insert");
  await expectError(reader.client.from("experiment_report").update({ status: "PUBLISHED" }).eq("id", first.id).select("id").single(), "direct report update");
  await expectError(reader.client.from("experiment_report_history").delete().eq("report_id", first.id).select("id").single(), "direct report history delete");
  const visible = await must(reader.client.from("experiment_report").select("id, report_code, version_no, status").eq("task_id", approvedTask.id).order("version_no"), "reader report visibility");
  assert(visible.length === 2 && visible[0].version_no === 1 && visible[1].version_no === 2, "reader cannot read report versions");
  const history = await must(service.from("experiment_report_history").select("report_id, from_status, to_status, operator_id").in("report_id", [first.id, second.id]).order("id"), "report history");
  assert(history.length === 8 && history.every((row) => row.operator_id === manager.id || row.operator_id === publisher.id), "report history is incomplete");
  const audit = await must(service.from("audit_log").select("object_id, action, operator_id").eq("object_type", "experiment_report").in("object_id", [String(first.id), String(second.id)]).order("id"), "report audit");
  assert(audit.length === 8 && audit.every((row) => row.operator_id === manager.id || row.operator_id === publisher.id), "report audit parity is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["approved-task generation", "snapshot persistence", "template snapshot persistence", "version increment", "submit/publish/archive flow", "electronic signature receipt", "duplicate signature denial", "signature immutability", "signature audit", "automatic previous-version archive", "publisher and reader execution denial", "direct write denial", "reader visibility", "history and audit parity"] }));
}

try {
  await main();
} catch (error) {
  console.error(`Report integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
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
