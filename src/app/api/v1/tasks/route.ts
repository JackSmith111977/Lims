import { NextResponse } from "next/server";

import {
  AdminApiError,
  requireAdminPermission,
  requireId,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { createTask, loadTasks } from "@/lib/server/task-registration";

function parseFilterId(value: string | null, field: string) {
  if (!value) return null;
  try {
    return requireId(value);
  } catch {
    throw new AdminApiError(400, "INVALID_FIELD", `${field} 格式不正确。`);
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("task.read");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    if (status && !["DRAFT", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "RETURNED", "APPROVED", "ARCHIVED"].includes(status)) {
      throw new AdminApiError(400, "INVALID_TASK_STATUS", "任务状态不受支持。");
    }
    if (priority && !["LOW", "NORMAL", "HIGH"].includes(priority)) {
      throw new AdminApiError(400, "INVALID_PRIORITY", "任务优先级不受支持。");
    }
    const data = await loadTasks(supabase, {
      keyword: url.searchParams.get("keyword")?.trim() || null,
      projectId: parseFilterId(url.searchParams.get("projectId"), "projectId"),
      status,
      priority,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("task.manage");
    const data = await createTask(supabase, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
