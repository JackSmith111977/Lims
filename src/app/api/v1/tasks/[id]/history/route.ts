import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadTaskHistory } from "@/lib/server/task-flow";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("task.read");
    const data = await loadTaskHistory(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
