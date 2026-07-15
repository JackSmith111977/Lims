import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { readOptionalJsonBody, submitReportForReview } from "@/lib/server/reporting";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("report.manage");
    const data = await submitReportForReview(supabase, (await params).id, await readOptionalJsonBody(request));
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
