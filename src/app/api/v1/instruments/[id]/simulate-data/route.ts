import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { createSimulatedInstrumentData } from "@/lib/server/simulated-instrument";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await requireAdminPermission("data.manage");
    const data = await createSimulatedInstrumentData(supabase, user.id, (await params).id, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
