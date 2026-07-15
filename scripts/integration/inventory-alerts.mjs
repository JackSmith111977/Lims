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
const tag = `ia_${Date.now()}`;
const testEmailPattern = /^ia_\d+_(manager|reader|operator)@example\.invalid$/;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function assert(condition, message) { if (!condition) throw new Error(message); }
async function must(promise, label) { const result = await promise; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
async function expectError(promise, label) { const result = await promise; assert(result.error || !result.data, `${label} should fail`); }
async function deleteByIds(table, column, ids, label) {
  if (ids.length === 0) return;
  const { error } = await service.from(table).delete().in(column, ids);
  if (error) throw new Error(`${label}: ${error.message}`);
}
function dateShift(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function cleanup() {
  const usersResult = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) throw new Error(`list temporary users: ${usersResult.error.message}`);
  const userIds = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email)).map((user) => user.id);
  const [items, transactions, tasks, projects, methods, roles] = await Promise.all([
    must(service.from("inventory_item").select("id").like("item_code", "ia_%"), "find temporary inventory items"),
    must(service.from("inventory_transaction").select("id, item_id").like("remark", "Inventory alerts integration%"), "find temporary inventory transactions"),
    must(service.from("experiment_task").select("id").like("task_code", "ia_%"), "find temporary tasks"),
    must(service.from("research_project").select("id").like("project_code", "ia_%"), "find temporary projects"),
    must(service.from("experiment_method").select("id").like("method_code", "ia_%"), "find temporary methods"),
    must(service.from("sys_role").select("id").or("code.like.IAR_%,code.like.IAM_%"), "find temporary roles"),
  ]);
  const itemIds = items.map((row) => row.id);
  const transactionIds = transactions.map((row) => row.id);
  const taskIds = tasks.map((row) => row.id);
  const projectIds = projects.map((row) => row.id);
  const methodIds = methods.map((row) => row.id);
  const roleIds = roles.map((row) => row.id);
  if (itemIds.length > 0) {
    const itemTransactions = await must(service.from("inventory_transaction").select("id").in("item_id", itemIds), "find item transactions");
    transactionIds.push(...itemTransactions.map((row) => row.id));
  }
  if (userIds.length > 0) await deleteByIds("audit_log", "operator_id", userIds, "delete temporary audits by operator");
  for (const [objectType, ids, label] of [["inventory_item", itemIds, "inventory item"], ["inventory_transaction", [...new Set(transactionIds)], "inventory transaction"], ["experiment_task", taskIds, "task"], ["research_project", projectIds, "project"], ["experiment_method", methodIds, "method"]]) {
    if (ids.length === 0) continue;
    const { error } = await service.from("audit_log").delete().eq("object_type", objectType).in("object_id", ids.map(String));
    if (error) throw new Error(`delete temporary ${label} audits: ${error.message}`);
  }
  await deleteByIds("inventory_transaction", "id", [...new Set(transactionIds)], "delete temporary inventory transactions");
  await deleteByIds("inventory_item", "id", itemIds, "delete temporary inventory items");
  await deleteByIds("task_resource", "task_id", taskIds, "delete temporary task resources");
  await deleteByIds("experiment_task", "id", taskIds, "delete temporary tasks");
  await deleteByIds("research_project", "id", projectIds, "delete temporary projects");
  await deleteByIds("experiment_method", "id", methodIds, "delete temporary methods");
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
  const [usersResult, items, transactions, tasks, projects, methods, roles] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    must(service.from("inventory_item").select("id").like("item_code", "ia_%"), "verify inventory items"),
    must(service.from("inventory_transaction").select("id").like("remark", "Inventory alerts integration%"), "verify inventory transactions"),
    must(service.from("experiment_task").select("id").like("task_code", "ia_%"), "verify tasks"),
    must(service.from("research_project").select("id").like("project_code", "ia_%"), "verify projects"),
    must(service.from("experiment_method").select("id").like("method_code", "ia_%"), "verify methods"),
    must(service.from("sys_role").select("id").or("code.like.IAR_%,code.like.IAM_%"), "verify roles"),
  ]);
  if (usersResult.error) throw new Error(`verify users failed: ${usersResult.error.message}`);
  const users = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  const counts = { users: users.length, items: items.length, transactions: transactions.length, tasks: tasks.length, projects: projects.length, methods: methods.length, roles: roles.length };
  assert(Object.values(counts).every((count) => count === 0), `temporary inventory alert resources remain: ${JSON.stringify(counts)}`);
  return counts;
}

async function createRole(roleCode, permissionCode, name) {
  const role = await must(service.from("sys_role").insert({ code: roleCode, name, status: "ACTIVE" }).select("id").single(), `create role ${roleCode}`);
  const permission = await must(service.from("sys_permission").select("id").eq("code", permissionCode).single(), `read permission ${permissionCode}`);
  await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), `assign permission ${permissionCode}`);
  return roleCode;
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `InventoryAlerts!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Inventory alerts ${username}` } });
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
  const readerRole = await createRole(`IAR_${Date.now()}`, "resource.read", "Inventory alert reader");
  const managerRole = await createRole(`IAM_${Date.now()}`, "resource.manage", "Inventory alert manager");
  const manager = await createUser("manager", "LAB_ADMIN");
  const reader = await createUser("reader", readerRole);
  const operator = await createUser("operator", managerRole);
  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_M`, name: "Inventory alert method", version: "1.0", status: "ACTIVE", effective_at: dateShift(-5) }).select("id").single(), "create method");
  const project = await must(service.from("research_project").insert({ project_code: `${tag}_P`, name: "Inventory alert project", owner_id: manager.id, status: "ACTIVE" }).select("id").single(), "create project");
  const activeTask = await must(service.from("experiment_task").insert({ task_code: `${tag}_ACTIVE`, project_id: project.id, method_id: method.id, name: "Inventory active task", status: "IN_PROGRESS" }).select("id").single(), "create active task");
  const archivedTask = await must(service.from("experiment_task").insert({ task_code: `${tag}_ARCHIVED`, project_id: project.id, method_id: method.id, name: "Inventory archived task", status: "ARCHIVED" }).select("id").single(), "create archived task");

  const mainItem = await must(manager.client.rpc("create_inventory_item", { _payload: { item_code: `${tag}_MAIN`, type: "REAGENT", name: "Alert integration main", unit: "mL", expiry_date: dateShift(10), low_stock_threshold: 2, remark: "Inventory alerts integration main" } }), "create alert item");
  const expiredItem = await must(manager.client.rpc("create_inventory_item", { _payload: { item_code: `${tag}_EXPIRED`, type: "REAGENT", name: "Alert integration expired", unit: "mL", expiry_date: dateShift(-1), remark: "Inventory alerts integration expired" } }), "create expired item");
  const inactiveItem = await must(manager.client.rpc("create_inventory_item", { _payload: { item_code: `${tag}_INACTIVE`, type: "REAGENT", name: "Alert integration inactive", unit: "mL", expiry_date: dateShift(10), low_stock_threshold: 5, status: "INACTIVE", remark: "Inventory alerts integration inactive" } }), "create inactive item");
  assert(Number(mainItem.low_stock_threshold) === 2, "low stock threshold was not stored");

  const alerts = await must(reader.client.rpc("get_inventory_alerts", { _days: 30 }), "read inventory alerts");
  assert(Array.isArray(alerts), "inventory alerts should be an array");
  const mainAlerts = alerts.filter((alert) => alert.item_id === mainItem.id);
  assert(mainAlerts.some((alert) => alert.alert_type === "LOW_STOCK") && mainAlerts.some((alert) => alert.alert_type === "EXPIRING"), "main item should produce two alerts");
  assert(alerts.some((alert) => alert.item_id === expiredItem.id && alert.alert_type === "EXPIRED"), "expired item alert is missing");
  assert(!alerts.some((alert) => alert.item_id === inactiveItem.id), "inactive item should not produce alerts");
  await expectError(reader.client.rpc("get_inventory_alerts", { _days: -1 }), "invalid alert window");
  await expectError(reader.client.rpc("update_inventory_item", { _item_id: mainItem.id, _payload: { low_stock_threshold: 4 } }), "reader threshold update");
  const operatorUpdated = await must(operator.client.rpc("update_inventory_item", { _item_id: mainItem.id, _payload: { low_stock_threshold: 3 } }), "operator threshold update");
  assert(Number(operatorUpdated.low_stock_threshold) === 3, "manager-only threshold update failed");

  await must(manager.client.rpc("record_inventory_transaction", { _item_id: mainItem.id, _payload: { transaction_type: "INBOUND", quantity: 1, remark: "Inventory alerts integration inbound" } }), "seed usage balance");
  const linked = await must(manager.client.rpc("record_inventory_transaction", { _item_id: mainItem.id, _payload: { transaction_type: "OUTBOUND", quantity: 1, task_id: activeTask.id, remark: "Inventory alerts integration linked use" } }), "link usage to task");
  assert(linked.task_id === activeTask.id, "task association was not stored");
  await expectError(manager.client.rpc("record_inventory_transaction", { _item_id: mainItem.id, _payload: { transaction_type: "RETURN", quantity: 1, task_id: activeTask.id, remark: "Inventory alerts integration invalid type" } }), "non-outbound task link");
  await must(operator.client.rpc("record_inventory_transaction", { _item_id: mainItem.id, _payload: { transaction_type: "INBOUND", quantity: 1, remark: "Inventory alerts integration operator balance" } }), "operator seed balance");
  await expectError(operator.client.rpc("record_inventory_transaction", { _item_id: mainItem.id, _payload: { transaction_type: "OUTBOUND", quantity: 1, task_id: activeTask.id, remark: "Inventory alerts integration missing task permission" } }), "operator task link without task permission");
  await expectError(manager.client.rpc("record_inventory_transaction", { _item_id: mainItem.id, _payload: { transaction_type: "OUTBOUND", quantity: 1, task_id: archivedTask.id, remark: "Inventory alerts integration archived task" } }), "archived task link");
  await expectError(reader.client.from("inventory_transaction").insert({ item_id: mainItem.id, transaction_type: "INBOUND", quantity: 1, operator_id: reader.id, remark: "Inventory alerts integration direct" }), "reader direct transaction insert");

  const history = await must(reader.client.from("inventory_transaction").select("task_id, transaction_type").eq("item_id", mainItem.id).order("id", { ascending: true }), "read linked history");
  assert(history.some((row) => row.task_id === activeTask.id && row.transaction_type === "OUTBOUND"), "linked task is missing from history");
  const transactionAudit = await must(service.from("audit_log").select("action, after_json").eq("object_type", "inventory_transaction").eq("object_id", String(linked.id)).single(), "read linked transaction audit");
  assert(transactionAudit.action === "CREATE" && transactionAudit.after_json.task_id === activeTask.id, "linked transaction audit is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["low-stock threshold", "expiry and inactive alert rules", "alert window validation", "reader/operator permissions", "OUTBOUND task association", "archived task rejection", "immutable history", "task-link audit parity"] }));
}

try { await main(); } catch (error) { console.error(`Inventory alerts integration failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; } finally {
  try { await cleanup(); const remaining = await verifyCleanup(); console.log(JSON.stringify({ cleanupVerified: true, remaining })); } catch (error) { console.error(`Inventory alerts cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
}
