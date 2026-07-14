import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { transitionTask } from "@/lib/server/task-flow";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    // The RPC enforces manager-or-current-assignee authorization after locking the task.
    const { supabase } = await requireAdminPermission("task.read");
    const data = await transitionTask(supabase, (await params).id, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
