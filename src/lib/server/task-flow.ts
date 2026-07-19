import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminApiError,
  optionalText,
  requireId,
  requireObject,
  requireText,
  requireUuid,
} from "@/lib/server/admin";
import type { Database } from "@/types/database";

export const TASK_STATUSES = ["DRAFT", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "RETURNED", "APPROVED", "ARCHIVED"] as const;

export type TaskUserAssignmentView = {
  id: number;
  taskId: number;
  userId: string;
  assignedBy: string;
  assignedAt: string;
};

export type TaskGroupAssignmentView = {
  id: number;
  taskId: number;
  groupId: number;
  assignedBy: string;
  assignedAt: string;
};

export type TaskHistoryView = {
  id: number;
  taskId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorId: string;
  remark: string | null;
  occurredAt: string;
};

function parseIdList(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new AdminApiError(400, "INVALID_FIELD", `${field} 必须是 ID 数组。`);
  return [...new Set(value.map((item) => {
    try {
      return requireId(String(item));
    } catch {
      throw new AdminApiError(400, "INVALID_FIELD", `${field} 包含无效 ID。`);
    }
  }))];
}

function parseUuidList(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new AdminApiError(400, "INVALID_FIELD", `${field} 必须是 UUID 数组。`);
  return [...new Set(value.map((item) => requireUuid(String(item))))];
}

export function buildAssignmentPayload(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  if (body.userIds === undefined && body.groupIds === undefined) {
    throw new AdminApiError(400, "ASSIGNMENT_PAYLOAD_REQUIRED", "userIds 或 groupIds 至少需要出现一个。");
  }
  return {
    userIds: body.userIds === undefined ? undefined : parseUuidList(body.userIds, "userIds"),
    groupIds: body.groupIds === undefined ? undefined : parseIdList(body.groupIds, "groupIds"),
  };
}

export function buildTransitionPayload(bodyValue: unknown) {
  const body = requireObject(bodyValue);
  for (const field of ["fromStatus", "operatorId", "occurredAt"]) {
    if (body[field] !== undefined) throw new AdminApiError(400, "INVALID_TRANSITION_FIELD", `${field} 由服务端生成。`);
  }
  const toStatus = requireText(body.toStatus, "toStatus", 24).toUpperCase();
  if (!TASK_STATUSES.includes(toStatus as (typeof TASK_STATUSES)[number]) || toStatus === "DRAFT") {
    throw new AdminApiError(400, "INVALID_TASK_STATUS", "任务目标状态不受支持。");
  }
  return {
    toStatus,
    remark: body.remark === null ? null : optionalText(body.remark, "remark", 2000) ?? null,
  };
}

function serializeUserAssignment(row: Database["public"]["Tables"]["task_assignee"]["Row"]): TaskUserAssignmentView {
  return { id: row.id, taskId: row.task_id, userId: row.user_id, assignedBy: row.assigned_by, assignedAt: row.assigned_at };
}

function serializeGroupAssignment(row: Database["public"]["Tables"]["task_group_assignee"]["Row"]): TaskGroupAssignmentView {
  return { id: row.id, taskId: row.task_id, groupId: row.group_id, assignedBy: row.assigned_by, assignedAt: row.assigned_at };
}

export async function loadTaskAssignments(supabase: SupabaseClient<Database>, taskIds: number[]) {
  const usersByTask = new Map<number, TaskUserAssignmentView[]>();
  const groupsByTask = new Map<number, TaskGroupAssignmentView[]>();
  if (taskIds.length === 0) return { usersByTask, groupsByTask };
  const [{ data: users, error: userError }, { data: groups, error: groupError }] = await Promise.all([
    supabase.from("task_assignee").select("id, task_id, user_id, assigned_by, assigned_at, unassigned_at").in("task_id", taskIds).is("unassigned_at", null),
    supabase.from("task_group_assignee").select("id, task_id, group_id, assigned_by, assigned_at, unassigned_at").in("task_id", taskIds).is("unassigned_at", null),
  ]);
  if (userError || groupError) throw new AdminApiError(500, "TASK_ASSIGNMENT_LOOKUP_FAILED", "无法读取任务分配。");
  for (const row of (users ?? []) as unknown as Database["public"]["Tables"]["task_assignee"]["Row"][]) {
    usersByTask.set(row.task_id, [...(usersByTask.get(row.task_id) ?? []), serializeUserAssignment(row)]);
  }
  for (const row of (groups ?? []) as unknown as Database["public"]["Tables"]["task_group_assignee"]["Row"][]) {
    groupsByTask.set(row.task_id, [...(groupsByTask.get(row.task_id) ?? []), serializeGroupAssignment(row)]);
  }
  return { usersByTask, groupsByTask };
}

function mapTaskFlowError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "42501" || message.includes("permission denied")) return new AdminApiError(403, "FORBIDDEN", "当前用户没有执行任务操作的权限。");
  if (error.code === "P0002" || message.includes("Task not found")) return new AdminApiError(404, "TASK_NOT_FOUND", "任务不存在。");
  if (message.includes("Invalid assignee user")) return new AdminApiError(409, "INVALID_ASSIGNEE_USER", "分配人员不存在、已停用或当前不可用。");
  if (message.includes("Invalid assignee group")) return new AdminApiError(409, "INVALID_ASSIGNEE_GROUP", "分配实验组不存在或已停用。");
  if (message.includes("Task is not assignable") || message.includes("Task assignment required")) return new AdminApiError(409, "TASK_NOT_ASSIGNABLE", "当前任务状态不允许这样修改分配。");
  if (message.includes("Invalid task transition")) return new AdminApiError(409, "INVALID_TASK_TRANSITION", "当前任务状态不允许该流转。");
  if (message.includes("Invalid task status")) return new AdminApiError(400, "INVALID_TASK_STATUS", "任务目标状态不受支持。");
  return new AdminApiError(500, "TASK_FLOW_FAILED", "任务操作失败。");
}

export async function assignTask(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const taskId = requireId(idValue);
  const payload = buildAssignmentPayload(bodyValue);
  const { data, error } = await supabase.rpc("replace_task_assignments", {
    _task_id: taskId,
    _user_ids: payload.userIds,
    _group_ids: payload.groupIds,
  });
  if (error) throw mapTaskFlowError(error);
  return data;
}

export async function transitionTask(supabase: SupabaseClient<Database>, idValue: string, bodyValue: unknown) {
  const taskId = requireId(idValue);
  const payload = buildTransitionPayload(bodyValue);
  const { data, error } = await supabase.rpc("transition_task", {
    _task_id: taskId,
    _to_status: payload.toStatus,
    _remark: payload.remark ?? undefined,
  });
  if (error) throw mapTaskFlowError(error);
  return data;
}

export async function loadTaskHistory(supabase: SupabaseClient<Database>, idValue: string) {
  const taskId = requireId(idValue);
  const { data: task, error: taskError } = await supabase.from("experiment_task").select("id").eq("id", taskId).maybeSingle();
  if (taskError) throw new AdminApiError(500, "TASK_LOOKUP_FAILED", "无法读取任务。");
  if (!task) throw new AdminApiError(404, "TASK_NOT_FOUND", "任务不存在。");
  const { data, error } = await supabase.from("task_status_history").select("id, task_id, from_status, to_status, operator_id, remark, occurred_at").eq("task_id", taskId).order("occurred_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new AdminApiError(500, "TASK_HISTORY_LOOKUP_FAILED", "无法读取任务状态历史。");
  return ((data ?? []) as unknown as Database["public"]["Tables"]["task_status_history"]["Row"][]).map((row): TaskHistoryView => ({
    id: row.id,
    taskId: row.task_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    operatorId: row.operator_id,
    remark: row.remark,
    occurredAt: row.occurred_at,
  }));
}
