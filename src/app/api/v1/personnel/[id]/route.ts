import { NextResponse } from "next/server";

import {
  requireAdminPermission,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { loadPersonnelDetail, updatePersonnel } from "@/lib/server/personnel";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const data = await loadPersonnelDetail(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const data = await updatePersonnel(supabase, (await params).id, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
