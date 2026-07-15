import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadEnvironmentThresholds, saveEnvironmentThreshold } from "@/lib/server/environment";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const data = await loadEnvironmentThresholds(supabase, new URL(request.url).searchParams.get("laboratoryId"));
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const data = await saveEnvironmentThreshold(supabase, null, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
