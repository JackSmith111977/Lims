import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { importTaskData } from "@/lib/server/data-import";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await requireAdminPermission("data.manage");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string" || typeof (file as Blob).arrayBuffer !== "function") {
      return NextResponse.json(
        { error: { code: "IMPORT_FILE_REQUIRED", message: "请选择 CSV 或 XLSX 文件。" } },
        { status: 400 },
      );
    }
    const result = await importTaskData(supabase, user.id, (await params).id, file as Blob & { name?: string });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
