import { NextResponse } from "next/server";

import { toAdminErrorResponse } from "@/lib/server/admin";
import { requireDashboardContext, requireDashboardPermission } from "@/lib/server/dashboard-access";
import { loadDashboardTaskStatistics, parseDashboardFilters } from "@/lib/server/dashboard";

export async function GET(request: Request) {
  try {
    const context = await requireDashboardContext();
    requireDashboardPermission(context, "task.read");
    const filters = parseDashboardFilters(new URL(request.url).searchParams);
    const data = await loadDashboardTaskStatistics(context.supabase, filters);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
