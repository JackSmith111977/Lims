import { NextResponse } from "next/server";

import {
  requireAdminPermission,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import {
  createPersonnelRecord,
  listPersonnelRecords,
} from "@/lib/server/personnel";

type RouteContext = { params: Promise<{ id: string; recordType: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const { id, recordType } = await params;
    const data = await listPersonnelRecords(supabase, id, recordType);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const { id, recordType } = await params;
    const data = await createPersonnelRecord(supabase, id, recordType, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
