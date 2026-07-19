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
const tag = `method_${Date.now()}`;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsers = [];
const created = { methodIds: [], attachmentIds: [], storagePaths: [] };

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

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `MethodFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, real_name: `Method test ${username}` } });
  if (error || !data.user) throw new Error(`create ${username} failed: ${error?.message ?? "missing user"}`);
  const userId = data.user.id;
  createdUsers.push(userId);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `read role ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: userId, role_id: role.id }), `assign role ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign in ${username} failed: ${signIn.error.message}`);
  return { id: userId, client };
}

async function cleanup() {
  if (created.storagePaths.length) await service.storage.from("lims-methods").remove(created.storagePaths);
  if (created.attachmentIds.length) {
    await service.from("audit_log").delete().eq("object_type", "attachment").in("object_id", created.attachmentIds.map(String));
    await service.from("attachment").delete().in("id", created.attachmentIds);
  }
  if (created.methodIds.length) {
    await service.from("audit_log").delete().eq("object_type", "experiment_method").in("object_id", created.methodIds.map(String));
    await service.from("experiment_method").delete().in("id", created.methodIds);
  }
  if (createdUsers.length) {
    await service.from("sys_user_role").delete().in("user_id", createdUsers);
    await service.from("sys_user").delete().in("id", createdUsers);
    for (const userId of createdUsers) await service.auth.admin.deleteUser(userId);
  }
}

async function main() {
  const admin = await createUser("admin", "SYSTEM_ADMIN");
  const reader = await createUser("reader", "RESEARCHER");
  const methodCode = `${tag}_M`;

  const method = await must(admin.client.from("experiment_method").insert({ method_code: methodCode, name: "Method integration", version: "1.0", scope: "integration", status: "DRAFT" }).select("id, method_code, version, status").single(), "create method version");
  created.methodIds.push(method.id);
  assert(method.status === "DRAFT", "method should start as DRAFT");

  const createdHistory = await must(admin.client.from("experiment_method_history").select("change_type, to_version, to_status, operator_id").eq("method_id", method.id).single(), "read create history");
  assert(createdHistory.change_type === "CREATE_VERSION" && createdHistory.to_version === "1.0" && createdHistory.operator_id === admin.id, "create history is incomplete");

  await expectError(admin.client.from("experiment_method").insert({ method_code: methodCode, name: "Duplicate", version: "1.0", status: "DRAFT" }), "duplicate method version");
  await expectError(admin.client.from("experiment_method").update({ version: "2.0" }).eq("id", method.id).select("id").single(), "method identity mutation");

  const activated = await must(admin.client.from("experiment_method").update({ status: "ACTIVE", effective_at: new Date().toISOString() }).eq("id", method.id).select("status").single(), "activate method");
  assert(activated.status === "ACTIVE", "method should become ACTIVE");
  const history = await must(admin.client.from("experiment_method_history").select("change_type, from_status, to_status, operator_id").eq("method_id", method.id).order("id"), "read method history");
  assert(history.length === 2 && history[1].change_type === "STATUS_CHANGE" && history[1].from_status === "DRAFT" && history[1].to_status === "ACTIVE", "status history is incomplete");

  const storagePath = `methods/${method.id}/${tag}.pdf`;
  const uploaded = await admin.client.storage.from("lims-methods").upload(storagePath, new Blob(["method artifact"], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
  if (uploaded.error) throw new Error(`upload method file: ${uploaded.error.message}`);
  created.storagePaths.push(storagePath);
  const downloaded = await reader.client.storage.from("lims-methods").download(storagePath);
  assert(!downloaded.error && downloaded.data, "reader cannot download method file");
  await expectError(reader.client.storage.from("lims-methods").upload(`methods/${method.id}/${tag}_forged.pdf`, new Blob(["forged"], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false }), "reader storage write");

  const attachment = await must(admin.client.from("attachment").insert({ object_type: "experiment_method", object_id: String(method.id), file_name: "method.pdf", storage_path: `${tag}/${method.id}/method.pdf`, file_size: 128, content_type: "application/pdf", uploaded_by: admin.id }).select("id, storage_path").single(), "create method attachment");
  created.attachmentIds.push(attachment.id);
  const readerMethod = await must(reader.client.from("experiment_method").select("id, method_code, version, status").eq("id", method.id).single(), "reader method visibility");
  const readerHistory = await must(reader.client.from("experiment_method_history").select("change_type").eq("method_id", method.id), "reader history visibility");
  const readerAttachment = await must(reader.client.from("attachment").select("id, storage_path").eq("id", attachment.id).single(), "reader attachment visibility");
  assert(readerMethod.status === "ACTIVE" && readerHistory.length === 2 && readerAttachment.storage_path === attachment.storage_path, "reader visibility is incomplete");
  await expectError(reader.client.from("experiment_method").insert({ method_code: `${tag}_READ`, name: "Reader write", version: "1.0", status: "DRAFT" }), "reader method write");
  await expectError(reader.client.from("attachment").insert({ object_type: "experiment_method", object_id: String(method.id), file_name: "forged.pdf", storage_path: "forged", file_size: 1, content_type: "application/pdf", uploaded_by: reader.id }), "reader attachment write");

  const audit = await must(service.from("audit_log").select("action, operator_id").eq("object_type", "experiment_method").eq("object_id", String(method.id)).order("id"), "read method audit");
  assert(audit.length === 2 && audit.every((item) => item.operator_id === admin.id), "method audit history is incomplete");
  console.log(JSON.stringify({ ok: true, checks: ["unique method version", "immutable method identity", "status and history recording", "private method storage upload/download", "method attachment metadata", "reader RLS visibility", "write permission boundary", "audit parity"], cleanedByFinally: true }));
}

try {
  await main();
} catch (error) {
  console.error(`Method integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
