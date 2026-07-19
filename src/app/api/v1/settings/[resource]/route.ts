import { NextResponse } from "next/server";

import {
  AdminApiError,
  requireAdminPermission,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import {
  auditSetting,
  buildSettingPayload,
  getSettingConfig,
  mapSettingDatabaseError,
  serializeSetting,
  settingsQuery,
  validateSettingParent,
} from "@/lib/server/settings";

type RouteContext = { params: Promise<{ resource: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { supabase } = await requireAdminPermission("settings.manage");
    const { resource, table, fields } = getSettingConfig((await params).resource);
    let query = settingsQuery(supabase, table).select(fields).order("created_at", { ascending: false });
    const url = new URL(request.url);
    if (resource === "categories" && url.searchParams.get("categoryType")) {
      query = query.eq("category_type", url.searchParams.get("categoryType")!);
    }
    if (resource === "report-templates") query = query.like("code", "REPORT_TEMPLATE_%");
    const { data, error } = await query;
    if (error) throw new AdminApiError(500, "SETTINGS_LOOKUP_FAILED", "无法读取设置数据。");
    const rows = Array.isArray(data) ? data : [];
    return NextResponse.json({ data: rows.map((item) => serializeSetting(resource, item)) });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user: operator } = await requireAdminPermission("settings.manage");
    const { resource, table, fields, objectType } = getSettingConfig((await params).resource);
    const payload = buildSettingPayload(resource, await request.json());
    await validateSettingParent(supabase, resource, payload);
    const { data, error } = await settingsQuery(supabase, table).insert(payload).select(fields).single();
    mapSettingDatabaseError(error, resource);
    if (!data) throw new AdminApiError(500, "SETTINGS_WRITE_FAILED", "设置创建失败。");
    const row = data as Record<string, unknown>;
    await auditSetting(supabase, objectType, String(row.id), "CREATE", null, {
      ...row,
      operator_id: operator.id,
    });
    return NextResponse.json({ data: serializeSetting(resource, row) }, { status: 201 });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
