import fs from "node:fs";

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
const tag = `audit_${Date.now()}`;
const testEmailPattern = /^audit_\d+_(admin|reader|inactive)@example\.invalid$/;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3018";

function assert(condition, message) { if (!condition) throw new Error(message); }
async function must(promise, label) { const result = await promise; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
async function expectError(promise, label) { const result = await promise; assert(result.error || !result.data, `${label} should fail`); }
async function deleteByIds(table, column, ids, label) {
  if (ids.length === 0) return;
  const { error } = await service.from(table).delete().in(column, ids);
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function findTemporaryUsers() {
  const result = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (result.error) throw new Error(`list temporary users: ${result.error.message}`);
  return result.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
}

async function cleanup() {
  const users = await findTemporaryUsers();
  const userIds = users.map((user) => user.id);
  const roles = await must(service.from("sys_role").select("id").like("code", "audit_%"), "find temporary audit roles");
  const roleIds = roles.map((role) => role.id);
  if (userIds.length > 0) await deleteByIds("audit_log", "operator_id", userIds, "delete temporary operator audits");
  const { error: emailAuditError } = await service.from("audit_log").delete().eq("object_type", "auth").like("object_id", "audit_%");
  if (emailAuditError) throw new Error(`delete temporary login audits: ${emailAuditError.message}`);
  await deleteByIds("sys_user_role", "user_id", userIds, "delete temporary user roles");
  await deleteByIds("sys_role_permission", "role_id", roleIds, "delete temporary role permissions");
  await deleteByIds("sys_role", "id", roleIds, "delete temporary roles");
  await deleteByIds("sys_user", "id", userIds, "delete temporary system users");
  for (const user of users) {
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error && !error.message.toLowerCase().includes("not found")) throw new Error(`delete temporary auth user: ${error.message}`);
  }
}

async function verifyCleanup() {
  const users = await findTemporaryUsers();
  const roles = await must(service.from("sys_role").select("id").like("code", "audit_%"), "verify temporary audit roles");
  const audits = await must(service.from("audit_log").select("id").eq("object_type", "auth").like("object_id", "audit_%"), "verify temporary login audits");
  const remaining = { users: users.length, roles: roles.length, emailAudits: audits.length };
  assert(Object.values(remaining).every((count) => count === 0), `temporary auth resources remain: ${JSON.stringify(remaining)}`);
  return remaining;
}

async function createRole(code, permissionCodes) {
  const codes = Array.isArray(permissionCodes) ? permissionCodes : [permissionCodes];
  const role = await must(service.from("sys_role").insert({ code, name: `Audit ${codes.join("/")}`, status: "ACTIVE" }).select("id").single(), `create role ${code}`);
  for (const permissionCode of codes) {
    const permission = await must(service.from("sys_permission").select("id").eq("code", permissionCode).single(), `read permission ${permissionCode}`);
    await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), `assign permission ${permissionCode}`);
  }
  return role.id;
}

async function createUser(name, roleId) {
  const email = `${tag}_${name}@example.invalid`;
  const password = `AuditFlow!${Date.now()}_${name}`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${name}_${tag}`, real_name: `Audit ${name}` } });
  if (created.error || !created.data.user) throw new Error(`create ${name} failed: ${created.error?.message ?? "missing user"}`);
  await must(service.from("sys_user_role").insert({ user_id: created.data.user.id, role_id: roleId }), `assign role ${name}`);
  return { id: created.data.user.id, email, password };
}

function cookiesFrom(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function appRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => null);
  return { response, body, cookies: cookiesFrom(response) };
}

async function login(user) {
  const result = await appRequest("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  return result;
}

async function main() {
  await cleanup();
  const auditRoleId = await createRole(`${tag}_R`, ["audit.read", "auth.user.manage"]);
  const readerRoleId = await createRole(`${tag}_N`, "resource.read");
  const admin = await createUser("admin", auditRoleId);
  const reader = await createUser("reader", readerRoleId);
  const inactive = await createUser("inactive", auditRoleId);
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const adminSession = await adminClient.auth.signInWithPassword({ email: admin.email, password: admin.password });
  if (adminSession.error) throw new Error(`sign in temporary admin for status update failed: ${adminSession.error.message}`);
  await must(adminClient.from("sys_user").update({ status: "INACTIVE" }).eq("id", inactive.id), "deactivate temporary user");

  const successfulLogin = await login(admin);
  assert(successfulLogin.response.status === 200 && successfulLogin.cookies.length > 0, "successful login did not establish a session");
  const successfulAudit = await must(service.from("audit_log").select("action, operator_id, object_type, after_json").eq("object_type", "auth").eq("object_id", admin.id).eq("action", "LOGIN_SUCCESS").order("id", { ascending: false }).limit(1).single(), "read successful login audit");
  assert(successfulAudit.operator_id === admin.id && successfulAudit.after_json.result === "SUCCESS", "successful login audit is incomplete");

  const auditQuery = await appRequest(`/api/v1/audit-logs?objectType=auth&action=LOGIN_SUCCESS&operatorId=${admin.id}&limit=1`, { headers: { cookie: successfulLogin.cookies } });
  assert(auditQuery.response.status === 200 && Array.isArray(auditQuery.body?.data) && auditQuery.body.data.length === 1, "audit.read query did not return the successful login event");
  assert(!JSON.stringify(auditQuery.body).includes("password") && !JSON.stringify(auditQuery.body).includes("accessToken"), "audit response exposed sensitive fields");

  const failedLogin = await appRequest("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "wrong-password" }),
  });
  assert(failedLogin.response.status === 401, "invalid credentials were not rejected");
  const failureAudit = await must(service.from("audit_log").select("action, operator_id, after_json").eq("object_type", "auth").eq("object_id", admin.email).eq("action", "LOGIN_FAILURE").order("id", { ascending: false }).limit(1).single(), "read failed login audit");
  assert(failureAudit.operator_id === null && failureAudit.after_json.result === "FAILURE", "failed login audit is incomplete");

  const blockedLogin = await login(inactive);
  assert(blockedLogin.response.status === 403, "inactive user was not blocked");
  const blockedAudit = await must(service.from("audit_log").select("action, operator_id, after_json").eq("object_type", "auth").eq("object_id", inactive.id).eq("action", "LOGIN_BLOCKED").order("id", { ascending: false }).limit(1).single(), "read blocked login audit");
  assert(blockedAudit.operator_id === inactive.id && blockedAudit.after_json.result === "BLOCKED", "blocked login audit is incomplete");

  const readerLogin = await login(reader);
  assert(readerLogin.response.status === 200 && readerLogin.cookies.length > 0, "reader login failed");
  const forbiddenAuditQuery = await appRequest("/api/v1/audit-logs", { headers: { cookie: readerLogin.cookies } });
  assert(forbiddenAuditQuery.response.status === 403, "user without audit.read can query audit logs");
  const readerClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const readerSession = await readerClient.auth.signInWithPassword({ email: reader.email, password: reader.password });
  assert(!readerSession.error, "reader direct database session failed");
  await expectError(readerClient.from("audit_log").insert({ object_type: "auth", object_id: `${tag}_direct`, action: "FORGED", operator_id: reader.id, after_json: { result: "FORGED" } }), "direct audit insert");
  await expectError(readerClient.from("audit_log").update({ action: "FORGED" }).eq("object_type", "auth"), "direct audit update");
  await expectError(readerClient.from("audit_log").delete().eq("object_type", "auth"), "direct audit delete");

  const logout = await appRequest("/api/v1/auth/logout", { method: "POST", headers: { cookie: successfulLogin.cookies } });
  assert(logout.response.status === 200, "logout failed");
  const logoutAudit = await must(service.from("audit_log").select("action, operator_id, after_json").eq("object_type", "auth").eq("object_id", admin.id).eq("action", "LOGOUT").order("id", { ascending: false }).limit(1).single(), "read logout audit");
  assert(logoutAudit.operator_id === admin.id && logoutAudit.after_json.result === "SUCCESS", "logout audit is incomplete");

  console.log(JSON.stringify({ ok: true, checks: ["successful login audit", "failed login audit", "inactive login block", "audit.read query", "sensitive field exclusion", "unauthorized audit denial", "logout audit"] }));
}

try { await main(); } catch (error) { console.error(`Auth audit integration failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; } finally {
  try { await cleanup(); const remaining = await verifyCleanup(); console.log(JSON.stringify({ cleanupVerified: true, remaining })); } catch (error) { console.error(`Auth audit cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
}
