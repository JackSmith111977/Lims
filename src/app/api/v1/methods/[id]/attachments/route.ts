import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { createMethodAttachment, uploadMethodAttachment } from "@/lib/server/methods";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user } = await requireAdminPermission("resource.manage");
    const id = (await params).id;
    const contentType = request.headers.get("content-type") ?? "";
    const data = contentType.includes("multipart/form-data")
      ? await uploadMethodAttachment(supabase, user.id, id, (await request.formData()).get("file") as File)
      : await createMethodAttachment(supabase, user.id, id, await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
