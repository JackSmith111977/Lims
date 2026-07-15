import { NextResponse } from "next/server";

import { recordSystemAudit } from "@/lib/server/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    try {
      await recordSystemAudit({ action: "LOGIN_FAILURE", objectId: "oauth", operatorId: null, afterJson: { result: "FAILURE", reason: "OAUTH_CALLBACK_FAILED" }, request });
    } catch {
      // The login remains unsuccessful even when the failure audit cannot be written.
    }
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  try {
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("sys_user").select("status").eq("id", data.user.id).maybeSingle();
    if (profileError) throw new Error("profile lookup failed");
    if (!profile || profile.status !== "ACTIVE") {
      await supabase.auth.signOut();
      await recordSystemAudit({ action: "LOGIN_BLOCKED", objectId: data.user.id, operatorId: data.user.id, afterJson: { result: "BLOCKED", reason: "USER_INACTIVE" }, request });
      return NextResponse.redirect(new URL("/login?error=user_inactive", request.url));
    }

    await recordSystemAudit({ action: "LOGIN_SUCCESS", objectId: data.user.id, operatorId: data.user.id, afterJson: { result: "SUCCESS" }, request });
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=audit_unavailable", request.url));
  }
}
