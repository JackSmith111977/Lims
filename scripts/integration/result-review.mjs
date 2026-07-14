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
const tag = `review_${Date.now()}`;
const testEmailPattern = /^review_\d+_(reviewer|reader)@example\.invalid$/;
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
  if (!process.env.SUPABASE_ACCESS_TOKEN) return { ...process.env };
  return { ...process.env, USERPROFILE: process.env.TEMP, HOME: process.env.TEMP, XDG_CONFIG_HOME: process.env.TEMP };
}

async function runSqlCleanup() {
  await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase db query --linked --file scripts/integration/cleanup-result-review.sql --yes"], { cwd: process.cwd(), env: cliEnvironment(), windowsHide: true });
}

async function verifyCleanup() {
  const [usersResult, tasks, samples, projects, instruments, methods] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    must(service.from("experiment_task").select("id").like("task_code", "review_%"), "verify stale tasks"),
    must(service.from("sample").select("id").like("sample_code", "review_%"), "verify stale samples"),
    must(service.from("research_project").select("id").like("project_code", "review_%"), "verify stale projects"),
    must(service.from("instrument").select("id").like("instrument_code", "review_%"), "verify stale instruments"),
    must(service.from("experiment_method").select("id").like("method_code", "review_%"), "verify stale methods"),
  ]);
  if (usersResult.error) throw new Error(`verify stale users failed: ${usersResult.error.message}`);
  const users = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  const counts = { users: users.length, tasks: tasks.length, samples: samples.length, projects: projects.length, instruments: instruments.length, methods: methods.length };
  assert(Object.values(counts).every((count) => count === 0), `temporary review resources remain: ${JSON.stringify(counts)}`);
  return counts;
}

async function createRole() {
  const roleCode = `REVIEW_READER_${Date.now()}`;
  const role = await must(service.from("sys_role").insert({ code: roleCode, name: "Review integration reader", status: "ACTIVE" }).select("id").single(), "create review reader role");
  const permission = await must(service.from("sys_permission").select("id").eq("code", "review.read").single(), "read review permission");
  await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), "assign review reader permission");
  return roleCode;
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `ReviewFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Review test ${username}` } });
  if (error || !data.user) throw new Error(`create ${username} failed: ${error?.message ?? "missing user"}`);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: data.user.id, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: data.user.id, client };
}

async function transition(client, taskId, toStatus) {
  return must(client.rpc("transition_task", { _task_id: taskId, _to_status: toStatus, _remark: "review integration" }), `transition task to ${toStatus}`);
}

async function makePendingTask(reviewer, project, method, sample, instrument, index) {
  const task = await must(service.from("experiment_task").insert({ task_code: `${tag}_T${index}`, project_id: project.id, method_id: method.id, name: `Review integration task ${index}`, priority: "NORMAL", status: "DRAFT" }).select("id").single(), `create task ${index}`);
  await must(service.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), `link sample ${index}`);
  await must(reviewer.client.rpc("replace_task_assignments", { _task_id: task.id, _user_ids: [reviewer.id], _group_ids: null }), `assign task ${index}`);
  await transition(reviewer.client, task.id, "IN_PROGRESS");
  await transition(reviewer.client, task.id, "PENDING_REVIEW");
  const data = await must(service.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, instrument_id: instrument.id, data_type: "RAW", metric_name: `review_metric_${index}`, raw_value: 12.34 + index, processed_value: null, unit: "mg/L", source_type: "MANUAL", collected_at: new Date().toISOString(), recorded_by: reviewer.id }).select("id").single(), `create review data ${index}`);
  return { id: task.id, dataId: data.id };
}

async function review(client, taskId, result, comment) {
  return must(client.rpc("review_task_result", { _task_id: taskId, _result: result, _comment: comment }), `review task ${taskId} as ${result}`);
}

async function main() {
  await runSqlCleanup();
  const readerRole = await createRole();
  const reviewer = await createUser("reviewer", "PROJECT_OWNER");
  const reader = await createUser("reader", readerRole);
  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Review integration method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  const project = await must(service.from("research_project").insert({ project_code: `${tag}_P`, name: "Review integration project", owner_id: reviewer.id, status: "ACTIVE" }).select("id").single(), "create project");
  const sample = await must(service.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Review integration sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  const instrument = await must(service.from("instrument").insert({ instrument_code: `${tag}_I`, name: "Review integration instrument", type: "TEST", status: "ACTIVE" }).select("id").single(), "create instrument");
  const approvedTask = await makePendingTask(reviewer, project, method, sample, instrument, 1);
  const returnedTask = await makePendingTask(reviewer, project, method, sample, instrument, 2);

  const approved = await review(reviewer.client, approvedTask.id, "APPROVED", "数据、处理说明和血缘已核对");
  assert(approved.review.result === "APPROVED" && approved.task.toStatus === "APPROVED" && approved.review.reviewerId === reviewer.id, "approval result is incorrect");
  const returned = await review(reviewer.client, returnedTask.id, "RETURNED", "请补充异常数据说明");
  assert(returned.review.result === "RETURNED" && returned.task.toStatus === "RETURNED", "returned result is incorrect");
  await transition(reviewer.client, returnedTask.id, "IN_PROGRESS");
  await transition(reviewer.client, returnedTask.id, "PENDING_REVIEW");
  const needMore = await review(reviewer.client, returnedTask.id, "NEED_MORE", "请补充复测记录");
  assert(needMore.review.result === "NEED_MORE" && needMore.task.toStatus === "RETURNED", "need-more result is incorrect");

  await expectError(reviewer.client.rpc("review_task_result", { _task_id: approvedTask.id, _result: "RETURNED", _comment: "late review" }), "review already approved task");
  await expectError(reviewer.client.rpc("review_task_result", { _task_id: returnedTask.id, _result: "RETURNED", _comment: null }), "missing returned comment");
  await expectError(reviewer.client.from("result_review").insert({ task_id: returnedTask.id, reviewer_id: reviewer.id, result: "APPROVED", comment: "forged" }), "direct review insert");
  await expectError(reviewer.client.from("result_review").update({ comment: "tampered" }).eq("task_id", approvedTask.id).select("id").single(), "review update");
  await expectError(reviewer.client.from("result_review").delete().eq("task_id", approvedTask.id).select("id").single(), "review delete");
  await expectError(reader.client.rpc("review_task_result", { _task_id: returnedTask.id, _result: "APPROVED", _comment: "forbidden" }), "review reader execution");
  const visibleReviews = await must(reader.client.from("result_review").select("id, task_id, result").in("task_id", [approvedTask.id, returnedTask.id]).order("id"), "review reader visibility");
  assert(visibleReviews.length === 3 && visibleReviews.some((item) => item.result === "NEED_MORE"), "review reader cannot read review history");

  const contextReviews = await must(reviewer.client.from("result_review").select("id, task_id, reviewer_id, result, comment").eq("task_id", returnedTask.id).order("reviewed_at", { ascending: false }).order("id", { ascending: false }), "latest review ordering");
  assert(contextReviews.length === 2 && contextReviews[0].result === "NEED_MORE", "latest review is not the effective review");
  const histories = await must(service.from("task_status_history").select("task_id, from_status, to_status, operator_id").in("task_id", [approvedTask.id, returnedTask.id]).order("id"), "review task history");
  assert(histories.filter((row) => row.to_status === "APPROVED").length === 1 && histories.filter((row) => row.to_status === "RETURNED").length === 2 && histories.every((row) => row.operator_id === reviewer.id), "review task history parity is incomplete");
  const audit = await must(service.from("audit_log").select("object_id, action, operator_id").eq("object_type", "result_review").in("object_id", [String(approved.review.id), String(returned.review.id), String(needMore.review.id)]).order("id"), "review audit");
  assert(audit.length === 3 && audit.every((row) => row.action === "REVIEW" && row.operator_id === reviewer.id), "review audit parity is incomplete");

  console.log(JSON.stringify({ ok: true, checks: ["approval status transition", "returned status transition", "need-more status transition", "append-only review history", "required non-approval comment", "reader RLS and execution denial", "direct write denial", "latest review ordering", "task history and audit parity"] }));
}

try {
  await main();
} catch (error) {
  console.error(`Result review integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
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
