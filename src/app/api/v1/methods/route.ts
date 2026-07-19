import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { createMethod, loadMethods } from "@/lib/server/methods";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.read");
    const url = new URL(request.url);
    const data = await loadMethods(supabase, {
      keyword: url.searchParams.get("keyword"),
      status: url.searchParams.get("status"),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("resource.manage");
    const data = await createMethod(supabase, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
