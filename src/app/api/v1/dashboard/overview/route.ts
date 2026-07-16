import { NextResponse } from "next/server";

import { toAdminErrorResponse } from "@/lib/server/admin";
import { requireDashboardContext } from "@/lib/server/dashboard-access";
import { loadDashboardOverview, parseDashboardFilters } from "@/lib/server/dashboard";

export async function GET(request: Request) {
  try {
    const context = await requireDashboardContext();
    const filters = parseDashboardFilters(new URL(request.url).searchParams);
    const data = await loadDashboardOverview(context.supabase, filters, context.permissions);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
