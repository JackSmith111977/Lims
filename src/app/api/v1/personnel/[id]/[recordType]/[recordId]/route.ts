import { NextResponse } from "next/server";

import {
  requireAdminPermission,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import {
  deletePersonnelRecord,
  updatePersonnelRecord,
} from "@/lib/server/personnel";

type RouteContext = { params: Promise<{ id: string; recordType: string; recordId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const { id, recordType, recordId } = await params;
    const data = await updatePersonnelRecord(supabase, id, recordType, recordId, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const { id, recordType, recordId } = await params;
    await deletePersonnelRecord(supabase, id, recordType, recordId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
