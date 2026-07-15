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
const tag = `instrument_${Date.now()}`;
const testEmailPattern = /^instrument_\d+_(manager|reader)@example\.invalid$/;
const execFileAsync = promisify(execFile);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function assert(condition, message) { if (!condition) throw new Error(message); }
async function must(promise, label) { const result = await promise; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
async function expectError(promise, label) { const result = await promise; assert(result.error || !result.data, `${label} should fail`); }
function cliEnvironment() { return process.env.SUPABASE_ACCESS_TOKEN ? { ...process.env, USERPROFILE: process.env.TEMP, HOME: process.env.TEMP, XDG_CONFIG_HOME: process.env.TEMP } : { ...process.env }; }
async function runSqlCleanup() { await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase db query --linked --file scripts/integration/cleanup-instrument-registry.sql --yes"], { cwd: process.cwd(), env: cliEnvironment(), windowsHide: true }); }

async function verifyCleanup() {
  const [usersResult, instruments, tasks, samples, projects, methods] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    must(service.from("instrument").select("id").like("instrument_code", "instrument_%"), "verify instruments"),
    must(service.from("experiment_task").select("id").like("task_code", "instrument_%"), "verify tasks"),
    must(service.from("sample").select("id").like("sample_code", "instrument_%"), "verify samples"),
    must(service.from("research_project").select("id").like("project_code", "instrument_%"), "verify projects"),
    must(service.from("experiment_method").select("id").like("method_code", "instrument_%"), "verify methods"),
  ]);
  if (usersResult.error) throw new Error(`verify users failed: ${usersResult.error.message}`);
  const users = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  const counts = { users: users.length, instruments: instruments.length, tasks: tasks.length, samples: samples.length, projects: projects.length, methods: methods.length };
  assert(Object.values(counts).every((count) => count === 0), `temporary instrument resources remain: ${JSON.stringify(counts)}`);
  return counts;
}

async function createRole() {
  const roleCode = `INSTRUMENT_READER_${Date.now()}`;
  const role = await must(service.from("sys_role").insert({ code: roleCode, name: "Instrument integration reader", status: "ACTIVE" }).select("id").single(), "create reader role");
  const permission = await must(service.from("sys_permission").select("id").eq("code", "resource.read").single(), "read resource permission");
  await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), "assign reader permission");
  return roleCode;
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `InstrumentFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Instrument test ${username}` } });
  if (error || !data.user) throw new Error(`create ${username} failed: ${error?.message ?? "missing user"}`);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: data.user.id, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: data.user.id, client };
}

async function main() {
  await runSqlCleanup();
  const readerRole = await createRole();
  const manager = await createUser("manager", "LAB_ADMIN");
  const reader = await createUser("reader", readerRole);
  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Instrument integration method", version: "1.0", status: "ACTIVE", effective_at: new Date().toISOString() }).select("id").single(), "create method");
  const project = await must(service.from("research_project").insert({ project_code: `${tag}_P`, name: "Instrument integration project", owner_id: manager.id, status: "ACTIVE" }).select("id").single(), "create project");
  const sample = await must(service.from("sample").insert({ sample_code: `${tag}_S`, project_id: project.id, name: "Instrument integration sample", quantity: 1, unit: "mL", status: "REGISTERED" }).select("id").single(), "create sample");
  const task = await must(service.from("experiment_task").insert({ task_code: `${tag}_T`, project_id: project.id, method_id: method.id, name: "Instrument integration task", status: "DRAFT" }).select("id").single(), "create task");
  await must(service.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), "link sample");
  const created = await must(manager.client.rpc("create_instrument", { _payload: { instrument_code: `${tag}_I`, name: "Integration spectrometer", type: "SPECTROMETER", model: "M-1", manufacturer: "Test Lab", location: "Room 1", owner_id: manager.id, status: "ACTIVE", commissioned_at: "2026-07-01" } }), "create instrument");
  assert(created.status === "ACTIVE" && created.instrument_code === `${tag}_I`, "instrument creation is incorrect");
  await expectError(manager.client.rpc("create_instrument", { _payload: { instrument_code: `${tag}_I`, name: "Duplicate", type: "TEST" } }), "duplicate instrument code");
  await expectError(manager.client.rpc("create_instrument", { _payload: { instrument_code: `${tag}_BAD`, name: "Invalid", type: "TEST", status: "SCRAPPED" } }), "invalid initial status");
  await expectError(reader.client.rpc("create_instrument", { _payload: { instrument_code: `${tag}_R`, name: "Forbidden", type: "TEST" } }), "reader instrument creation");
  await expectError(reader.client.from("instrument").insert({ instrument_code: `${tag}_D`, name: "Direct", type: "TEST" }), "direct instrument insert");
  await expectError(reader.client.from("instrument").update({ name: "Tampered" }).eq("id", created.id).select("id").single(), "direct instrument update");
  const updated = await must(manager.client.rpc("update_instrument", { _instrument_id: created.id, _payload: { location: "Room 2", status: "MAINTENANCE" } }), "update instrument");
  assert(updated.status === "MAINTENANCE" && updated.location === "Room 2", "instrument update is incorrect");
  await must(manager.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, instrument_id: created.id, data_type: "RAW", metric_name: "instrument_metric", raw_value: 1.25, processed_value: null, unit: "mg/L", source_type: "INSTRUMENT", collected_at: new Date().toISOString(), recorded_by: manager.id }), "create instrument-linked data");
  const detail = await must(manager.client.from("instrument").select("id, status").eq("id", created.id).single(), "read instrument");
  assert(detail.status === "MAINTENANCE", "instrument status cannot be read");
  await must(manager.client.rpc("update_instrument", { _instrument_id: created.id, _payload: { status: "SCRAPPED" } }), "scrap instrument");
  await expectError(manager.client.rpc("update_instrument", { _instrument_id: created.id, _payload: { status: "ACTIVE" } }), "restore scrapped instrument");
  await expectError(manager.client.from("experiment_data").insert({ task_id: task.id, sample_id: sample.id, instrument_id: created.id, data_type: "RAW", metric_name: "blocked_metric", raw_value: 2, processed_value: null, unit: "mg/L", source_type: "INSTRUMENT", collected_at: new Date().toISOString(), recorded_by: manager.id }), "data on scrapped instrument");
  const visible = await must(reader.client.from("instrument").select("id, instrument_code, status").eq("id", created.id).single(), "reader instrument visibility");
  assert(visible.status === "SCRAPPED", "reader cannot see instrument status");
  const audit = await must(service.from("audit_log").select("object_id, action, operator_id").eq("object_type", "instrument").eq("object_id", String(created.id)).order("id"), "instrument audit");
  assert(audit.length === 3 && audit.every((row) => row.operator_id === manager.id), "instrument audit parity is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["instrument creation and validation", "unique code", "reader and direct write denial", "metadata/status update", "instrument-data association", "scrapped terminal state", "reader visibility", "audit parity"] }));
}

try { await main(); } catch (error) { console.error(`Instrument integration failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; } finally {
  try { await runSqlCleanup(); const cleanup = await verifyCleanup(); console.log(JSON.stringify({ cleanupVerified: true, remaining: cleanup })); } catch (error) { console.error(`SQL cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
}
