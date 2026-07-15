import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadInventoryAlerts } from "@/lib/server/inventory";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const daysValue = new URL(request.url).searchParams.get("days");
    const days = daysValue === null ? 30 : Number(daysValue);
    const data = await loadInventoryAlerts(supabase, days);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
