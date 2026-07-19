import { NextResponse } from "next/server";

import { requireAdminPermission, toAdminErrorResponse } from "@/lib/server/admin";
import { loadProcessingRules } from "@/lib/server/experiment-processing";

export async function GET() {
  try {
    const { supabase } = await requireAdminPermission("data.read");
    const data = await loadProcessingRules(supabase);
    return NextResponse.json({ data });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
