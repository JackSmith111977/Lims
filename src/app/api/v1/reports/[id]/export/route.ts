import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadReportDetail } from "@/lib/server/reporting";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("report.read");
    const report = await loadReportDetail(supabase, (await params).id);
    const payload = {
      report: {
        id: report.id,
        reportCode: report.reportCode,
        taskId: report.taskId,
        versionNo: report.versionNo,
        status: report.status,
        generatedBy: report.generatedBy,
        generatedAt: report.generatedAt,
        publishedAt: report.publishedAt,
        archivedAt: report.archivedAt,
      },
      reportPayload: report.reportPayload,
      history: report.history,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${report.reportCode}-v${report.versionNo}.json"`,
      },
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
