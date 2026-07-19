import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const values = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
  }));
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY || !values.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("需要 .env.local 中的 Supabase URL、anon key 和 service role key");
  }
  return values;
}

const env = loadEnv();
const tag = `mainflow_${Date.now()}`;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsers = [];
const created = { projectIds: [], methodIds: [], taskIds: [], sampleIds: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function expectError(promise, fragment, label) {
  const result = await promise;
  assert(result.error, `${label} 应失败`);
  assert(result.error.message.includes(fragment), `${label} 错误不匹配: ${result.error.message}`);
}

async function createUser(username, roleCode) {
  const email = `${tag}_${username}@example.invalid`;
  const password = `MainFlow!${Date.now()}_${username}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, real_name: `主流程测试 ${username}` },
  });
  if (error || !data.user) throw new Error(`创建 ${username} 失败: ${error?.message ?? "missing user"}`);
  const userId = data.user.id;
  createdUsers.push(userId);
  const role = await must(service.from("sys_role").select("id").eq("code", roleCode).single(), `读取角色 ${roleCode}`);
  await must(service.from("sys_user_role").insert({ user_id: userId, role_id: role.id }), `分配角色 ${username}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`登录 ${username} 失败: ${signIn.error.message}`);
  return { id: userId, client };
}

async function cleanup() {
  if (created.sampleIds.length) {
    await service.from("sample_flow").delete().in("sample_id", created.sampleIds);
    await service.from("audit_log").delete().eq("object_type", "sample").in("object_id", created.sampleIds.map(String));
    await service.from("task_sample").delete().in("sample_id", created.sampleIds);
    await service.from("sample").delete().in("id", created.sampleIds);
  }
  if (created.taskIds.length) {
    await service.from("task_status_history").delete().in("task_id", created.taskIds);
    await service.from("task_assignee").delete().in("task_id", created.taskIds);
    await service.from("task_group_assignee").delete().in("task_id", created.taskIds);
    await service.from("audit_log").delete().eq("object_type", "experiment_task").in("object_id", created.taskIds.map(String));
    await service.from("experiment_task").delete().in("id", created.taskIds);
  }
  if (created.projectIds.length) await service.from("research_project").delete().in("id", created.projectIds);
  if (created.methodIds.length) await service.from("experiment_method").delete().in("id", created.methodIds);
  if (createdUsers.length) {
    await service.from("sys_user_role").delete().in("user_id", createdUsers);
    await service.from("sys_user").delete().in("id", createdUsers);
    for (const userId of createdUsers) await service.auth.admin.deleteUser(userId);
  }
}

async function main() {
  const admin = await createUser("admin", "SYSTEM_ADMIN");
  const worker = await createUser("worker", "RESEARCHER");

  // experiment_method currently exposes read-only RLS; the fixture uses service role only for this seed row.
  const method = await must(service.from("experiment_method").insert({ method_code: `${tag}_METHOD`, name: "主流程测试方法", version: "1.0.0", status: "ACTIVE" }).select("id").single(), "创建方法夹具");
  created.methodIds.push(method.id);
  const project = await must(admin.client.from("research_project").insert({ project_code: `${tag}_PROJECT`, name: "主流程测试项目", owner_id: admin.id, status: "ACTIVE" }).select("id").single(), "创建项目夹具");
  created.projectIds.push(project.id);
  const task = await must(admin.client.from("experiment_task").insert({ task_code: `${tag}_TASK`, project_id: project.id, method_id: method.id, name: "主流程测试任务", priority: "NORMAL", status: "DRAFT" }).select("id").single(), "创建任务夹具");
  created.taskIds.push(task.id);
  const sample = await must(admin.client.from("sample").insert({ sample_code: `${tag}_SAMPLE`, project_id: project.id, name: "主流程测试样品", quantity: 1, unit: "mL", source: "integration" }).select("id, sample_code, status").single(), "登记样品夹具");
  created.sampleIds.push(sample.id);
  await must(admin.client.from("task_sample").insert({ task_id: task.id, sample_id: sample.id }), "关联样品与任务");

  const linkedTask = await must(worker.client.from("experiment_task").select("id, status").eq("id", task.id).single(), "执行人读取任务");
  const linkedSample = await must(worker.client.from("sample").select("id, sample_code, status").eq("id", sample.id).single(), "执行人读取样品");
  assert(linkedTask.status === "DRAFT" && linkedSample.status === "REGISTERED", "主流程初始状态错误");
  const taskSamples = await must(worker.client.from("task_sample").select("task_id, sample_id").eq("task_id", task.id).eq("sample_id", sample.id).single(), "读取样品任务关联");
  assert(taskSamples.task_id === task.id && taskSamples.sample_id === sample.id, "样品任务关联缺失");

  await expectError(admin.client.from("sample").insert({ sample_code: sample.sample_code, project_id: project.id, name: "重复编号", quantity: 1, unit: "mL" }), "duplicate key", "重复样品编号");
  await must(admin.client.rpc("replace_task_assignments", { _task_id: task.id, _user_ids: [worker.id], _group_ids: [] }), "分配任务");
  const assignedTask = await must(worker.client.from("experiment_task").select("status").eq("id", task.id).single(), "执行人读取已分配任务");
  const assignment = await must(worker.client.from("task_assignee").select("user_id").eq("task_id", task.id).is("unassigned_at", null).single(), "执行人读取个人分配");
  assert(assignedTask.status === "ASSIGNED" && assignment.user_id === worker.id, "任务分配或状态推进错误");

  await must(worker.client.rpc("transition_task", { _task_id: task.id, _to_status: "IN_PROGRESS", _remark: "开始实验" }), "推进任务状态");
  await must(worker.client.rpc("transition_sample_flow", { _sample_id: sample.id, _node: "TRANSFER", _location: "冷藏柜 A-03", _handover_to: worker.id, _remark: "交接" }), "记录样品交接");
  await must(worker.client.rpc("transition_sample_flow", { _sample_id: sample.id, _node: "PROCESS", _location: "实验台 1", _handover_to: null, _remark: "开始处理" }), "处理样品");
  await must(worker.client.rpc("transition_sample_flow", { _sample_id: sample.id, _node: "PROCESS", _location: "实验台 1", _handover_to: null, _remark: "处理完成" }), "完成样品处理");
  await must(worker.client.rpc("transition_sample_flow", { _sample_id: sample.id, _node: "ARCHIVE", _location: "归档柜 B-01", _handover_to: null, _remark: "归档" }), "归档样品");

  const finalSample = await must(worker.client.from("sample").select("status").eq("id", sample.id).single(), "读取样品终态");
  const flows = await must(worker.client.from("sample_flow").select("node, location, handover_to, occurred_at").eq("sample_id", sample.id).order("id"), "读取样品流转历史");
  const taskState = await must(worker.client.from("experiment_task").select("status").eq("id", task.id).single(), "读取任务执行状态");
  assert(finalSample.status === "ARCHIVED", "样品未进入 ARCHIVED");
  assert(taskState.status === "IN_PROGRESS", "任务未进入 IN_PROGRESS");
  assert(flows.length === 4 && flows[0].node === "TRANSFER" && flows[0].location === "冷藏柜 A-03" && flows[0].handover_to === worker.id, "样品流转记录不完整");
  assert(flows.every((flow) => flow.occurred_at), "样品流转缺少发生时间");

  console.log(JSON.stringify({ ok: true, checks: ["unique sample code", "sample-task association", "assigned worker visibility", "task execution transition", "sample handover/location/time history", "sample archive terminal state"], cleanedByFinally: true }));
}

try {
  await main();
} catch (error) {
  console.error(`Main-flow integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
