import { NextResponse } from "next/server";

import { toAdminErrorResponse } from "@/lib/server/admin";
import { requireDashboardContext, requireDashboardPermission } from "@/lib/server/dashboard-access";
import { loadDashboardInventoryStatistics, parseDashboardFilters } from "@/lib/server/dashboard";

export async function GET(request: Request) {
  try {
    const context = await requireDashboardContext();
    requireDashboardPermission(context, "resource.read");
    const filters = parseDashboardFilters(new URL(request.url).searchParams);
    const data = await loadDashboardInventoryStatistics(context.supabase, filters);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
