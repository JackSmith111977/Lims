import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { saveEnvironmentThreshold } from "@/lib/server/environment";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const { id } = await params;
    const data = await saveEnvironmentThreshold(supabase, id, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
