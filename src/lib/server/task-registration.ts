import type { SupabaseClient } from "@supabase/supabase-js";

import { hasPermission } from "@/lib/auth/permissions";
import {
  AdminApiError,
  recordAudit,
  requireId,
  requireObject,
  requireText,
  requireUuid,
  optionalText,
} from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

export const PROJECT_FIELDS = "id, project_code, name, owner_id, description, status, start_date, end_date, created_at, updated_at";
export const TASK_FIELDS = "id, task_code, project_id, method_id, name, priority, status, planned_start, planned_end, remark, created_at, updated_at";

type ProjectRow = Database["public"]["Tables"]["research_project"]["Row"];
type TaskRow = Database["public"]["Tables"]["experiment_task"]["Row"];
export type ProjectView = {
  id: number;
  projectCode: string;
  name: string;
  ownerId: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskView = {
  id: number;
  taskCode: string;
  projectId: number;
  methodId: number;
  name: string;
  priority: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  remark: string | null;
  sampleIds: number[];
  project: { id: number; projectCode: string; name: string; status: string } | null;
  method: { id: number; methodCode: string; name: string; version: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
};

function parseDate(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminApiError(400, "INVALID_DATE", `${field} 必须是 YYYY-MM-DD 日期。`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AdminApiError(400, "INVALID_DATE", `${field} 不是有效日期。`);
  }
  return value;
}

function validateDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (start && end && end < start) throw new AdminApiError(400, "INVALID_DATE_RANGE", "结束日期不能早于开始日期。");
}

function parseProjectStatus(value: unknown, update = false) {
  if (value === undefined) return undefined;
  const allowed = update ? ["DRAFT", "ACTIVE", "ARCHIVED"] : ["DRAFT", "ACTIVE"];
  if (!allowed.includes(String(value))) throw new AdminApiError(400, "INVALID_PROJECT_STATUS", "项目状态不受支持。");
  return String(value);
}

function parsePriority(value: unknown) {
  if (!["LOW", "NORMAL", "HIGH"].includes(String(value))) throw new AdminApiError(400, "INVALID_PRIORITY", "任务优先级不受支持。");
  return String(value);
}

function parseIdList(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new AdminApiError(400, "INVALID_FIELD", `${field} 必须是数字 ID 数组。`);
  const ids = value.map((item) => {
    try {
      return requireId(String(item));
    } catch {
      throw new AdminApiError(400, "INVALID_FIELD", `${field} 包含无效 ID。`);
    }
  });
  return [...new Set(ids)];
}

export function buildProjectPayload(bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  const payload: Record<string, unknown> = {};
  if (!update || body.projectCode !== undefined) payload.project_code = requireText(body.projectCode, "projectCode", 32);
  if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
  if (body.ownerId !== undefined) {
    if (body.ownerId === null) throw new AdminApiError(400, "INVALID_OWNER", "项目负责人不能为空。");
    payload.owner_id = requireUuid(String(body.ownerId));
  }
  if (body.description !== undefined) payload.description = body.description === null ? null : optionalText(body.description, "description", 4000);
  const status = parseProjectStatus(body.status, update);
  if (status !== undefined) payload.status = status;
  if (body.startDate !== undefined) payload.start_date = parseDate(body.startDate, "startDate");
  if (body.endDate !== undefined) payload.end_date = parseDate(body.endDate, "endDate");
  validateDateRange(payload.start_date as string | null | undefined, payload.end_date as string | null | undefined);
  if (Object.keys(payload).length === 0) throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的项目字段。");
  return payload;
}

export function buildTaskPayload(bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  if (body.status !== undefined) throw new AdminApiError(403, "TASK_STATUS_DEFERRED", "任务状态必须通过 T-205 状态机修改。");
  const payload: Record<string, unknown> = {};
  if (!update || body.taskCode !== undefined) payload.task_code = requireText(body.taskCode, "taskCode", 32);
  if (!update || body.projectId !== undefined) payload.project_id = requireId(String(body.projectId));
  if (!update || body.methodId !== undefined) payload.method_id = requireId(String(body.methodId));
  if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
  if (!update || body.priority !== undefined) payload.priority = parsePriority(body.priority);
  if (body.plannedStart !== undefined) payload.planned_start = parseDate(body.plannedStart, "plannedStart");
  if (body.plannedEnd !== undefined) payload.planned_end = parseDate(body.plannedEnd, "plannedEnd");
  if (body.remark !== undefined) payload.remark = body.remark === null ? null : optionalText(body.remark, "remark", 4000);
  validateDateRange(payload.planned_start as string | null | undefined, payload.planned_end as string | null | undefined);
  const sampleIds = body.sampleIds === undefined ? undefined : parseIdList(body.sampleIds, "sampleIds");
  if (Object.keys(payload).length === 0 && sampleIds === undefined) throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的任务字段。");
  return { payload, sampleIds };
}

function serializeProject(row: ProjectRow, taskCount: number): ProjectView {
  return {
    id: row.id,
    projectCode: row.project_code,
    name: row.name,
    ownerId: row.owner_id,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    taskCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeTask(row: TaskRow, sampleIds: number[], project: TaskView["project"], method: TaskView["method"]): TaskView {
  return {
    id: row.id,
    taskCode: row.task_code,
    projectId: row.project_id,
    methodId: row.method_id,
    name: row.name,
    priority: row.priority,
    status: row.status,
    plannedStart: row.planned_start,
    plannedEnd: row.planned_end,
    remark: row.remark,
    sampleIds,
    project,
    method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadTaskCounts(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("experiment_task").select("id, project_id");
  if (error) throw new AdminApiError(500, "TASK_COUNT_LOOKUP_FAILED", "无法读取项目任务数量。");
  const counts = new Map<number, number>();
  for (const item of data ?? []) counts.set(item.project_id, (counts.get(item.project_id) ?? 0) + 1);
  return counts;
}

export async function loadProjects(supabase: SupabaseClient<Database>, filters: { keyword?: string | null; status?: string | null; ownerId?: string | null } = {}) {
  let query = supabase.from("research_project").select(PROJECT_FIELDS).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "PROJECT_LOOKUP_FAILED", "无法读取科研项目。");
  const keyword = filters.keyword?.toLowerCase() || "";
  const rows = ((data ?? []) as unknown as ProjectRow[]).filter((row) => !keyword || `${row.project_code} ${row.name} ${row.description ?? ""}`.toLowerCase().includes(keyword));
  const counts = await loadTaskCounts(supabase);
  return rows.map((row) => serializeProject(row, counts.get(row.id) ?? 0));
}

export async function loadProjectDetail(supabase: SupabaseClient<Database>, idValue: string) {
  const id = requireId(idValue);
  const { data, error } = await supabase.from("research_project").select(PROJECT_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new AdminApiError(500, "PROJECT_LOOKUP_FAILED", "无法读取科研项目。");
  if (!data) throw new AdminApiError(404, "PROJECT_NOT_FOUND", "科研项目不存在。");
  const counts = await loadTaskCounts(supabase);
  return serializeProject(data as unknown as ProjectRow, counts.get(id) ?? 0);
}

async function validateOwner(supabase: SupabaseClient<Database>, ownerId: string, operatorId: string) {
  if (ownerId === operatorId) return;
  if (!(await hasPermission(supabase, "resource.read"))) throw new AdminApiError(403, "OWNER_SCOPE_FORBIDDEN", "只能将项目负责人设置为当前用户。");
  const { data, error } = await supabase.from("sys_user").select("id, status").eq("id", ownerId).maybeSingle();
  if (error || !data || data.status !== "ACTIVE") throw new AdminApiError(400, "INVALID_OWNER", "项目负责人不存在或已停用。");
}

export async function createProject(supabase: SupabaseClient<Database>, operatorId: string, bodyValue: unknown) {
  const body = requireObject(bodyValue);
  const payload = buildProjectPayload(body);
  const ownerId = String(payload.owner_id ?? operatorId);
  await validateOwner(supabase, ownerId, operatorId);
  payload.owner_id = ownerId;
  const { data, error } = await supabase.from("research_project").insert(payload as Database["public"]["Tables"]["research_project"]["Insert"]).select(PROJECT_FIELDS).single();
  if (error || !data) {
    if (error?.code === "23505") throw new AdminApiError(409, "PROJECT_CODE_EXISTS", "项目编号已经存在。");
    throw new AdminApiError(400, "PROJECT_CREATE_FAILED", "科研项目创建失败。");
  }
  await recordAudit(supabase, "project.manage", "research_project", String(data.id), "CREATE", null, data as unknown as Json);
  return serializeProject(data as unknown as ProjectRow, 0);
}

export async function updateProject(supabase: SupabaseClient<Database>, operatorId: string, idValue: string, bodyValue: unknown) {
  const id = requireId(idValue);
  const payload = buildProjectPayload(bodyValue, true);
  if (payload.owner_id) await validateOwner(supabase, String(payload.owner_id), operatorId);
  const { data: before, error: beforeError } = await supabase.from("research_project").select(PROJECT_FIELDS).eq("id", id).maybeSingle();
  if (beforeError) throw new AdminApiError(500, "PROJECT_LOOKUP_FAILED", "无法读取科研项目。");
  if (!before) throw new AdminApiError(404, "PROJECT_NOT_FOUND", "科研项目不存在。");
  const { data: after, error } = await supabase.from("research_project").update(payload as Database["public"]["Tables"]["research_project"]["Update"]).eq("id", id).select(PROJECT_FIELDS).single();
  if (error || !after) {
    if (error?.code === "23505") throw new AdminApiError(409, "PROJECT_CODE_EXISTS", "项目编号已经存在。");
    throw new AdminApiError(400, "PROJECT_UPDATE_FAILED", "科研项目更新失败。");
  }
  await recordAudit(supabase, "project.manage", "research_project", String(id), "UPDATE", before as unknown as Json, after as unknown as Json);
  return loadProjectDetail(supabase, String(id));
}

async function loadTaskSamples(supabase: SupabaseClient<Database>, taskIds: number[]) {
  if (taskIds.length === 0) return new Map<number, number[]>();
  const { data, error } = await supabase.from("task_sample").select("task_id, sample_id").in("task_id", taskIds);
  if (error) throw new AdminApiError(500, "TASK_SAMPLE_LOOKUP_FAILED", "无法读取任务样品关联。");
  const map = new Map<number, number[]>();
  for (const item of data ?? []) map.set(item.task_id, [...(map.get(item.task_id) ?? []), item.sample_id]);
  return map;
}

async function loadTaskReferences(supabase: SupabaseClient<Database>, rows: TaskRow[]) {
  const projectIds = [...new Set(rows.map((row) => row.project_id))];
  const methodIds = [...new Set(rows.map((row) => row.method_id))];
  const [{ data: projects, error: projectError }, { data: methods, error: methodError }] = await Promise.all([
    supabase.from("research_project").select("id, project_code, name, status").in("id", projectIds),
    supabase.from("experiment_method").select("id, method_code, name, version, status").in("id", methodIds),
  ]);
  if (projectError || methodError) throw new AdminApiError(500, "TASK_REFERENCE_LOOKUP_FAILED", "无法读取任务引用对象。");
  return {
    projects: new Map((projects ?? []).map((item) => [item.id, item])),
    methods: new Map((methods ?? []).map((item) => [item.id, item])),
  };
}

async function buildTaskViews(supabase: SupabaseClient<Database>, rows: TaskRow[]) {
  const [samples, references] = await Promise.all([loadTaskSamples(supabase, rows.map((row) => row.id)), loadTaskReferences(supabase, rows)]);
  return rows.map((row) => {
    const project = references.projects.get(row.project_id);
    const method = references.methods.get(row.method_id);
    return serializeTask(
      row,
      samples.get(row.id) ?? [],
      project ? { id: project.id, projectCode: project.project_code, name: project.name, status: project.status } : null,
      method ? { id: method.id, methodCode: method.method_code, name: method.name, version: method.version, status: method.status } : null,
    );
  });
}

export async function loadTasks(supabase: SupabaseClient<Database>, filters: { keyword?: string | null; projectId?: number | null; status?: string | null; priority?: string | null } = {}) {
  let query = supabase.from("experiment_task").select(TASK_FIELDS).order("created_at", { ascending: false });
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "TASK_LOOKUP_FAILED", "无法读取实验任务。");
  const keyword = filters.keyword?.toLowerCase() || "";
  const rows = ((data ?? []) as unknown as TaskRow[]).filter((row) => !keyword || `${row.task_code} ${row.name} ${row.remark ?? ""}`.toLowerCase().includes(keyword));
  return buildTaskViews(supabase, rows);
}

export async function loadTaskDetail(supabase: SupabaseClient<Database>, idValue: string) {
  const id = requireId(idValue);
  const { data, error } = await supabase.from("experiment_task").select(TASK_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new AdminApiError(500, "TASK_LOOKUP_FAILED", "无法读取实验任务。");
  if (!data) throw new AdminApiError(404, "TASK_NOT_FOUND", "实验任务不存在。");
  const views = await buildTaskViews(supabase, [data as unknown as TaskRow]);
  return views[0];
}

async function validateTaskReferences(supabase: SupabaseClient<Database>, projectId: number, methodId: number, sampleIds: number[]) {
  const { data: project, error: projectError } = await supabase.from("research_project").select("id, status").eq("id", projectId).maybeSingle();
  if (projectError || !project) throw new AdminApiError(400, "INVALID_PROJECT", "任务引用的项目不存在。");
  if (project.status === "ARCHIVED") throw new AdminApiError(400, "PROJECT_ARCHIVED", "归档项目不能创建或修改任务。");
  const { data: method, error: methodError } = await supabase.from("experiment_method").select("id, status").eq("id", methodId).maybeSingle();
  if (methodError || !method || method.status !== "ACTIVE") throw new AdminApiError(400, "INVALID_METHOD", "任务必须引用有效的 ACTIVE 方法版本。");
  if (sampleIds.length === 0) return;
  const { data: samples, error: sampleError } = await supabase.from("sample").select("id, project_id, status").in("id", sampleIds);
  if (sampleError || !samples || samples.length !== sampleIds.length) throw new AdminApiError(400, "INVALID_SAMPLE", "任务引用的样品不存在或不可见。");
  if (samples.some((sample) => sample.project_id !== projectId || ["ARCHIVED", "DISPOSED"].includes(sample.status))) {
    throw new AdminApiError(400, "INVALID_SAMPLE_SCOPE", "任务样品必须属于同一项目且未归档/处置。");
  }
}

async function replaceTaskSamples(supabase: SupabaseClient<Database>, taskId: number, sampleIds: number[]) {
  const { error: deleteError } = await supabase.from("task_sample").delete().eq("task_id", taskId);
  if (deleteError) throw deleteError;
  if (sampleIds.length === 0) return;
  const { error } = await supabase.from("task_sample").insert(sampleIds.map((sampleId) => ({ task_id: taskId, sample_id: sampleId })));
  if (error) throw error;
}

export async function createTask(supabase: SupabaseClient<Database>, bodyValue: unknown) {
  const { payload, sampleIds = [] } = buildTaskPayload(bodyValue);
  await validateTaskReferences(supabase, payload.project_id as number, payload.method_id as number, sampleIds);
  const { data, error } = await supabase.from("experiment_task").insert({ ...payload, status: "DRAFT" } as Database["public"]["Tables"]["experiment_task"]["Insert"]).select(TASK_FIELDS).single();
  if (error || !data) {
    if (error?.code === "23505") throw new AdminApiError(409, "TASK_CODE_EXISTS", "任务编号已经存在。");
    throw new AdminApiError(400, "TASK_CREATE_FAILED", "实验任务创建失败。");
  }
  try {
    await replaceTaskSamples(supabase, data.id, sampleIds);
  } catch (associationError) {
    await supabase.from("experiment_task").delete().eq("id", data.id);
    throw new AdminApiError(400, "TASK_SAMPLE_WRITE_FAILED", associationError instanceof Error ? associationError.message : "任务样品关联写入失败。");
  }
  await recordAudit(supabase, "task.manage", "experiment_task", String(data.id), "CREATE", null, { ...(data as unknown as Record<string, unknown>), sample_ids: sampleIds } as Json);
  return loadTaskDetail(supabase, String(data.id));
}

export async function updateTask(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const id = requireId(idValue);
  const { payload, sampleIds } = buildTaskPayload(bodyValue, true);
  const { data: before, error: beforeError } = await supabase.from("experiment_task").select(TASK_FIELDS).eq("id", id).maybeSingle();
  if (beforeError) throw new AdminApiError(500, "TASK_LOOKUP_FAILED", "无法读取实验任务。");
  if (!before) throw new AdminApiError(404, "TASK_NOT_FOUND", "实验任务不存在。");
  const targetProjectId = (payload.project_id as number | undefined) ?? before.project_id;
  const targetMethodId = (payload.method_id as number | undefined) ?? before.method_id;
  const currentSamples = await loadTaskSamples(supabase, [id]);
  const targetSamples = sampleIds ?? currentSamples.get(id) ?? [];
  await validateTaskReferences(supabase, targetProjectId, targetMethodId, targetSamples);
  const { data: after, error } = await supabase.from("experiment_task").update(payload as Database["public"]["Tables"]["experiment_task"]["Update"]).eq("id", id).select(TASK_FIELDS).single();
  if (error || !after) {
    if (error?.code === "23505") throw new AdminApiError(409, "TASK_CODE_EXISTS", "任务编号已经存在。");
    throw new AdminApiError(400, "TASK_UPDATE_FAILED", "实验任务更新失败。");
  }
  try {
    if (sampleIds !== undefined || payload.project_id !== undefined) await replaceTaskSamples(supabase, id, targetSamples);
  } catch (associationError) {
    await supabase.from("experiment_task").update({
      task_code: before.task_code,
      project_id: before.project_id,
      method_id: before.method_id,
      name: before.name,
      priority: before.priority,
      planned_start: before.planned_start,
      planned_end: before.planned_end,
      remark: before.remark,
    }).eq("id", id);
    throw new AdminApiError(400, "TASK_SAMPLE_WRITE_FAILED", associationError instanceof Error ? associationError.message : "任务样品关联写入失败。");
  }
  await recordAudit(supabase, "task.manage", "experiment_task", String(id), "UPDATE", before as unknown as Json, { ...(after as unknown as Record<string, unknown>), sample_ids: targetSamples } as Json);
  return loadTaskDetail(supabase, String(id));
}
