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
const tag = `inventory_${Date.now()}`;
const itemCode = `${tag}_I`;
const testEmailPattern = /^inventory_\d+_(manager|reader)@example\.invalid$/;
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
  const [items, transactions, roles] = await Promise.all([
    must(service.from("inventory_item").select("id").like("item_code", "inventory_%"), "find temporary inventory items"),
    must(service.from("inventory_transaction").select("id, item_id").like("remark", "Inventory integration%"), "find temporary inventory transactions"),
    must(service.from("sys_role").select("id").like("code", "INVENTORY_READER_%"), "find temporary inventory roles"),
  ]);
  const itemIds = items.map((row) => row.id);
  const transactionIds = transactions.map((row) => row.id);
  const roleIds = roles.map((row) => row.id);
  if (itemIds.length > 0) {
    const itemTransactions = await must(service.from("inventory_transaction").select("id").in("item_id", itemIds), "find item transactions");
    transactionIds.push(...itemTransactions.map((row) => row.id));
  }
  if (userIds.length > 0) await deleteByIds("audit_log", "operator_id", userIds, "delete temporary audits by operator");
  if (itemIds.length > 0) {
    const { error } = await service.from("audit_log").delete().eq("object_type", "inventory_item").in("object_id", itemIds.map(String));
    if (error) throw new Error(`delete temporary inventory item audits: ${error.message}`);
  }
  if (transactionIds.length > 0) {
    const { error } = await service.from("audit_log").delete().eq("object_type", "inventory_transaction").in("object_id", [...new Set(transactionIds)].map(String));
    if (error) throw new Error(`delete temporary inventory transaction audits: ${error.message}`);
  }
  await deleteByIds("inventory_transaction", "id", [...new Set(transactionIds)], "delete temporary inventory transactions");
  await deleteByIds("inventory_item", "id", itemIds, "delete temporary inventory items");
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
  const [usersResult, items, transactions, roles] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    must(service.from("inventory_item").select("id").like("item_code", "inventory_%"), "verify inventory items"),
    must(service.from("inventory_transaction").select("id").like("remark", "Inventory integration%"), "verify inventory transactions"),
    must(service.from("sys_role").select("id").like("code", "INVENTORY_READER_%"), "verify inventory roles"),
  ]);
  if (usersResult.error) throw new Error(`verify users failed: ${usersResult.error.message}`);
  const users = usersResult.data.users.filter((user) => user.email && testEmailPattern.test(user.email));
  const counts = { users: users.length, items: items.length, transactions: transactions.length, roles: roles.length };
  assert(Object.values(counts).every((count) => count === 0), `temporary inventory resources remain: ${JSON.stringify(counts)}`);
  return counts;
}

async function createReaderRole() {
  const roleCode = `INVENTORY_READER_${Date.now()}`;
  const role = await must(service.from("sys_role").insert({ code: roleCode, name: "Inventory integration reader", status: "ACTIVE" }).select("id").single(), "create reader role");
  const permission = await must(service.from("sys_permission").select("id").eq("code", "resource.read").single(), "read resource permission");
  await must(service.from("sys_role_permission").insert({ role_id: role.id, permission_id: permission.id }), "assign reader permission");
  return roleCode;
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `InventoryFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${username}_${tag}`, real_name: `Inventory test ${username}` } });
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
  const readerRole = await createReaderRole();
  const manager = await createUser("manager", "LAB_ADMIN");
  const reader = await createUser("reader", readerRole);

  const item = await must(manager.client.rpc("create_inventory_item", { _payload: {
    item_code: itemCode,
    type: "REAGENT",
    name: "Inventory integration buffer",
    batch_no: "B-001",
    manufacturer: "Test Lab",
    unit: "mL",
    expiry_date: "2027-12-31",
    storage_condition: "2-8C",
    location: "Cold room 1",
  } }), "create inventory item");
  assert(item.item_code === itemCode && Number(item.quantity) === 0 && item.status === "ACTIVE", "inventory item creation is incorrect");
  await expectError(manager.client.rpc("create_inventory_item", { _payload: { item_code: itemCode, type: "REAGENT", name: "Duplicate", unit: "mL" } }), "duplicate item code");
  await expectError(manager.client.rpc("create_inventory_item", { _payload: { item_code: `${tag}_BAD`, type: "REAGENT", name: "Invalid", unit: "mL", quantity: 10 } }), "client-controlled initial quantity");
  await expectError(manager.client.rpc("create_inventory_item", { _payload: { item_code: `${tag}_BAD_STATUS`, type: "REAGENT", name: "Invalid", unit: "mL", status: "DEPLETED" } }), "invalid initial status");
  await expectError(reader.client.rpc("create_inventory_item", { _payload: { item_code: `${tag}_R`, type: "REAGENT", name: "Forbidden", unit: "mL" } }), "reader item creation");
  await expectError(reader.client.from("inventory_item").insert({ item_code: `${tag}_DIRECT`, type: "REAGENT", name: "Direct", unit: "mL" }), "direct item insert");
  await expectError(reader.client.from("inventory_item").update({ name: "Tampered" }).eq("id", item.id).select("id").single(), "direct item update");

  const inbound = await must(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "INBOUND", quantity: 10, remark: "Inventory integration inbound" } }), "record inbound");
  assert(Number(inbound.quantity) === 10, "inbound transaction is incorrect");
  const afterInbound = await must(manager.client.from("inventory_item").select("quantity, status").eq("id", item.id).single(), "read inbound balance");
  assert(Number(afterInbound.quantity) === 10 && afterInbound.status === "ACTIVE", "inbound balance is incorrect");

  const updated = await must(manager.client.rpc("update_inventory_item", { _item_id: item.id, _payload: { location: "Cold room 2", manufacturer: "Updated Test Lab" } }), "update inventory metadata");
  assert(updated.location === "Cold room 2" && updated.manufacturer === "Updated Test Lab", "inventory metadata update is incorrect");
  await expectError(manager.client.rpc("update_inventory_item", { _item_id: item.id, _payload: { quantity: 99 } }), "server-controlled balance update");
  await expectError(manager.client.from("inventory_item").update({ quantity: 99 }).eq("id", item.id).select("id").single(), "direct balance update");

  const outbound = await must(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "OUTBOUND", quantity: 3, remark: "Inventory integration outbound" } }), "record outbound");
  const returned = await must(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "RETURN", quantity: 1, remark: "Inventory integration return" } }), "record return");
  const scrapped = await must(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "SCRAP", quantity: 2, remark: "Inventory integration scrap" } }), "record scrap");
  assert(outbound.item_id === item.id && returned.item_id === item.id && scrapped.item_id === item.id, "stock movement item association is incorrect");
  await expectError(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "OUTBOUND", quantity: 7, remark: "Inventory integration insufficient" } }), "insufficient outbound");
  const depleted = await must(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "OUTBOUND", quantity: 6, remark: "Inventory integration depletion" } }), "deplete inventory");
  const depletedItem = await must(manager.client.from("inventory_item").select("quantity, status").eq("id", item.id).single(), "read depleted balance");
  assert(Number(depletedItem.quantity) === 0 && depletedItem.status === "DEPLETED" && depleted.id, "depleted state is incorrect");
  await expectError(manager.client.rpc("update_inventory_item", { _item_id: item.id, _payload: { status: "ACTIVE" } }), "restore depleted item status");
  const reactivated = await must(manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "INBOUND", quantity: 1, remark: "Inventory integration reactivation" } }), "reactivate inventory");
  assert(reactivated.id, "reactivation transaction is missing");
  const concurrentResults = await Promise.all([
    manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "OUTBOUND", quantity: 1, remark: "Inventory integration concurrent A" } }),
    manager.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "OUTBOUND", quantity: 1, remark: "Inventory integration concurrent B" } }),
  ]);
  assert(concurrentResults.filter((result) => !result.error).length === 1 && concurrentResults.filter((result) => result.error).length === 1, "concurrent stock operations did not serialize correctly");
  const concurrentBalance = await must(manager.client.from("inventory_item").select("quantity, status").eq("id", item.id).single(), "read concurrent balance");
  assert(Number(concurrentBalance.quantity) === 0 && concurrentBalance.status === "DEPLETED", "concurrent stock balance is incorrect");

  const visible = await must(reader.client.from("inventory_item").select("id, item_code, quantity, status").eq("id", item.id).single(), "reader item visibility");
  assert(visible.item_code === itemCode && Number(visible.quantity) === 0 && visible.status === "DEPLETED", "reader cannot see inventory balance");
  const history = await must(reader.client.from("inventory_transaction").select("id, item_id, transaction_type, quantity, operator_id").eq("item_id", item.id).order("id", { ascending: true }), "reader transaction visibility");
  assert(history.length === 7 && history.every((row) => row.item_id === item.id && row.operator_id === manager.id), "inventory history is incomplete");
  await expectError(reader.client.rpc("record_inventory_transaction", { _item_id: item.id, _payload: { transaction_type: "INBOUND", quantity: 1, remark: "forbidden" } }), "reader transaction creation");
  await expectError(reader.client.from("inventory_transaction").insert({ item_id: item.id, transaction_type: "INBOUND", quantity: 1, operator_id: reader.id }), "direct transaction insert");
  await expectError(reader.client.from("inventory_transaction").update({ remark: "tampered" }).eq("id", inbound.id).select("id").single(), "direct transaction update");
  await expectError(reader.client.from("inventory_transaction").delete().eq("id", inbound.id).select("id").single(), "direct transaction delete");

  const itemAudit = await must(service.from("audit_log").select("action, operator_id").eq("object_type", "inventory_item").eq("object_id", String(item.id)).order("id", { ascending: true }), "inventory item audit");
  const transactionAudit = await must(service.from("audit_log").select("action, operator_id").eq("object_type", "inventory_transaction").in("object_id", history.map((row) => String(row.id))), "inventory transaction audit");
  assert(itemAudit.filter((row) => row.action === "CREATE").length === 1 && itemAudit.filter((row) => row.action === "UPDATE").length === 1 && itemAudit.filter((row) => row.action === "STOCK_UPDATE").length === 7, "inventory item audit parity is incomplete");
  assert(transactionAudit.length === 7 && transactionAudit.every((row) => row.action === "CREATE" && row.operator_id === manager.id), "inventory transaction audit parity is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["item creation and validation", "reader and direct write denial", "transaction-managed balance", "inbound/outbound/return/scrap balance", "insufficient stock rejection", "depleted and reactivated states", "row-lock concurrency serialization", "immutable transaction history", "reader visibility", "audit parity"] }));
}

try { await main(); } catch (error) { console.error(`Inventory integration failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; } finally {
  try { await cleanup(); const remaining = await verifyCleanup(); console.log(JSON.stringify({ cleanupVerified: true, remaining })); } catch (error) { console.error(`Inventory cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
}
