import { NextResponse } from "next/server";

import {
  AdminApiError,
  requireAdminPermission,
  requireId,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { createSample, loadSamples, parseSampleFilterStatus } from "@/lib/server/sample-registration";

function parseFilterId(value: string | null, field: string) {
  if (!value) return null;
  try {
    return requireId(value);
  } catch {
    throw new AdminApiError(400, "INVALID_FIELD", `${field} 格式不正确。`);
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("sample.read");
    const url = new URL(request.url);
    const data = await loadSamples(supabase, {
      keyword: url.searchParams.get("keyword")?.trim() || null,
      status: parseSampleFilterStatus(url.searchParams.get("status")),
      projectId: parseFilterId(url.searchParams.get("projectId"), "projectId"),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("sample.manage");
    const data = await createSample(supabase, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
