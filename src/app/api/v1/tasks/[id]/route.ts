import { NextResponse } from "next/server";

import {
  requireAdminPermission,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { loadTaskDetail, updateTask } from "@/lib/server/task-registration";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("task.read");
    const data = await loadTaskDetail(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("task.manage");
    const data = await updateTask(supabase, (await params).id, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
