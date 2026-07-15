import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadMaintenanceReminders } from "@/lib/server/instrument-maintenance";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const value = new URL(request.url).searchParams.get("days");
    const days = value === null ? 30 : Number(value);
    const data = await loadMaintenanceReminders(supabase, days);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
