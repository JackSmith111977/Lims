import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminApiError, requireId, requireUuid } from "@/lib/server/admin";
import { loadInventoryAlerts, type InventoryAlertView } from "@/lib/server/inventory";
import type { Database } from "@/types/database";

export const SAMPLE_STATUSES = ["REGISTERED", "PROCESSING", "PROCESSED", "ARCHIVED", "DISPOSED"] as const;
export const TASK_STATUSES = ["DRAFT", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "RETURNED", "APPROVED", "ARCHIVED"] as const;

type SampleStatus = (typeof SAMPLE_STATUSES)[number];
type TaskStatus = (typeof TASK_STATUSES)[number];
type TypedClient = SupabaseClient<Database>;

export type DashboardFilters = {
  projectId?: number;
  personnelId?: string;
  sampleStatus?: SampleStatus;
  taskStatus?: TaskStatus;
  from?: string;
  to?: string;
  inventoryDays: number;
};

export type DashboardPermissions = {
  sampleRead: boolean;
  taskRead: boolean;
  dataRead: boolean;
  resourceRead: boolean;
};

export type DashboardFilterView = {
  projectId: number | null;
  personnelId: string | null;
  sampleStatus: string | null;
  taskStatus: string | null;
  from: string | null;
  to: string | null;
  inventoryDays: number;
};

export type StatusStatistics = {
  total: number;
  byStatus: Record<string, number>;
};

export type TaskStatistics = StatusStatistics & {
  completedCount: number;
  completionRate: number;
};

export type PendingReviewItem = {
  id: number;
  taskCode: string;
  name: string;
  projectId: number;
  status: string;
  plannedEnd: string | null;
  updatedAt: string;
};

export type AbnormalDataItem = {
  id: number;
  taskId: number;
  status: string;
  decision: string | null;
  explanation: string | null;
  executedAt: string;
};

export type AbnormalDataStatistics = {
  total: number;
  byStatus: Record<string, number>;
  byDecision: Record<string, number>;
  items: AbnormalDataItem[];
};

export type InventoryStatistics = {
  totalAlerts: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  alerts: InventoryAlertView[];
};

export type DashboardOverview = {
  filters: DashboardFilterView;
  availableSections: string[];
  samples: StatusStatistics | null;
  tasks: TaskStatistics | null;
  pendingReviews: PendingReviewItem[] | null;
  abnormalData: AbnormalDataStatistics | null;
  instruments: StatusStatistics | null;
  inventory: InventoryStatistics | null;
};

type SampleRow = Pick<Database["public"]["Tables"]["sample"]["Row"], "id" | "status" | "project_id" | "registered_at">;
type TaskRow = Pick<Database["public"]["Tables"]["experiment_task"]["Row"], "id" | "task_code" | "project_id" | "name" | "status" | "planned_end" | "created_at" | "updated_at">;
type InstrumentRow = Pick<Database["public"]["Tables"]["instrument"]["Row"], "id" | "status">;
type ProcessingRunRow = Pick<Database["public"]["Tables"]["experiment_processing_run"]["Row"], "id" | "task_id" | "status" | "decision" | "explanation" | "executed_at">;

function invalidQuery(message: string): never {
  throw new AdminApiError(400, "INVALID_QUERY", message);
}

function parseOptionalId(search: URLSearchParams, key: string) {
  const value = search.get(key)?.trim();
  if (!value) return undefined;
  try {
    return requireId(value);
  } catch {
    invalidQuery(`${key} 格式不正确。`);
  }
}

function parseOptionalUuid(search: URLSearchParams, key: string) {
  const value = search.get(key)?.trim();
  if (!value) return undefined;
  try {
    return requireUuid(value);
  } catch {
    invalidQuery(`${key} 格式不正确。`);
  }
}

function parseOptionalDate(search: URLSearchParams, key: "from" | "to") {
  const value = search.get(key)?.trim();
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalidQuery(`${key} 必须是有效的 ISO 8601 时间。`);
  return parsed.toISOString();
}

function parseOptionalEnum<T extends readonly string[]>(search: URLSearchParams, key: string, values: T) {
  const value = search.get(key)?.trim().toUpperCase();
  if (!value) return undefined;
  if (!values.includes(value)) invalidQuery(`${key} 的值不受支持。`);
  return value as T[number];
}

export function parseDashboardFilters(search: URLSearchParams): DashboardFilters {
  const from = parseOptionalDate(search, "from");
  const to = parseOptionalDate(search, "to");
  if (from && to && from >= to) invalidQuery("from 必须早于 to。");

  const daysValue = search.get("inventoryDays")?.trim();
  const inventoryDays = daysValue ? Number(daysValue) : 30;
  if (!Number.isSafeInteger(inventoryDays) || inventoryDays < 0 || inventoryDays > 365) {
    invalidQuery("inventoryDays 必须是 0-365 之间的整数。");
  }

  return {
    projectId: parseOptionalId(search, "projectId"),
    personnelId: parseOptionalUuid(search, "personnelId"),
    sampleStatus: parseOptionalEnum(search, "sampleStatus", SAMPLE_STATUSES),
    taskStatus: parseOptionalEnum(search, "taskStatus", TASK_STATUSES),
    from,
    to,
    inventoryDays,
  };
}

export function toDashboardFilterView(filters: DashboardFilters): DashboardFilterView {
  return {
    projectId: filters.projectId ?? null,
    personnelId: filters.personnelId ?? null,
    sampleStatus: filters.sampleStatus ?? null,
    taskStatus: filters.taskStatus ?? null,
    from: filters.from ?? null,
    to: filters.to ?? null,
    inventoryDays: filters.inventoryDays,
  };
}

export function aggregateStatus<T>(rows: T[], getStatus: (row: T) => string): StatusStatistics {
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    const status = getStatus(row);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return { total: rows.length, byStatus };
}

export function calculateCompletionRate(total: number, completedCount: number) {
  if (total <= 0) return 0;
  return Math.round((completedCount / total) * 10000) / 100;
}

function toError(code: string, message: string) {
  return new AdminApiError(500, code, message);
}

async function loadPersonnelTaskIds(supabase: TypedClient, personnelId: string) {
  const { data, error } = await supabase
    .from("task_assignee")
    .select("task_id")
    .eq("user_id", personnelId)
    .is("unassigned_at", null);
  if (error) throw toError("DASHBOARD_SCOPE_LOOKUP_FAILED", "无法读取人员任务范围。");
  return [...new Set((data ?? []).map((row) => row.task_id))];
}

async function loadTasks(supabase: TypedClient, filters: DashboardFilters, taskIds: number[] | undefined) {
  if (taskIds && taskIds.length === 0) return [] as TaskRow[];
  let query = supabase
    .from("experiment_task")
    .select("id, task_code, project_id, name, status, planned_end, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.taskStatus) query = query.eq("status", filters.taskStatus);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lt("created_at", filters.to);
  if (taskIds) query = query.in("id", taskIds);
  const { data, error } = await query;
  if (error) throw toError("DASHBOARD_TASK_LOOKUP_FAILED", "无法读取任务统计数据。");
  return (data ?? []) as unknown as TaskRow[];
}

async function loadSamples(supabase: TypedClient, filters: DashboardFilters, taskIds: number[] | undefined) {
  let sampleIds: number[] | undefined;
  if (taskIds) {
    if (taskIds.length === 0) return [] as SampleRow[];
    const { data, error } = await supabase.from("task_sample").select("sample_id").in("task_id", taskIds);
    if (error) throw toError("DASHBOARD_SAMPLE_SCOPE_FAILED", "无法读取任务样品范围。");
    sampleIds = [...new Set((data ?? []).map((row) => row.sample_id))];
    if (sampleIds.length === 0) return [] as SampleRow[];
  }

  let query = supabase.from("sample").select("id, status, project_id, registered_at");
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.sampleStatus) query = query.eq("status", filters.sampleStatus);
  if (filters.from) query = query.gte("registered_at", filters.from);
  if (filters.to) query = query.lt("registered_at", filters.to);
  if (sampleIds) query = query.in("id", sampleIds);
  const { data, error } = await query;
  if (error) throw toError("DASHBOARD_SAMPLE_LOOKUP_FAILED", "无法读取样品统计数据。");
  return (data ?? []) as unknown as SampleRow[];
}

async function loadInstruments(supabase: TypedClient) {
  const { data, error } = await supabase.from("instrument").select("id, status");
  if (error) throw toError("DASHBOARD_INSTRUMENT_LOOKUP_FAILED", "无法读取设备统计数据。");
  return (data ?? []) as unknown as InstrumentRow[];
}

async function loadProcessingRuns(supabase: TypedClient, filters: DashboardFilters, taskIds: number[] | undefined) {
  if (taskIds && taskIds.length === 0) return [] as ProcessingRunRow[];
  let query = supabase
    .from("experiment_processing_run")
    .select("id, task_id, status, decision, explanation, executed_at")
    .order("executed_at", { ascending: false });
  if (filters.from) query = query.gte("executed_at", filters.from);
  if (filters.to) query = query.lt("executed_at", filters.to);
  if (taskIds) query = query.in("task_id", taskIds);
  const { data, error } = await query;
  if (error) throw toError("DASHBOARD_DATA_LOOKUP_FAILED", "无法读取异常数据统计。");
  return ((data ?? []) as unknown as ProcessingRunRow[]).filter((row) => row.status === "FLAGGED" || row.decision === "FAIL" || row.decision === "REVIEW");
}

function serializePendingReviews(rows: TaskRow[]): PendingReviewItem[] {
  return rows
    .filter((row) => row.status === "PENDING_REVIEW")
    .map((row) => ({
      id: row.id,
      taskCode: row.task_code,
      name: row.name,
      projectId: row.project_id,
      status: row.status,
      plannedEnd: row.planned_end,
      updatedAt: row.updated_at,
    }));
}

function serializeAbnormalData(rows: ProcessingRunRow[]): AbnormalDataStatistics {
  const byStatus: Record<string, number> = {};
  const byDecision: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    const decision = row.decision ?? "UNDECIDED";
    byDecision[decision] = (byDecision[decision] ?? 0) + 1;
  }
  return {
    total: rows.length,
    byStatus,
    byDecision,
    items: rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      status: row.status,
      decision: row.decision,
      explanation: row.explanation,
      executedAt: row.executed_at,
    })),
  };
}

function serializeInventory(alerts: InventoryAlertView[]): InventoryStatistics {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const alert of alerts) {
    byType[alert.alertType] = (byType[alert.alertType] ?? 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
  }
  return { totalAlerts: alerts.length, byType, bySeverity, alerts };
}

function buildTaskStatistics(rows: TaskRow[]): TaskStatistics {
  const base = aggregateStatus(rows, (row) => row.status);
  const completedCount = rows.filter((row) => row.status === "APPROVED" || row.status === "ARCHIVED").length;
  return { ...base, completedCount, completionRate: calculateCompletionRate(base.total, completedCount) };
}

export async function loadDashboardOverview(
  supabase: TypedClient,
  filters: DashboardFilters,
  permissions: DashboardPermissions,
): Promise<DashboardOverview> {
  if (!permissions.sampleRead && !permissions.taskRead && !permissions.dataRead && !permissions.resourceRead) {
    throw new AdminApiError(403, "FORBIDDEN", "当前用户没有查看看板的权限。");
  }
  if (filters.personnelId && !permissions.taskRead) {
    throw new AdminApiError(403, "DASHBOARD_FILTER_PERMISSION_DENIED", "人员筛选需要 task.read 权限。");
  }
  if ((filters.projectId || filters.taskStatus) && permissions.dataRead && !permissions.taskRead) {
    throw new AdminApiError(403, "DASHBOARD_FILTER_PERMISSION_DENIED", "异常数据的项目或任务状态筛选需要 task.read 权限。");
  }

  const personnelTaskIds = filters.personnelId ? await loadPersonnelTaskIds(supabase, filters.personnelId) : undefined;
  const taskRows = permissions.taskRead ? await loadTasks(supabase, filters, personnelTaskIds) : null;
  const abnormalScopeRows = permissions.dataRead && permissions.taskRead && (filters.personnelId || filters.projectId || filters.taskStatus)
    ? await loadTasks(supabase, { ...filters, from: undefined, to: undefined }, personnelTaskIds)
    : null;
  const taskScopeIds = abnormalScopeRows ? abnormalScopeRows.map((row) => row.id) : undefined;

  const [sampleRows, processingRows, instruments, alerts] = await Promise.all([
    permissions.sampleRead ? loadSamples(supabase, filters, personnelTaskIds) : Promise.resolve(null),
    permissions.dataRead ? loadProcessingRuns(supabase, filters, taskScopeIds) : Promise.resolve(null),
    permissions.resourceRead ? loadInstruments(supabase) : Promise.resolve(null),
    permissions.resourceRead ? loadInventoryAlerts(supabase, filters.inventoryDays) : Promise.resolve(null),
  ]);

  const samples = sampleRows ? aggregateStatus(sampleRows, (row) => row.status) : null;
  const tasks = taskRows ? buildTaskStatistics(taskRows) : null;
  const pendingReviews = taskRows ? serializePendingReviews(taskRows) : null;
  const abnormalData = processingRows ? serializeAbnormalData(processingRows) : null;
  const instrumentStats = instruments ? aggregateStatus(instruments, (row) => row.status) : null;
  const inventory = alerts ? serializeInventory(alerts) : null;

  return {
    filters: toDashboardFilterView(filters),
    availableSections: [
      ...(samples ? ["samples"] : []),
      ...(tasks ? ["tasks", "pendingReviews"] : []),
      ...(abnormalData ? ["abnormalData"] : []),
      ...(instrumentStats || inventory ? ["resources"] : []),
    ],
    samples,
    tasks,
    pendingReviews,
    abnormalData,
    instruments: instrumentStats,
    inventory,
  };
}

export async function loadDashboardTaskStatistics(
  supabase: TypedClient,
  filters: DashboardFilters,
): Promise<Pick<DashboardOverview, "filters" | "tasks" | "pendingReviews">> {
  const overview = await loadDashboardOverview(supabase, filters, { sampleRead: false, taskRead: true, dataRead: false, resourceRead: false });
  return { filters: overview.filters, tasks: overview.tasks, pendingReviews: overview.pendingReviews };
}

export async function loadDashboardInventoryStatistics(
  supabase: TypedClient,
  filters: DashboardFilters,
): Promise<Pick<DashboardOverview, "filters" | "inventory">> {
  const overview = await loadDashboardOverview(supabase, filters, { sampleRead: false, taskRead: false, dataRead: false, resourceRead: true });
  return { filters: overview.filters, inventory: overview.inventory };
}
