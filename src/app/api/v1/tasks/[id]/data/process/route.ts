import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { processTaskData } from "@/lib/server/experiment-processing";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("data.manage");
    const result = await processTaskData(supabase, (await params).id, await request.json());
    return NextResponse.json({ data: result.data }, { status: result.status });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
