import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadEnvironmentAlerts } from "@/lib/server/environment";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const search = new URL(request.url).searchParams;
    const daysValue = search.get("days");
    const data = await loadEnvironmentAlerts(supabase, daysValue === null ? 30 : Number(daysValue), search.get("laboratoryId"));
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
