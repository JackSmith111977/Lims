import { NextResponse } from "next/server";

import { loadTaskReviews, reviewTask } from "@/lib/server/result-review";
import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminPermission("review.read");
    const data = await loadTaskReviews(supabase, (await params).id);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminPermission("review.manage");
    await reviewTask(supabase, (await params).id, await request.json());
    const data = await loadTaskReviews(supabase, (await params).id);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
