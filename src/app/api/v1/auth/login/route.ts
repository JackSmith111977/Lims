import { NextResponse } from "next/server";

import { requireObject, requireText, toAdminErrorResponse } from "@/lib/server/admin";
import { normalizeAuditEmail, recordSystemAudit } from "@/lib/server/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function signOutSafely() {
  try {
    await (await createClient()).auth.signOut();
  } catch {
    // Keep the primary error generic if session cleanup also fails.
  }
}

export async function POST(request: Request) {
  try {
    const body = requireObject(await request.json());
    const email = normalizeAuditEmail(requireText(body.email, "email", 320));
    const password = requireText(body.password, "password", 1024);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      await recordSystemAudit({
        action: "LOGIN_FAILURE",
        objectId: email,
        operatorId: null,
        afterJson: { result: "FAILURE", reason: "INVALID_CREDENTIALS", email },
        request,
      });
      return NextResponse.json(
        { error: { code: "AUTH_FAILED", message: "登录失败，请检查账号和密码。" } },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("sys_user")
      .select("id, status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      await signOutSafely();
      throw new Error("profile lookup failed");
    }

    if (!profile || profile.status !== "ACTIVE") {
      await signOutSafely();
      await recordSystemAudit({
        action: "LOGIN_BLOCKED",
        objectId: data.user.id,
        operatorId: data.user.id,
        afterJson: { result: "BLOCKED", reason: "USER_INACTIVE" },
        request,
      });
      return NextResponse.json(
        { error: { code: "USER_INACTIVE", message: "当前用户已停用。" } },
        { status: 403 },
      );
    }

    try {
      await recordSystemAudit({
        action: "LOGIN_SUCCESS",
        objectId: data.user.id,
        operatorId: data.user.id,
        afterJson: { result: "SUCCESS" },
        request,
      });
    } catch (auditError) {
      await signOutSafely();
      throw auditError;
    }

    return NextResponse.json({ data: { user: { id: data.user.id, email: data.user.email } } });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
