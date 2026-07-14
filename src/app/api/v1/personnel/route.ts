import { NextResponse } from "next/server";

import {
  AdminApiError,
  requireAdminPermission,
  requireId,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { loadPersonnelList, parseAvailabilityStatus } from "@/lib/server/personnel";

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
    const { supabase } = await requireAdminPermission("resource.read");
    const url = new URL(request.url);
    const availabilityStatus = parseAvailabilityStatus(url.searchParams.get("availabilityStatus") ?? undefined) ?? null;
    const data = await loadPersonnelList(supabase, {
      keyword: url.searchParams.get("keyword")?.trim() || null,
      availabilityStatus,
      departmentId: parseFilterId(url.searchParams.get("departmentId"), "departmentId"),
      positionId: parseFilterId(url.searchParams.get("positionId"), "positionId"),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
