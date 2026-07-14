import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadSampleFlows, recordSampleFlow } from "@/lib/server/sample-registration";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("sample.read");
    const data = await loadSampleFlows(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("sample.manage");
    const data = await recordSampleFlow(supabase, (await params).id, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
