import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadReportTrace } from "@/lib/server/traceability";

type Context = { params: Promise<{ objectType: string; id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { supabase } = await requireAdminPermission("report.read");
    const { objectType, id } = await context.params;
    const data = await loadReportTrace(supabase, objectType, id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
