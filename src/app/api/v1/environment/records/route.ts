import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadEnvironmentRecords, recordEnvironmentReading } from "@/lib/server/environment";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const search = new URL(request.url).searchParams;
    const data = await loadEnvironmentRecords(supabase, { laboratoryId: search.get("laboratoryId"), metric: search.get("metric"), status: search.get("status") });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const data = await recordEnvironmentReading(supabase, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
