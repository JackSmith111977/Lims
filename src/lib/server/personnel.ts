import type { SupabaseClient } from "@supabase/supabase-js";

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

export const PERSONNEL_FIELDS = "id, username, real_name, department_id, position_id, status, availability_status, availability_note, availability_until, email, last_login_at, created_at, updated_at";

export const PERSONNEL_RECORD_TYPES = ["skills", "qualifications", "training"] as const;
export type PersonnelRecordType = (typeof PERSONNEL_RECORD_TYPES)[number];

const RECORD_CONFIG: Record<PersonnelRecordType, { table: keyof Database["public"]["Tables"]; fields: string; objectType: string }> = {
  skills: {
    table: "sys_user_skill",
    fields: "id, user_id, skill_name, level, verified_at, expires_at, notes, created_at, updated_at",
    objectType: "sys_user_skill",
  },
  qualifications: {
    table: "sys_user_qualification",
    fields: "id, user_id, qualification_name, certificate_no, status, issued_at, expires_at, notes, created_at, updated_at",
    objectType: "sys_user_qualification",
  },
  training: {
    table: "sys_user_training",
    fields: "id, user_id, training_name, provider, completed_at, expires_at, result, notes, created_at, updated_at",
    objectType: "sys_user_training",
  },
};

type PersonnelDbError = { code?: string; message: string };
type PersonnelDbResult = { data: unknown; error: PersonnelDbError | null };
type PersonnelQuery = PromiseLike<PersonnelDbResult> & {
  select(columns?: string): PersonnelQuery;
  order(column: string, options?: { ascending?: boolean }): PersonnelQuery;
  eq(column: string, value: unknown): PersonnelQuery;
  in(column: string, values: unknown[]): PersonnelQuery;
  is(column: string, value: null): PersonnelQuery;
  insert(values: unknown): PersonnelQuery;
  update(values: unknown): PersonnelQuery;
  delete(): PersonnelQuery;
  single(): Promise<PersonnelDbResult>;
  maybeSingle(): Promise<PersonnelDbResult>;
};

type UserRow = Database["public"]["Tables"]["sys_user"]["Row"];
type PositionRow = Database["public"]["Tables"]["sys_position"]["Row"];
type RecordRow = Record<string, unknown>;

export type PersonnelAlert = {
  code: string;
  message: string;
  severity: "WARNING" | "BLOCKING";
};

export type PersonnelTaskSummary = {
  total: number;
  byStatus: Record<string, number>;
  tasks: Array<{
    id: number;
    taskCode: string;
    name: string;
    status: string;
    assignedAt: string;
    plannedEnd: string | null;
  }>;
};

export type PersonnelView = {
  id: string;
  username: string;
  realName: string;
  departmentId: number | null;
  positionId: number | null;
  position: { id: number; code: string; name: string; status: string } | null;
  status: string;
  availabilityStatus: string;
  availabilityNote: string | null;
  availabilityUntil: string | null;
  email: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskSummary: PersonnelTaskSummary;
  alerts: PersonnelAlert[];
  skills: Record<string, unknown>[];
  qualifications: Record<string, unknown>[];
  training: Record<string, unknown>[];
};

function personnelQuery(
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
) {
  return supabase.from(table) as unknown as PersonnelQuery;
}

export function getPersonnelRecordConfig(recordType: string) {
  if (!PERSONNEL_RECORD_TYPES.includes(recordType as PersonnelRecordType)) {
    throw new AdminApiError(404, "PERSONNEL_RECORD_TYPE_NOT_FOUND", "人员能力记录类型不存在。");
  }
  const typedRecordType = recordType as PersonnelRecordType;
  return { recordType: typedRecordType, ...RECORD_CONFIG[typedRecordType] };
}

function parseOptionalId(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  try {
    return requireId(String(value));
  } catch {
    throw new AdminApiError(400, "INVALID_FIELD", `${field} 格式不正确。`);
  }
}

function parseNullableText(value: unknown, field: string, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return optionalText(value, field, maxLength);
}

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

function validateDateOrder(start: string | null | undefined, end: string | null | undefined, field: string) {
  if (start && end && end < start) {
    throw new AdminApiError(400, "INVALID_DATE_RANGE", `${field} 不能早于开始日期。`);
  }
}

export function parseAvailabilityStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (!["AVAILABLE", "ON_LEAVE", "QUALIFICATION_SUSPENDED", "UNAVAILABLE"].includes(String(value))) {
    throw new AdminApiError(400, "INVALID_AVAILABILITY_STATUS", "availabilityStatus 不受支持。");
  }
  return String(value);
}

function parseQualificationStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (!["ACTIVE", "SUSPENDED", "EXPIRED"].includes(String(value))) {
    throw new AdminApiError(400, "INVALID_QUALIFICATION_STATUS", "资质状态不受支持。");
  }
  return String(value);
}

export function buildPersonnelUpdate(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  if (body.status !== undefined) {
    throw new AdminApiError(403, "PERSONNEL_ACCOUNT_STATUS_FORBIDDEN", "人员档案不能修改账户登录状态。请使用用户管理功能。");
  }

  const update: Database["public"]["Tables"]["sys_user"]["Update"] = {};
  const realName = optionalText(body.realName, "realName", 64);
  const departmentId = parseOptionalId(body.departmentId, "departmentId");
  const positionId = parseOptionalId(body.positionId, "positionId");
  const availabilityStatus = parseAvailabilityStatus(body.availabilityStatus);
  const availabilityNote = parseNullableText(body.availabilityNote, "availabilityNote", 255);
  const availabilityUntil = parseDate(body.availabilityUntil, "availabilityUntil");

  if (realName !== undefined) update.real_name = realName;
  if (departmentId !== undefined) update.department_id = departmentId;
  if (positionId !== undefined) update.position_id = positionId;
  if (availabilityStatus !== undefined) update.availability_status = availabilityStatus;
  if (availabilityNote !== undefined) update.availability_note = availabilityNote;
  if (availabilityUntil !== undefined) update.availability_until = availabilityUntil;

  if (Object.keys(update).length === 0) {
    throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的人员档案字段。");
  }
  return update;
}

export function buildPersonnelRecordPayload(recordType: PersonnelRecordType, bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  const payload: Record<string, unknown> = {};

  if (recordType === "skills") {
    if (!update || body.skillName !== undefined) payload.skill_name = requireText(body.skillName, "skillName", 128);
    if (body.level !== undefined) payload.level = parseNullableText(body.level, "level", 32);
    if (body.verifiedAt !== undefined) payload.verified_at = parseDate(body.verifiedAt, "verifiedAt");
    if (body.expiresAt !== undefined) payload.expires_at = parseDate(body.expiresAt, "expiresAt");
    if (body.notes !== undefined) payload.notes = parseNullableText(body.notes, "notes", 2000);
    validateDateOrder(payload.verified_at as string | null | undefined, payload.expires_at as string | null | undefined, "技能失效日期");
  } else if (recordType === "qualifications") {
    if (!update || body.qualificationName !== undefined) payload.qualification_name = requireText(body.qualificationName, "qualificationName", 128);
    if (body.certificateNo !== undefined) payload.certificate_no = parseNullableText(body.certificateNo, "certificateNo", 64);
    const status = parseQualificationStatus(body.status);
    if (status !== undefined) payload.status = status;
    if (body.issuedAt !== undefined) payload.issued_at = parseDate(body.issuedAt, "issuedAt");
    if (body.expiresAt !== undefined) payload.expires_at = parseDate(body.expiresAt, "expiresAt");
    if (body.notes !== undefined) payload.notes = parseNullableText(body.notes, "notes", 2000);
    validateDateOrder(payload.issued_at as string | null | undefined, payload.expires_at as string | null | undefined, "资质失效日期");
  } else {
    if (!update || body.trainingName !== undefined) payload.training_name = requireText(body.trainingName, "trainingName", 128);
    if (body.provider !== undefined) payload.provider = parseNullableText(body.provider, "provider", 128);
    if (body.completedAt !== undefined) payload.completed_at = parseDate(body.completedAt, "completedAt");
    if (body.expiresAt !== undefined) payload.expires_at = parseDate(body.expiresAt, "expiresAt");
    if (body.result !== undefined) payload.result = parseNullableText(body.result, "result", 32);
    if (body.notes !== undefined) payload.notes = parseNullableText(body.notes, "notes", 2000);
    validateDateOrder(payload.completed_at as string | null | undefined, payload.expires_at as string | null | undefined, "培训失效日期");
  }

  if (Object.keys(payload).length === 0) {
    throw new AdminApiError(400, "EMPTY_UPDATE", "没有可更新的能力记录字段。");
  }
  return payload;
}

function serializeRecord(recordType: PersonnelRecordType, row: RecordRow) {
  const base = {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (recordType === "skills") {
    return { ...base, skillName: row.skill_name, level: row.level, verifiedAt: row.verified_at, expiresAt: row.expires_at, notes: row.notes };
  }
  if (recordType === "qualifications") {
    return { ...base, qualificationName: row.qualification_name, certificateNo: row.certificate_no, status: row.status, issuedAt: row.issued_at, expiresAt: row.expires_at, notes: row.notes };
  }
  return { ...base, trainingName: row.training_name, provider: row.provider, completedAt: row.completed_at, expiresAt: row.expires_at, result: row.result, notes: row.notes };
}

async function loadRecords(supabase: SupabaseClient<Database>, recordType: PersonnelRecordType, userIds: string[]) {
  if (userIds.length === 0) return [] as RecordRow[];
  const { table, fields } = RECORD_CONFIG[recordType];
  const { data, error } = await personnelQuery(supabase, table).select(fields).in("user_id", userIds).order("created_at", { ascending: false });
  if (error) throw new AdminApiError(500, "PERSONNEL_RECORD_LOOKUP_FAILED", "无法读取人员能力记录。");
  return (Array.isArray(data) ? data : []) as RecordRow[];
}

async function loadTaskSummaries(supabase: SupabaseClient<Database>, userIds: string[]) {
  const result = new Map<string, PersonnelTaskSummary>();
  for (const userId of userIds) result.set(userId, { total: 0, byStatus: {}, tasks: [] });
  if (userIds.length === 0) return result;

  const { data: assignments, error: assignmentError } = await supabase
    .from("task_assignee")
    .select("user_id, task_id, assigned_at")
    .in("user_id", userIds)
    .is("unassigned_at", null);
  if (assignmentError) throw new AdminApiError(500, "PERSONNEL_TASK_LOOKUP_FAILED", "无法读取人员任务状态。");

  const taskIds = [...new Set((assignments ?? []).map((item) => item.task_id))];
  if (taskIds.length === 0) return result;
  const { data: tasks, error: taskError } = await supabase
    .from("experiment_task")
    .select("id, task_code, name, status, planned_end")
    .in("id", taskIds);
  if (taskError) throw new AdminApiError(500, "PERSONNEL_TASK_LOOKUP_FAILED", "无法读取人员任务状态。");

  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));
  const seen = new Set<string>();
  for (const assignment of assignments ?? []) {
    const task = taskById.get(assignment.task_id);
    if (!task) continue;
    const key = `${assignment.user_id}:${task.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const summary = result.get(assignment.user_id);
    if (!summary) continue;
    summary.total += 1;
    summary.byStatus[task.status] = (summary.byStatus[task.status] ?? 0) + 1;
    summary.tasks.push({
      id: task.id,
      taskCode: task.task_code,
      name: task.name,
      status: task.status,
      assignedAt: assignment.assigned_at,
      plannedEnd: task.planned_end,
    });
  }
  return result;
}

function dateDistanceInDays(value: string) {
  const today = new Date();
  const target = new Date(`${value}T00:00:00Z`);
  return Math.ceil((target.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000);
}

function buildAlerts(row: UserRow, qualifications: RecordRow[], training: RecordRow[]) {
  const alerts: PersonnelAlert[] = [];
  if (row.status !== "ACTIVE") alerts.push({ code: "ACCOUNT_INACTIVE", message: "账户已停用，不能登录系统。", severity: "BLOCKING" });
  if (row.availability_status !== "AVAILABLE") {
    const messages: Record<string, string> = {
      ON_LEAVE: "人员当前处于离岗状态。",
      QUALIFICATION_SUSPENDED: "人员资格已暂停，分配任务前需要复核。",
      UNAVAILABLE: "人员当前不可用。",
    };
    alerts.push({ code: row.availability_status, message: messages[row.availability_status] ?? "人员当前不可用。", severity: "BLOCKING" });
  }
  if (row.availability_until) {
    const days = dateDistanceInDays(row.availability_until);
    if (days <= 7) alerts.push({ code: "AVAILABILITY_DUE", message: days < 0 ? "人员可用状态恢复日期已过期。" : "人员可用状态即将到期，请复核。", severity: days < 0 ? "BLOCKING" : "WARNING" });
  }
  for (const qualification of qualifications) {
    if (qualification.status === "SUSPENDED") alerts.push({ code: "QUALIFICATION_SUSPENDED_RECORD", message: `资质“${String(qualification.qualification_name)}”已暂停。`, severity: "BLOCKING" });
    if (qualification.status === "EXPIRED") alerts.push({ code: "QUALIFICATION_EXPIRED", message: `资质“${String(qualification.qualification_name)}”已失效。`, severity: "WARNING" });
    if (typeof qualification.expires_at === "string" && dateDistanceInDays(qualification.expires_at) <= 30) alerts.push({ code: "QUALIFICATION_DUE", message: `资质“${String(qualification.qualification_name)}”即将到期。`, severity: "WARNING" });
  }
  for (const record of training) {
    if (typeof record.expires_at === "string" && dateDistanceInDays(record.expires_at) <= 30) alerts.push({ code: "TRAINING_DUE", message: `培训“${String(record.training_name)}”即将到期。`, severity: "WARNING" });
  }
  return alerts;
}

function serializePersonnel(
  row: UserRow,
  position: PositionRow | null,
  taskSummary: PersonnelTaskSummary,
  skills: RecordRow[],
  qualifications: RecordRow[],
  training: RecordRow[],
): PersonnelView {
  return {
    id: row.id,
    username: row.username,
    realName: row.real_name,
    departmentId: row.department_id,
    positionId: row.position_id,
    position: position ? { id: position.id, code: position.code, name: position.name, status: position.status } : null,
    status: row.status,
    availabilityStatus: row.availability_status,
    availabilityNote: row.availability_note,
    availabilityUntil: row.availability_until,
    email: row.email,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskSummary,
    alerts: buildAlerts(row, qualifications, training),
    skills: skills.map((item) => serializeRecord("skills", item)),
    qualifications: qualifications.map((item) => serializeRecord("qualifications", item)),
    training: training.map((item) => serializeRecord("training", item)),
  };
}

async function loadPositions(supabase: SupabaseClient<Database>, positionIds: number[]) {
  if (positionIds.length === 0) return new Map<number, PositionRow>();
  const { data, error } = await supabase.from("sys_position").select("id, code, name, description, status, created_at, updated_at").in("id", positionIds);
  if (error) throw new AdminApiError(500, "PERSONNEL_POSITION_LOOKUP_FAILED", "无法读取人员岗位。");
  return new Map((data ?? []).map((position) => [position.id, position]));
}

async function loadPersonnelRows(supabase: SupabaseClient<Database>, userIds?: string[]) {
  let query = supabase.from("sys_user").select(PERSONNEL_FIELDS).order("created_at", { ascending: false });
  if (userIds?.length === 1) query = query.eq("id", userIds[0]);
  if (userIds && userIds.length > 1) query = query.in("id", userIds);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "PERSONNEL_LOOKUP_FAILED", "无法读取人员档案。");
  return (data ?? []) as UserRow[];
}

export async function loadPersonnelList(
  supabase: SupabaseClient<Database>,
  filters: { keyword?: string | null; availabilityStatus?: string | null; departmentId?: number | null; positionId?: number | null } = {},
) {
  let query = supabase.from("sys_user").select(PERSONNEL_FIELDS).order("created_at", { ascending: false });
  if (filters.availabilityStatus) query = query.eq("availability_status", filters.availabilityStatus);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.positionId) query = query.eq("position_id", filters.positionId);
  const { data, error } = await query;
  if (error) throw new AdminApiError(500, "PERSONNEL_LOOKUP_FAILED", "无法读取人员档案。");
  const rows = ((data ?? []) as unknown as UserRow[]).filter((row) => {
    if (!filters.keyword) return true;
    const keyword = filters.keyword.toLowerCase();
    return [row.username, row.real_name, row.email].filter(Boolean).some((value) => value!.toLowerCase().includes(keyword));
  });
  return buildPersonnelViews(supabase, rows);
}

async function buildPersonnelViews(supabase: SupabaseClient<Database>, rows: UserRow[]) {
  const userIds = rows.map((row) => row.id);
  const positionIds = [...new Set(rows.map((row) => row.position_id).filter((id): id is number => id !== null))];
  const [positions, skills, qualifications, training, taskSummaries] = await Promise.all([
    loadPositions(supabase, positionIds),
    loadRecords(supabase, "skills", userIds),
    loadRecords(supabase, "qualifications", userIds),
    loadRecords(supabase, "training", userIds),
    loadTaskSummaries(supabase, userIds),
  ]);
  return rows.map((row) => serializePersonnel(
    row,
    row.position_id ? positions.get(row.position_id) ?? null : null,
    taskSummaries.get(row.id) ?? { total: 0, byStatus: {}, tasks: [] },
    skills.filter((item) => item.user_id === row.id),
    qualifications.filter((item) => item.user_id === row.id),
    training.filter((item) => item.user_id === row.id),
  ));
}

export async function loadPersonnelDetail(supabase: SupabaseClient<Database>, userId: string) {
  const id = requireUuid(userId);
  const rows = await loadPersonnelRows(supabase, [id]);
  if (rows.length === 0) throw new AdminApiError(404, "PERSONNEL_NOT_FOUND", "人员档案不存在。");
  const views = await buildPersonnelViews(supabase, rows);
  return views[0];
}

async function validatePersonnelReferences(supabase: SupabaseClient<Database>, update: Database["public"]["Tables"]["sys_user"]["Update"]) {
  if (update.position_id !== undefined && update.position_id !== null) {
    const { data, error } = await supabase.from("sys_position").select("id, status").eq("id", update.position_id).maybeSingle();
    if (error || !data || data.status !== "ACTIVE") throw new AdminApiError(400, "INVALID_POSITION", "岗位不存在、已停用或当前不可用。");
  }
  if (update.department_id !== undefined && update.department_id !== null) {
    const { data, error } = await supabase.from("lab_department").select("id, status").eq("id", update.department_id).maybeSingle();
    if (error || !data || data.status !== "ACTIVE") throw new AdminApiError(400, "INVALID_DEPARTMENT", "部门不存在、已停用或当前不可用。");
  }
}

export async function updatePersonnel(supabase: SupabaseClient<Database>, userId: string, bodyValue: unknown) {
  const id = requireUuid(userId);
  const update = buildPersonnelUpdate(bodyValue);
  await validatePersonnelReferences(supabase, update);
  const { data: before, error: beforeError } = await supabase.from("sys_user").select(PERSONNEL_FIELDS).eq("id", id).maybeSingle();
  if (beforeError) throw new AdminApiError(500, "PERSONNEL_LOOKUP_FAILED", "无法读取人员档案。");
  if (!before) throw new AdminApiError(404, "PERSONNEL_NOT_FOUND", "人员档案不存在。");
  const { data: after, error } = await supabase.from("sys_user").update(update).eq("id", id).select(PERSONNEL_FIELDS).single();
  if (error || !after) {
    if (error?.code === "23503") throw new AdminApiError(400, "INVALID_REFERENCE", "人员档案引用的对象不存在。");
    throw new AdminApiError(400, "PERSONNEL_UPDATE_FAILED", "人员档案更新失败。");
  }
  await recordAudit(supabase, "resource.manage", "sys_user", id, "UPDATE", before as unknown as Json, after as unknown as Json);
  return loadPersonnelDetail(supabase, id);
}

export async function listPersonnelRecords(supabase: SupabaseClient<Database>, userId: string, recordType: string) {
  const id = requireUuid(userId);
  const config = getPersonnelRecordConfig(recordType);
  await loadPersonnelDetail(supabase, id);
  const { data, error } = await personnelQuery(supabase, config.table).select(config.fields).eq("user_id", id).order("created_at", { ascending: false });
  if (error) throw new AdminApiError(500, "PERSONNEL_RECORD_LOOKUP_FAILED", "无法读取人员能力记录。");
  return (Array.isArray(data) ? data : []).map((item) => serializeRecord(config.recordType, item as RecordRow));
}

export async function createPersonnelRecord(supabase: SupabaseClient<Database>, userId: string, recordType: string, bodyValue: unknown) {
  const id = requireUuid(userId);
  const config = getPersonnelRecordConfig(recordType);
  await loadPersonnelDetail(supabase, id);
  const payload = buildPersonnelRecordPayload(config.recordType, bodyValue);
  const { data, error } = await personnelQuery(supabase, config.table).insert({ ...payload, user_id: id }).select(config.fields).single();
  if (error || !data) {
    if (error?.code === "23505") throw new AdminApiError(409, "PERSONNEL_RECORD_EXISTS", "相同人员能力记录已经存在。");
    if (error?.code === "23514") throw new AdminApiError(400, "INVALID_RECORD", "人员能力记录不满足数据约束。");
    throw new AdminApiError(400, "PERSONNEL_RECORD_CREATE_FAILED", "人员能力记录创建失败。");
  }
  await recordAudit(supabase, "resource.manage", config.objectType, String((data as RecordRow).id), "CREATE", null, data as Json);
  return serializeRecord(config.recordType, data as RecordRow);
}

async function loadOwnedRecord(supabase: SupabaseClient<Database>, config: ReturnType<typeof getPersonnelRecordConfig>, userId: string, recordId: number) {
  const { data, error } = await personnelQuery(supabase, config.table).select(config.fields).eq("id", recordId).eq("user_id", userId).maybeSingle();
  if (error) throw new AdminApiError(500, "PERSONNEL_RECORD_LOOKUP_FAILED", "无法读取人员能力记录。");
  if (!data) throw new AdminApiError(404, "PERSONNEL_RECORD_NOT_FOUND", "人员能力记录不存在。");
  return data as RecordRow;
}

export async function updatePersonnelRecord(supabase: SupabaseClient<Database>, userId: string, recordType: string, recordIdValue: string, bodyValue: unknown) {
  const id = requireUuid(userId);
  const config = getPersonnelRecordConfig(recordType);
  const recordId = requireId(recordIdValue);
  await loadPersonnelDetail(supabase, id);
  const before = await loadOwnedRecord(supabase, config, id, recordId);
  const payload = buildPersonnelRecordPayload(config.recordType, bodyValue, true);
  const { data, error } = await personnelQuery(supabase, config.table).update(payload).eq("id", recordId).eq("user_id", id).select(config.fields).single();
  if (error || !data) {
    if (error?.code === "23514") throw new AdminApiError(400, "INVALID_RECORD", "人员能力记录不满足数据约束。");
    throw new AdminApiError(400, "PERSONNEL_RECORD_UPDATE_FAILED", "人员能力记录更新失败。");
  }
  await recordAudit(supabase, "resource.manage", config.objectType, String(recordId), "UPDATE", before as Json, data as Json);
  return serializeRecord(config.recordType, data as RecordRow);
}

export async function deletePersonnelRecord(supabase: SupabaseClient<Database>, userId: string, recordType: string, recordIdValue: string) {
  const id = requireUuid(userId);
  const config = getPersonnelRecordConfig(recordType);
  const recordId = requireId(recordIdValue);
  await loadPersonnelDetail(supabase, id);
  const before = await loadOwnedRecord(supabase, config, id, recordId);
  const { error } = await personnelQuery(supabase, config.table).delete().eq("id", recordId).eq("user_id", id);
  if (error) throw new AdminApiError(400, "PERSONNEL_RECORD_DELETE_FAILED", "人员能力记录删除失败。");
  await recordAudit(supabase, "resource.manage", config.objectType, String(recordId), "DELETE", before as Json, null);
}
