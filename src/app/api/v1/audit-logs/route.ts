import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadAuditLogs, parseAuditFilters } from "@/lib/server/audit-data";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("audit.read");
    const filters = parseAuditFilters(new URL(request.url).searchParams);
    const data = await loadAuditLogs(supabase, filters);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
