import fs from "node:fs";

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
const tag = `env_${Date.now()}`;
const testEmailPattern = /^env_\d+_(manager|reader)@example\.invalid$/;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function assert(condition, message) { if (!condition) throw new Error(message); }
async function must(promise, label) { const result = await promise; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
async function expectError(promise, label) { const result = await promise; assert(result.error || !result.data, `${label} should fail`); }
async function deleteByIds(table, column, ids, label) {
  if (ids.length === 0) return;
  const { error } = await service.from(table).delete().in(column, ids);
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function cleanup() {
  const usersResult = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) throw new Error(`list temporary users: ${usersResult.error.message}`);
  const userIds = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email)).map((user) => user.id);
  const laboratories = await must(service.from("lab_laboratory").select("id").like("code", `${tag}%`), "find temporary laboratories");
  const laboratoryIds = laboratories.map((row) => row.id);
  const [thresholds, records, roles] = await Promise.all([
    laboratoryIds.length === 0 ? Promise.resolve([]) : must(service.from("environment_threshold").select("id").in("laboratory_id", laboratoryIds), "find temporary thresholds"),
    laboratoryIds.length === 0 ? Promise.resolve([]) : must(service.from("environment_record").select("id").in("laboratory_id", laboratoryIds), "find temporary environment records"),
    must(service.from("sys_role").select("id").like("code", `${tag}%`), "find temporary environment roles"),
  ]);
  const thresholdIds = thresholds.map((row) => row.id);
  const recordIds = records.map((row) => row.id);
  const roleIds = roles.map((row) => row.id);
  if (userIds.length > 0) await deleteByIds("audit_log", "operator_id", userIds, "delete temporary audits by operator");
  for (const [objectType, ids, label] of [["environment_threshold", thresholdIds, "environment threshold"], ["environment_record", recordIds, "environment record"]]) {
    if (ids.length === 0) continue;
    const { error } = await service.from("audit_log").delete().eq("object_type", objectType).in("object_id", ids.map(String));
    if (error) throw new Error(`delete temporary ${label} audits: ${error.message}`);
  }
  await deleteByIds("environment_record", "id", recordIds, "delete temporary environment records");
  await deleteByIds("environment_threshold", "id", thresholdIds, "delete temporary environment thresholds");
  await deleteByIds("lab_laboratory", "id", laboratoryIds, "delete temporary laboratories");
  await deleteByIds("sys_user_role", "user_id", userIds, "delete temporary user roles");
  await deleteByIds("sys_role_permission", "role_id", roleIds, "delete temporary role permissions");
  await deleteByIds("sys_role", "id", roleIds, "delete temporary roles");
  await deleteByIds("sys_user", "id", userIds, "delete temporary system users");
  for (const userId of userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error && !error.message.toLowerCase().includes("not found")) throw new Error(`delete temporary auth user: ${error.message}`);
  }
}

async function verifyCleanup() {
  const usersResult = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (usersResult.error) throw new Error(`verify users failed: ${usersResult.error.message}`);
  const users = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  const laboratories = await must(service.from("lab_laboratory").select("id").like("code", `${tag}%`), "verify laboratories");
  const laboratoryIds = laboratories.map((row) => row.id);
  const [thresholds, records, roles] = await Promise.all([
    laboratoryIds.length === 0 ? Promise.resolve([]) : must(service.from("environment_threshold").select("id").in("laboratory_id", laboratoryIds), "verify thresholds"),
    laboratoryIds.length === 0 ? Promise.resolve([]) : must(service.from("environment_record").select("id").in("laboratory_id", laboratoryIds), "verify records"),
    must(service.from("sys_role").select("id").like("code", `${tag}%`), "verify roles"),
  ]);
  const remaining = { users: users.length, laboratories: laboratories.length, thresholds: thresholds.length, records: records.length, roles: roles.length };
  assert(Object.values(remaining).every((count) => count === 0), `temporary environment resources remain: ${JSON.stringify(remaining)}`);
  return remaining;
}

async function createRole(code, permissionCode) {
  const role = await must(service.from("sys_role").insert({ code, name: `Environment ${permissionCode}`, status: "ACTIVE" }).select("id").single(), `create role ${code}`);
  const permission = await must(service.from("sys_permission").select("id").eq("code", permissionCode).single(), `read permission ${permissionCode}`);
  await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), `assign permission ${permissionCode}`);
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `Environment!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Environment ${username}` } });
  if (error || !data.user) throw new Error(`create ${username} failed: ${error?.message ?? "missing user"}`);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: data.user.id, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: data.user.id, client };
}

async function main() {
  await cleanup();
  const readerRoleCode = `${tag}_R`;
  const managerRoleCode = `${tag}_M`;
  await createRole(readerRoleCode, "resource.read");
  await createRole(managerRoleCode, "resource.manage");
  const manager = await createUser("manager", managerRoleCode);
  const reader = await createUser("reader", readerRoleCode);
  const laboratory = await must(service.from("lab_laboratory").insert({ code: `${tag}_LAB`, name: "Environment integration lab", location: "integration", manager_id: manager.id, status: "ACTIVE" }).select("id").single(), "create active laboratory");
  const inactiveLaboratory = await must(service.from("lab_laboratory").insert({ code: `${tag}_OFF`, name: "Environment inactive lab", location: "integration", manager_id: manager.id, status: "INACTIVE" }).select("id").single(), "create inactive laboratory");

  const threshold = await must(manager.client.rpc("save_environment_threshold", { _threshold_id: 0, _payload: { laboratory_id: laboratory.id, metric: "TEMP", unit: "C", threshold_min: 10, threshold_max: 20 } }), "create environment threshold");
  assert(Number(threshold.threshold_min) === 10 && Number(threshold.threshold_max) === 20, "threshold bounds were not stored");
  await expectError(manager.client.rpc("save_environment_threshold", { _threshold_id: 0, _payload: { laboratory_id: laboratory.id, metric: "BAD", unit: "C", threshold_min: 20, threshold_max: 10 } }), "invalid threshold bounds");
  await expectError(reader.client.rpc("save_environment_threshold", { _threshold_id: 0, _payload: { laboratory_id: laboratory.id, metric: "HUM", unit: "%", threshold_min: 10, threshold_max: 90 } }), "reader threshold management");

  const normal = await must(manager.client.rpc("record_environment_reading", { _payload: { laboratory_id: laboratory.id, metric: "TEMP", unit: "C", value: 15, source_type: "MANUAL" } }), "record normal environment value");
  const exceeded = await must(manager.client.rpc("record_environment_reading", { _payload: { laboratory_id: laboratory.id, metric: "TEMP", unit: "C", value: 25, source_type: "API" } }), "record exceeded environment value");
  const boundary = await must(manager.client.rpc("record_environment_reading", { _payload: { laboratory_id: laboratory.id, metric: "TEMP", unit: "C", value: 20, source_type: "SENSOR" } }), "record boundary environment value");
  assert(normal.status === "NORMAL" && exceeded.status === "EXCEEDED" && boundary.status === "NORMAL", "environment threshold status calculation is incorrect");
  assert(Number(exceeded.threshold_min) === 10 && Number(exceeded.threshold_max) === 20, "threshold snapshot is missing");
  await expectError(manager.client.rpc("record_environment_reading", { _payload: { laboratory_id: inactiveLaboratory.id, metric: "TEMP", unit: "C", value: 15 } }), "inactive laboratory reading");
  await expectError(manager.client.rpc("record_environment_reading", { _payload: { laboratory_id: laboratory.id, metric: "TEMP", unit: "C", value: 15, collected_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() } }), "future environment reading");
  await expectError(reader.client.rpc("record_environment_reading", { _payload: { laboratory_id: laboratory.id, metric: "TEMP", unit: "C", value: 15 } }), "reader environment management");
  await expectError(reader.client.from("environment_record").insert({ laboratory_id: laboratory.id, metric: "TEMP", unit: "C", value: 15, collected_at: new Date().toISOString(), source_type: "MANUAL", recorded_by: reader.id, status: "NORMAL" }), "reader direct environment insert");
  await expectError(reader.client.from("environment_record").update({ value: 16 }).eq("id", normal.id), "reader direct environment update");
  await expectError(reader.client.from("environment_record").delete().eq("id", normal.id), "reader direct environment delete");

  const alerts = await must(reader.client.rpc("get_environment_alerts", { _days: 30, _laboratory_id: laboratory.id }), "read environment alerts");
  assert(Array.isArray(alerts) && alerts.length === 1 && alerts[0].id === exceeded.id, "environment alert query returned the wrong records");
  await expectError(reader.client.rpc("get_environment_alerts", { _days: -1 }), "invalid environment alert window");
  const updated = await must(manager.client.rpc("save_environment_threshold", { _threshold_id: threshold.id, _payload: { threshold_min: 12, threshold_max: 18 } }), "update environment threshold");
  assert(Number(updated.threshold_min) === 12 && Number(updated.threshold_max) === 18, "threshold update failed");
  const history = await must(reader.client.from("environment_record").select("id, status, threshold_min, threshold_max").eq("laboratory_id", laboratory.id).order("id", { ascending: true }), "read environment history");
  const normalHistory = history.find((row) => row.id === normal.id);
  assert(normalHistory?.status === "NORMAL" && Number(normalHistory.threshold_min) === 10 && Number(normalHistory.threshold_max) === 20, "environment history was mutated after threshold update");
  const thresholdAudit = await must(service.from("audit_log").select("action, after_json").eq("object_type", "environment_threshold").eq("object_id", String(threshold.id)).order("id", { ascending: false }).limit(1).single(), "read threshold audit");
  const recordAudit = await must(service.from("audit_log").select("action, after_json").eq("object_type", "environment_record").eq("object_id", String(exceeded.id)).single(), "read environment record audit");
  assert(thresholdAudit.action === "UPDATE" && Number(thresholdAudit.after_json.threshold_min) === 12, "threshold audit is incomplete");
  assert(recordAudit.action === "CREATE" && recordAudit.after_json.status === "EXCEEDED", "environment record audit is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["threshold configuration", "threshold validation", "normal/exceeded/boundary status", "immutable threshold snapshots", "laboratory and timestamp guards", "reader/manage permissions", "read-only history", "alert window and audit parity"] }));
}

try { await main(); } catch (error) { console.error(`Environment monitoring integration failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; } finally {
  try { await cleanup(); const remaining = await verifyCleanup(); console.log(JSON.stringify({ cleanupVerified: true, remaining })); } catch (error) { console.error(`Environment monitoring cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
}
