import { NextResponse } from "next/server";

import {
  AdminApiError,
  requireAdminPermission,
  requireUuid,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import { createProject, loadProjects } from "@/lib/server/task-registration";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("project.read");
    const url = new URL(request.url);
    const ownerId = url.searchParams.get("ownerId");
    if (ownerId) requireUuid(ownerId);
    const status = url.searchParams.get("status");
    if (status && !["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
      throw new AdminApiError(400, "INVALID_PROJECT_STATUS", "项目状态不受支持。");
    }
    const data = await loadProjects(supabase, {
      keyword: url.searchParams.get("keyword")?.trim() || null,
      status,
      ownerId,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdminPermission("project.manage");
    const data = await createProject(supabase, user.id, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
