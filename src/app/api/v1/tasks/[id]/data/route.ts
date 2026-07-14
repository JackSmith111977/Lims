import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { createTaskData, loadTaskData } from "@/lib/server/experiment-data";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("data.read");
    const data = await loadTaskData(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await requireAdminPermission("data.manage");
    const data = await createTaskData(supabase, user.id, (await params).id, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
