import { NextResponse } from "next/server";

import { AdminApiError, toAdminErrorResponse } from "@/lib/server/admin";
import { recordSystemAudit } from "@/lib/server/audit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AdminApiError(401, "AUTH_REQUIRED", "请先登录。");
    }

    await recordSystemAudit({
      action: "LOGOUT",
      objectId: user.id,
      operatorId: user.id,
      afterJson: { result: "SUCCESS" },
      request,
    });

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new AdminApiError(503, "LOGOUT_FAILED", "退出登录失败，请稍后重试。");
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
