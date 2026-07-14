import { NextResponse } from "next/server";

import {
  requireAdminPermission,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { loadProjectDetail, updateProject } from "@/lib/server/task-registration";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("project.read");
    const data = await loadProjectDetail(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await requireAdminPermission("project.manage");
    const data = await updateProject(supabase, user.id, (await params).id, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
