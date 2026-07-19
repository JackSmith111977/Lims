import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { hasPermission } from "@/lib/auth/permissions";
import { SAMPLE_FLOW_NODES, type SampleFlowNode } from "@/lib/sample-flow";
import {
  AdminApiError,
  optionalText,
  recordAudit,
  requireId,
  requireObject,
  requireText,
  requireUuid,
} from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

export const SAMPLE_FIELDS = "id, sample_code, project_id, name, specification, batch_no, quantity, unit, source, storage_condition, status, registered_at, created_at, updated_at";

const SAMPLE_STATUSES = ["REGISTERED", "PROCESSING", "PROCESSED", "ARCHIVED", "DISPOSED"] as const;
export { SAMPLE_FLOW_NODES } from "@/lib/sample-flow";

type SampleRow = Database["public"]["Tables"]["sample"]["Row"];
type SampleFlowRow = Database["public"]["Tables"]["sample_flow"]["Row"];

type ProjectSummary = { id: number; projectCode: string; name: string; status: string };
type MethodSummary = { id: number; methodCode: string; name: string; version: string; status: string };

export type SampleTaskView = {
  id: number;
  taskCode: string;
  name: string;
  projectId: number;
  status: string;
  method: MethodSummary | null;
};

export type SampleView = {
  id: number;
  sampleCode: string;
  projectId: number;
  name: string;
  specification: string | null;
  batchNo: string | null;
  quantity: number;
  unit: string;
  source: string | null;
  storageCondition: string | null;
  status: string;
  currentLocation: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
  project: ProjectSummary | null;
  tasks: SampleTaskView[];
};

export type SampleFlowView = {
  id: number;
  sampleId: number;
  fromStatus: string | null;
  toStatus: string;
  node: string;
  operatorId: string;
  location: string | null;
  handoverTo: string | null;
  remark: string | null;
  occurredAt: string;
};

function parseSampleStatus(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (!SAMPLE_STATUSES.includes(String(value) as (typeof SAMPLE_STATUSES)[number])) {
    throw new AdminApiError(400, "INVALID_SAMPLE_STATUS", "样品状态不受支持。");
  }
  return String(value);
}

export function parseFlowNode(value: unknown) {
  const node = requireText(value, "node", 64).toUpperCase();
  if (!SAMPLE_FLOW_NODES.includes(node as SampleFlowNode)) {
    throw new AdminApiError(400, "INVALID_FLOW_NODE", "流转节点不受支持。");
  }
  return node as SampleFlowNode;
}

export function buildFlowPayload(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  for (const field of ["fromStatus", "toStatus", "operatorId", "occurredAt"]) {
    if (body[field] !== undefined) {
      throw new AdminApiError(400, "INVALID_FLOW_FIELD", `${field} 由服务端生成。`);
    }
  }
  return {
    node: parseFlowNode(body.node),
    location: body.location === null ? null : optionalText(body.location, "location", 128) ?? null,
    handoverTo: body.handoverTo === null || body.handoverTo === undefined ? null : requireUuid(String(body.handoverTo)),
    remark: body.remark === null ? null : optionalText(body.remark, "remark", 2000) ?? null,
  };
}

function parseSampleIdList(value: unknown) {
  if (!Array.isArray(value)) throw new AdminApiError(400, "INVALID_FIELD", "taskIds 必须是数字 ID 数组。");
  const ids = value.map((item) => {
    try {
      return requireId(String(item));
    } catch {
      throw new AdminApiError(400, "INVALID_FIELD", "taskIds 包含无效 ID。");
    }
  });
  return [...new Set(ids)];
}

function parseQuantity(value: unknown) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(text)) {
    throw new AdminApiError(400, "INVALID_QUANTITY", "quantity 必须是非负且最多 6 位小数的数字。");
  }
  const quantity = Number(text);
  if (!Number.isFinite(quantity)) throw new AdminApiError(400, "INVALID_QUANTITY", "quantity 不是有效数字。");
  return quantity;
}

function parseSampleCode(value: unknown) {
  const code = requireText(value, "sampleCode", 32).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(code)) {
    throw new AdminApiError(400, "INVALID_SAMPLE_CODE", "sampleCode 只能包含字母、数字、点、下划线和连字符。");
  }
  return code;
}

function buildGeneratedSampleCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SMP-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function buildSamplePayload(bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  if (body.status !== undefined) {
    throw new AdminApiError(403, "SAMPLE_STATUS_DEFERRED", "样品状态必须通过 T-204 流转接口修改。");
  }

  const payload: Record<string, unknown> = {};
  if (body.sampleCode !== undefined) payload.sample_code = parseSampleCode(body.sampleCode);
  if (!update || body.projectId !== undefined) payload.project_id = requireId(String(body.projectId));
  if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
  if (body.specification !== undefined) payload.specification = body.specification === null ? null : optionalText(body.specification, "specification", 255);
  if (body.batchNo !== undefined) payload.batch_no = body.batchNo === null ? null : optionalText(body.batchNo, "batchNo", 64);
  if (!update || body.quantity !== undefined) payload.quantity = parseQuantity(body.quantity);
  if (!update || body.unit !== undefined) payload.unit = requireText(body.unit, "unit", 16);
  if (body.source !== undefined) payload.source = body.source === null ? null : optionalText(body.source, "source", 128);
  if (body.storageCondition !== undefined) payload.storage_condition = body.storageCondition === null ? null : optionalText(body.storageCondition, "storageCondition", 255);

  const taskIds = body.taskIds === undefined ? undefined : parseSampleIdList(body.taskIds);
  if (update && Object.keys(payload).length === 0 && taskIds === undefined) {
    throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的样品字段。");
  }
  return { payload, taskIds };
}

function serializeSample(row: SampleRow, project: ProjectSummary | null, tasks: SampleTaskView[], currentLocation: string | null): SampleView {
  return {
    id: row.id,
    sampleCode: row.sample_code,
    projectId: row.project_id,
    name: row.name,
    specification: row.specification,
    batchNo: row.batch_no,
    quantity: row.quantity,
    unit: row.unit,
    source: row.source,
    storageCondition: row.storage_condition,
    status: row.status,
    currentLocation,
    registeredAt: row.registered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project,
    tasks,
  };
}

async function loadSampleReferences(supabase: SupabaseClient<Database>, rows: SampleRow[]) {
  const projectIds = [...new Set(rows.map((row) => row.project_id))];
  const { data: projects, error: projectError } = await supabase
    .from("research_project")
    .select("id, project_code, name, status")
    .in("id", projectIds);
  if (projectError) throw new AdminApiError(500, "SAMPLE_REFERENCE_LOOKUP_FAILED", "无法读取样品项目引用。");

  const sampleIds = rows.map((row) => row.id);
  const { data: links, error: linkError } = sampleIds.length
    ? await supabase.from("task_sample").select("sample_id, task_id").in("sample_id", sampleIds)
    : { data: [], error: null };
  if (linkError) throw new AdminApiError(500, "SAMPLE_TASK_LOOKUP_FAILED", "无法读取样品任务关联。");

  const taskIds = [...new Set((links ?? []).map((link) => link.task_id))];
  const { data: taskRows, error: taskError } = taskIds.length
    ? await supabase.from("experiment_task").select("id, task_code, project_id, method_id, name, status").in("id", taskIds)
    : { data: [], error: null };
  if (taskError) throw new AdminApiError(500, "SAMPLE_TASK_LOOKUP_FAILED", "无法读取样品任务。");

  const methodIds = [...new Set((taskRows ?? []).map((task) => task.method_id))];
  const { data: methodRows, error: methodError } = methodIds.length
    ? await supabase.from("experiment_method").select("id, method_code, name, version, status").in("id", methodIds)
    : { data: [], error: null };
  if (methodError) throw new AdminApiError(500, "SAMPLE_METHOD_LOOKUP_FAILED", "无法读取样品关联方法。");

  const projectMap = new Map((projects ?? []).map((project) => [project.id, {
    id: project.id,
    projectCode: project.project_code,
    name: project.name,
    status: project.status,
  }]));
  const methodMap = new Map((methodRows ?? []).map((method) => [method.id, {
    id: method.id,
    methodCode: method.method_code,
    name: method.name,
    version: method.version,
    status: method.status,
  }]));
  const taskMap = new Map<number, SampleTaskView>();
  for (const task of taskRows ?? []) {
    taskMap.set(task.id, {
      id: task.id,
      taskCode: task.task_code,
      name: task.name,
      projectId: task.project_id,
      status: task.status,
      method: methodMap.get(task.method_id) ?? null,
    });
  }
  const tasksBySample = new Map<number, SampleTaskView[]>();
  for (const link of links ?? []) {
    const task = taskMap.get(link.task_id);
    if (task) tasksBySample.set(link.sample_id, [...(tasksBySample.get(link.sample_id) ?? []), task]);
  }
  return { projectMap, tasksBySample };
}

async function buildSampleViews(supabase: SupabaseClient<Database>, rows: SampleRow[]) {
  if (rows.length === 0) return [];
  const { projectMap, tasksBySample } = await loadSampleReferences(supabase, rows);
  const { data: locationRows, error: locationError } = await supabase
    .from("sample_flow")
    .select("sample_id, location, occurred_at, id")
    .in("sample_id", rows.map((row) => row.id))
    .not("location", "is", null)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  if (locationError) throw new AdminApiError(500, "SAMPLE_FLOW_LOOKUP_FAILED", "无法读取样品位置。");
  const locationMap = new Map<number, string>();
  for (const row of (locationRows ?? []) as Array<{ sample_id: number; location: string | null }>) {
    if (row.location && !locationMap.has(row.sample_id)) locationMap.set(row.sample_id, row.location);
  }
  return rows.map((row) => serializeSample(row, projectMap.get(row.project_id) ?? null, tasksBySample.get(row.id) ?? [], locationMap.get(row.id) ?? null));
}

export async function loadSamples(supabase: SupabaseClient<Database>, filters: { keyword?: string | null; status?: string | null; projectId?: number | null } = {}) {
  const status = parseSampleStatus(filters.status);
  let query = supabase.from("sample").select(SAMPLE_FIELDS).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "SAMPLE_LOOKUP_FAILED", "无法读取样品。");
  const keyword = filters.keyword?.toLowerCase() ?? "";
  const rows = ((data ?? []) as unknown as SampleRow[]).filter((row) => !keyword || `${row.sample_code} ${row.name} ${row.batch_no ?? ""} ${row.source ?? ""}`.toLowerCase().includes(keyword));
  return buildSampleViews(supabase, rows);
}

export async function loadSampleDetail(supabase: SupabaseClient<Database>, idValue: string) {
  const id = requireId(idValue);
  const { data, error } = await supabase.from("sample").select(SAMPLE_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new AdminApiError(500, "SAMPLE_LOOKUP_FAILED", "无法读取样品。");
  if (!data) throw new AdminApiError(404, "SAMPLE_NOT_FOUND", "样品不存在。");
  const views = await buildSampleViews(supabase, [data as unknown as SampleRow]);
  return views[0];
}

function serializeFlow(row: SampleFlowRow): SampleFlowView {
  return {
    id: row.id,
    sampleId: row.sample_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    node: row.node,
    operatorId: row.operator_id,
    location: row.location,
    handoverTo: row.handover_to,
    remark: row.remark,
    occurredAt: row.occurred_at,
  };
}

export async function loadSampleFlows(supabase: SupabaseClient<Database>, idValue: string) {
  const sampleId = requireId(idValue);
  const { data: sample, error: sampleError } = await supabase
    .from("sample")
    .select("id")
    .eq("id", sampleId)
    .maybeSingle();
  if (sampleError) throw new AdminApiError(500, "SAMPLE_LOOKUP_FAILED", "无法读取样品。");
  if (!sample) throw new AdminApiError(404, "SAMPLE_NOT_FOUND", "样品不存在。");
  const { data, error } = await supabase
    .from("sample_flow")
    .select("id, sample_id, from_status, to_status, node, operator_id, location, handover_to, remark, occurred_at")
    .eq("sample_id", sampleId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new AdminApiError(500, "SAMPLE_FLOW_LOOKUP_FAILED", "无法读取样品流转记录。");
  return ((data ?? []) as unknown as SampleFlowRow[]).map(serializeFlow);
}

function mapFlowRpcError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "42501" || message.includes("Flow permission denied")) {
    return new AdminApiError(403, "FORBIDDEN", "当前用户没有执行样品流转的权限。");
  }
  if (error.code === "P0002" || message.includes("Sample not found")) {
    return new AdminApiError(404, "SAMPLE_NOT_FOUND", "样品不存在。");
  }
  if (message.includes("Handover user inactive")) {
    return new AdminApiError(409, "HANDOVER_USER_INACTIVE", "交接用户不存在、已停用或不可用。");
  }
  if (message.includes("Invalid sample flow transition")) {
    return new AdminApiError(409, "INVALID_SAMPLE_TRANSITION", "当前样品状态不允许执行该流转节点。");
  }
  if (message.includes("Invalid flow node")) {
    return new AdminApiError(400, "INVALID_FLOW_NODE", "流转节点不受支持。");
  }
  return new AdminApiError(500, "SAMPLE_FLOW_FAILED", "样品流转失败。");
}

function serializeRpcFlow(value: unknown): SampleFlowView {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminApiError(500, "SAMPLE_FLOW_FAILED", "样品流转返回结果无效。");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.sampleId !== "number" || typeof row.node !== "string" || typeof row.toStatus !== "string" || typeof row.operatorId !== "string" || typeof row.occurredAt !== "string") {
    throw new AdminApiError(500, "SAMPLE_FLOW_FAILED", "样品流转返回结果无效。");
  }
  return {
    id: row.id,
    sampleId: row.sampleId,
    fromStatus: typeof row.fromStatus === "string" ? row.fromStatus : null,
    toStatus: row.toStatus,
    node: row.node,
    operatorId: row.operatorId,
    location: typeof row.location === "string" ? row.location : null,
    handoverTo: typeof row.handoverTo === "string" ? row.handoverTo : null,
    remark: typeof row.remark === "string" ? row.remark : null,
    occurredAt: row.occurredAt,
  };
}

export async function recordSampleFlow(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const sampleId = requireId(idValue);
  const payload = buildFlowPayload(bodyValue);
  const { data, error } = await supabase.rpc("transition_sample_flow", {
    _sample_id: sampleId,
    _node: payload.node,
    _location: payload.location ?? undefined,
    _handover_to: payload.handoverTo ?? undefined,
    _remark: payload.remark ?? undefined,
  });
  if (error) throw mapFlowRpcError(error);
  return serializeRpcFlow(data);
}

async function validateProject(supabase: SupabaseClient<Database>, projectId: number) {
  const { data, error } = await supabase.from("research_project").select("id, status").eq("id", projectId).maybeSingle();
  if (error || !data) throw new AdminApiError(400, "INVALID_PROJECT", "样品引用的项目不存在或不可见。");
  if (data.status === "ARCHIVED") throw new AdminApiError(400, "PROJECT_ARCHIVED", "归档项目不能登记新样品。");
}

async function validateTaskReferences(supabase: SupabaseClient<Database>, projectId: number, taskIds: number[]) {
  if (taskIds.length === 0) return;
  const { data, error } = await supabase
    .from("experiment_task")
    .select("id, project_id, status")
    .in("id", taskIds);
  if (error || !data || data.length !== taskIds.length) throw new AdminApiError(400, "INVALID_TASK", "样品关联的任务不存在或不可见。");
  if (data.some((task) => task.project_id !== projectId)) throw new AdminApiError(400, "INVALID_TASK_SCOPE", "样品关联的任务必须属于同一项目。");
  if (data.some((task) => task.status === "ARCHIVED")) throw new AdminApiError(400, "INVALID_TASK_STATUS", "归档任务不能新增样品关联。");
}

async function requireTaskManageForLinks(supabase: SupabaseClient<Database>, taskIds: number[] | undefined) {
  if (taskIds === undefined) return;
  if (!(await hasPermission(supabase, "task.manage"))) {
    throw new AdminApiError(403, "TASK_ASSOCIATION_FORBIDDEN", "维护样品任务关联需要 task.manage 权限。");
  }
}

async function replaceSampleTasks(supabase: SupabaseClient<Database>, sampleId: number, taskIds: number[]) {
  const { error: deleteError } = await supabase.from("task_sample").delete().eq("sample_id", sampleId);
  if (deleteError) throw deleteError;
  if (taskIds.length === 0) return;
  const { error } = await supabase.from("task_sample").insert(taskIds.map((taskId) => ({ sample_id: sampleId, task_id: taskId })));
  if (error) throw error;
}

async function insertSampleWithUniqueCode(supabase: SupabaseClient<Database>, payload: Record<string, unknown>) {
  const requestedCode = typeof payload.sample_code === "string";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sampleCode = requestedCode ? payload.sample_code : buildGeneratedSampleCode();
    const { data, error } = await supabase
      .from("sample")
      .insert({ ...payload, sample_code: sampleCode, status: "REGISTERED" } as Database["public"]["Tables"]["sample"]["Insert"])
      .select(SAMPLE_FIELDS)
      .single();
    if (!error && data) return data;
    if (error?.code === "23505" && !requestedCode) continue;
    if (error?.code === "23505") throw new AdminApiError(409, "SAMPLE_CODE_EXISTS", "样品编号已经存在。");
    throw new AdminApiError(400, "SAMPLE_CREATE_FAILED", "样品登记失败。");
  }
  throw new AdminApiError(409, "SAMPLE_CODE_GENERATION_FAILED", "样品编号生成冲突，请稍后重试。");
}

export async function createSample(supabase: SupabaseClient<Database>, bodyValue: unknown) {
  const { payload, taskIds } = buildSamplePayload(bodyValue);
  const targetTaskIds = taskIds ?? [];
  const projectId = payload.project_id as number;
  await validateProject(supabase, projectId);
  await requireTaskManageForLinks(supabase, taskIds);
  await validateTaskReferences(supabase, projectId, targetTaskIds);

  const data = await insertSampleWithUniqueCode(supabase, payload);
  try {
    await replaceSampleTasks(supabase, data.id, targetTaskIds);
    await recordAudit(supabase, "sample.manage", "sample", String(data.id), "CREATE", null, { ...(data as unknown as Record<string, unknown>), task_ids: targetTaskIds } as Json);
  } catch (error) {
    await supabase.from("task_sample").delete().eq("sample_id", data.id);
    await supabase.from("sample").delete().eq("id", data.id);
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(500, "SAMPLE_CREATE_ROLLBACK", "样品登记失败，已回滚本次写入。");
  }
  return loadSampleDetail(supabase, String(data.id));
}

export async function updateSample(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const id = requireId(idValue);
  const { payload, taskIds } = buildSamplePayload(bodyValue, true);
  const { data: before, error: beforeError } = await supabase.from("sample").select(SAMPLE_FIELDS).eq("id", id).maybeSingle();
  if (beforeError) throw new AdminApiError(500, "SAMPLE_LOOKUP_FAILED", "无法读取样品。");
  if (!before) throw new AdminApiError(404, "SAMPLE_NOT_FOUND", "样品不存在。");
  const beforeRow = before as unknown as SampleRow;
  const targetProjectId = (payload.project_id as number | undefined) ?? beforeRow.project_id;
  await validateProject(supabase, targetProjectId);

  const currentViews = await buildSampleViews(supabase, [beforeRow]);
  const currentTaskIds = currentViews[0]?.tasks.map((task) => task.id) ?? [];
  if (payload.project_id !== undefined && taskIds === undefined && currentTaskIds.length > 0) {
    throw new AdminApiError(400, "TASK_ASSOCIATIONS_REQUIRED", "修改样品所属项目时必须同时提供 taskIds。");
  }
  const targetTaskIds = taskIds ?? (payload.project_id === undefined ? currentTaskIds : []);
  await requireTaskManageForLinks(supabase, taskIds);
  if (payload.project_id !== undefined && currentTaskIds.length > 0) await requireTaskManageForLinks(supabase, targetTaskIds);
  await validateTaskReferences(supabase, targetProjectId, targetTaskIds);

  let after = before;
  if (Object.keys(payload).length > 0) {
    const { data: updated, error } = await supabase
      .from("sample")
      .update(payload as Database["public"]["Tables"]["sample"]["Update"])
      .eq("id", id)
      .select(SAMPLE_FIELDS)
      .single();
    if (error || !updated) {
      if (error?.code === "23505") throw new AdminApiError(409, "SAMPLE_CODE_EXISTS", "样品编号已经存在。");
      throw new AdminApiError(400, "SAMPLE_UPDATE_FAILED", "样品修改失败。");
    }
    after = updated;
  }

  try {
    if (taskIds !== undefined || payload.project_id !== undefined) await replaceSampleTasks(supabase, id, targetTaskIds);
    await recordAudit(supabase, "sample.manage", "sample", String(id), "UPDATE", before as unknown as Json, { ...(after as unknown as Record<string, unknown>), task_ids: targetTaskIds } as Json);
  } catch (error) {
    await supabase.from("sample").update({
      sample_code: beforeRow.sample_code,
      project_id: beforeRow.project_id,
      name: beforeRow.name,
      specification: beforeRow.specification,
      batch_no: beforeRow.batch_no,
      quantity: beforeRow.quantity,
      unit: beforeRow.unit,
      source: beforeRow.source,
      storage_condition: beforeRow.storage_condition,
    }).eq("id", id);
    await replaceSampleTasks(supabase, id, currentTaskIds);
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(500, "SAMPLE_UPDATE_ROLLBACK", "样品修改失败，已回滚本次写入。");
  }
  return loadSampleDetail(supabase, String(id));
}

export function parseSampleFilterStatus(value: string | null) {
  return parseSampleStatus(value ?? undefined) ?? null;
}
