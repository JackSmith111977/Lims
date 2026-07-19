import { NextResponse } from "next/server";

import {
  AdminApiError,
  requireAdminPermission,
  requireId,
  toAdminErrorResponse,
} from "@/lib/server/admin";
import {
  auditSetting,
  buildSettingPayload,
  getSettingConfig,
  mapSettingDatabaseError,
  serializeSetting,
  isCodeSettingResource,
  settingsQuery,
  validateSettingParent,
} from "@/lib/server/settings";

type RouteContext = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { supabase, user: operator } = await requireAdminPermission("settings.manage");
    const { resource, table, fields, objectType } = getSettingConfig((await params).resource);
    const rawId = (await params).id;
    const id = isCodeSettingResource(resource) ? rawId : requireId(rawId);
    const body = await request.json();
    const payload = buildSettingPayload(resource, body, true);
    if (isCodeSettingResource(resource)) {
      const parameterLookup = await settingsQuery(supabase, table).select(fields).eq("code", rawId).maybeSingle();
      if (parameterLookup.error) throw new AdminApiError(500, "SETTINGS_LOOKUP_FAILED", "无法读取设置数据。");
      if (!parameterLookup.data) throw new AdminApiError(404, "SETTING_NOT_FOUND", "设置对象不存在。");
      const before = parameterLookup.data;
      await validateSettingParent(supabase, resource, payload);
      const { data, error } = await settingsQuery(supabase, table).update(payload).eq("code", rawId).select(fields).single();
      mapSettingDatabaseError(error, resource);
      if (!data) throw new AdminApiError(500, "SETTINGS_WRITE_FAILED", "设置更新失败。");
      const row = data as Record<string, unknown>;
      await auditSetting(supabase, objectType, String(row.id), "UPDATE", before as never, { ...row, operator_id: operator.id });
      return NextResponse.json({ data: serializeSetting(resource, row) });
    }
    const lookup = await settingsQuery(supabase, table).select(fields).eq("id", id).maybeSingle();
    if (lookup.error) throw new AdminApiError(500, "SETTINGS_LOOKUP_FAILED", "无法读取设置数据。");
    if (!lookup.data) throw new AdminApiError(404, "SETTING_NOT_FOUND", "设置对象不存在。");
    const before = lookup.data;
    await validateSettingParent(supabase, resource, payload, Number(id));
    const { data, error } = await settingsQuery(supabase, table).update(payload).eq("id", id).select(fields).single();
    mapSettingDatabaseError(error, resource);
    if (!data) throw new AdminApiError(500, "SETTINGS_WRITE_FAILED", "设置更新失败。");
    const row = data as Record<string, unknown>;
    await auditSetting(supabase, objectType, String(row.id), "UPDATE", before as never, { ...row, operator_id: operator.id });
    return NextResponse.json({ data: serializeSetting(resource, row) });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
