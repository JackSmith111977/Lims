import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadReports } from "@/lib/server/reporting";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("report.read");
    const url = new URL(request.url);
    const data = await loadReports(supabase, {
      keyword: url.searchParams.get("keyword"),
      status: url.searchParams.get("status"),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
