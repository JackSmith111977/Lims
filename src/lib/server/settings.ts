import type { Json } from "@/types/database";

import {
  AdminApiError,
  optionalText,
  recordAudit,
  requireId,
  requireObject,
  requireText,
  requireUuid,
} from "@/lib/server/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const SETTING_RESOURCES = [
  "laboratories",
  "departments",
  "groups",
  "categories",
  "units",
  "parameters",
  "report-templates",
] as const;

export type SettingResource = (typeof SETTING_RESOURCES)[number];

const RESOURCE_CONFIG: Record<SettingResource, { table: keyof Database["public"]["Tables"]; fields: string; objectType: string }> = {
  laboratories: { table: "lab_laboratory", fields: "id, code, name, location, manager_id, status, created_at, updated_at", objectType: "lab_laboratory" },
  departments: { table: "lab_department", fields: "id, laboratory_id, parent_id, code, name, status, created_at, updated_at", objectType: "lab_department" },
  groups: { table: "lab_group", fields: "id, laboratory_id, leader_id, code, name, status, created_at, updated_at", objectType: "lab_group" },
  categories: { table: "sys_category", fields: "id, category_type, parent_id, code, name, description, sort_order, status, created_at, updated_at", objectType: "sys_category" },
  units: { table: "sys_unit", fields: "id, code, name, symbol, dimension, sort_order, status, created_at, updated_at", objectType: "sys_unit" },
  parameters: { table: "sys_parameter", fields: "id, code, name, value_type, value_json, description, status, created_at, updated_at", objectType: "sys_parameter" },
  "report-templates": { table: "sys_parameter", fields: "id, code, name, value_type, value_json, description, status, created_at, updated_at", objectType: "report_template" },
};

export type SettingsDbError = { code?: string; message: string };
export type SettingsDbResult = { data: unknown; error: SettingsDbError | null };
export type SettingsQuery = PromiseLike<SettingsDbResult> & {
  select(columns?: string): SettingsQuery;
  order(column: string, options?: { ascending?: boolean }): SettingsQuery;
  eq(column: string, value: unknown): SettingsQuery;
  like(column: string, pattern: string): SettingsQuery;
  insert(values: unknown): SettingsQuery;
  update(values: unknown): SettingsQuery;
  single(): Promise<SettingsDbResult>;
  maybeSingle(): Promise<SettingsDbResult>;
};

export function settingsQuery(supabase: SupabaseClient<Database>, table: keyof Database["public"]["Tables"]) {
  return supabase.from(table) as unknown as SettingsQuery;
}

export function getSettingConfig(resource: string) {
  if (!SETTING_RESOURCES.includes(resource as SettingResource)) {
    throw new AdminApiError(404, "SETTING_RESOURCE_NOT_FOUND", "设置资源不存在。");
  }
  return { resource: resource as SettingResource, ...RESOURCE_CONFIG[resource as SettingResource] };
}

export function parseStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (value !== "ACTIVE" && value !== "INACTIVE") {
    throw new AdminApiError(400, "INVALID_STATUS", "status 只能是 ACTIVE 或 INACTIVE。");
  }
  return value;
}

function optionalId(value: unknown) {
  if (value === undefined || value === null || value === "") return value === null ? null : undefined;
  return requireId(String(value));
}

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return value === null ? null : undefined;
  if (typeof value !== "string") throw new AdminApiError(400, "INVALID_FIELD", `${field}格式不正确。`);
  return requireUuid(value);
}

function parseParameterValue(value: unknown, valueType: string): Json {
  if (!["STRING", "NUMBER", "BOOLEAN", "JSON"].includes(valueType)) {
    throw new AdminApiError(400, "INVALID_PARAMETER_TYPE", "valueType 不受支持。");
  }
  if (valueType === "STRING") return requireText(value, "value", 2048);
  if (valueType === "NUMBER") {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) throw new AdminApiError(400, "INVALID_PARAMETER_VALUE", "参数值必须是数字。");
    return number;
  }
  if (valueType === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new AdminApiError(400, "INVALID_PARAMETER_VALUE", "参数值必须是布尔值。");
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Json;
    } catch {
      throw new AdminApiError(400, "INVALID_PARAMETER_VALUE", "参数值不是有效 JSON。");
    }
  }
  if (value === null || typeof value === "object") return value as Json;
  throw new AdminApiError(400, "INVALID_PARAMETER_VALUE", "参数值不是有效 JSON。");
}

function parseReportTemplateValue(value: unknown): Json {
  const parsed = parseParameterValue(value, "JSON");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AdminApiError(400, "INVALID_REPORT_TEMPLATE", "报告模板必须是 JSON 对象。");
  }
  const template = parsed as Record<string, unknown>;
  if (template.title !== undefined) requireText(template.title, "title", 128);
  if (template.description !== undefined) requireText(template.description, "description", 255);
  if (template.fields !== undefined) {
    if (!Array.isArray(template.fields) || template.fields.length === 0 || template.fields.length > 64 || template.fields.some((field) => typeof field !== "string" || field.trim().length === 0 || field.length > 64)) {
      throw new AdminApiError(400, "INVALID_REPORT_TEMPLATE", "报告模板 fields 必须是 1～64 个非空字符串。");
    }
  }
  return parsed;
}

export function isCodeSettingResource(resource: SettingResource) {
  return resource === "parameters" || resource === "report-templates";
}

export function buildSettingPayload(resource: SettingResource, bodyValue: unknown, update = false) {
  const body = requireObject(bodyValue);
  const status = parseStatus(body.status);
  const sortOrder = body.sortOrder === undefined ? undefined : Number(body.sortOrder);
  if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
    throw new AdminApiError(400, "INVALID_SORT_ORDER", "sortOrder 必须是非负整数。");
  }

  if (resource === "laboratories") {
    const payload: Record<string, unknown> = {};
    if (!update || body.code !== undefined) payload.code = requireText(body.code, "code", 64);
    if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
    if (body.location !== undefined) payload.location = optionalText(body.location, "location", 255) ?? null;
    if (body.managerId !== undefined) payload.manager_id = optionalUuid(body.managerId, "managerId");
    if (status !== undefined) payload.status = status;
    return payload;
  }

  if (resource === "departments" || resource === "groups") {
    const payload: Record<string, unknown> = {};
    if (!update || body.laboratoryId !== undefined) payload.laboratory_id = requireId(String(body.laboratoryId));
    if (!update || body.code !== undefined) payload.code = requireText(body.code, "code", 64);
    if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
    if (resource === "departments" && body.parentId !== undefined) payload.parent_id = optionalId(body.parentId);
    if (resource === "groups" && body.leaderId !== undefined) payload.leader_id = optionalUuid(body.leaderId, "leaderId");
    if (status !== undefined) payload.status = status;
    return payload;
  }

  if (resource === "categories") {
    const payload: Record<string, unknown> = {};
    if (!update || body.categoryType !== undefined) payload.category_type = requireText(body.categoryType, "categoryType", 32);
    if (!update || body.code !== undefined) payload.code = requireText(body.code, "code", 64);
    if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
    if (body.parentId !== undefined) payload.parent_id = optionalId(body.parentId);
    if (body.description !== undefined) payload.description = optionalText(body.description, "description", 255) ?? null;
    if (sortOrder !== undefined) payload.sort_order = sortOrder;
    if (status !== undefined) payload.status = status;
    return payload;
  }

  if (resource === "units") {
    const payload: Record<string, unknown> = {};
    if (!update || body.code !== undefined) payload.code = requireText(body.code, "code", 32);
    if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 64);
    if (body.symbol !== undefined) payload.symbol = optionalText(body.symbol, "symbol", 32) ?? null;
    if (body.dimension !== undefined) payload.dimension = optionalText(body.dimension, "dimension", 32) ?? null;
    if (sortOrder !== undefined) payload.sort_order = sortOrder;
    if (status !== undefined) payload.status = status;
    return payload;
  }

  if (resource === "report-templates") {
    const code = body.code === undefined && update ? undefined : requireText(body.code, "code", 64);
    if (code !== undefined && !/^REPORT_TEMPLATE_[A-Z0-9_]+$/.test(code)) throw new AdminApiError(400, "INVALID_REPORT_TEMPLATE_CODE", "报告模板编码必须使用 REPORT_TEMPLATE_ 前缀。");
    if (body.valueType !== undefined && body.valueType !== "JSON") throw new AdminApiError(400, "INVALID_REPORT_TEMPLATE", "报告模板 valueType 必须为 JSON。");
    const payload: Record<string, unknown> = {};
    if (!update || body.code !== undefined) payload.code = code;
    if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
    if (!update || body.value !== undefined) payload.value_json = parseReportTemplateValue(body.value);
    payload.value_type = "JSON";
    if (body.description !== undefined) payload.description = optionalText(body.description, "description", 255) ?? null;
    if (status !== undefined) payload.status = status;
    return payload;
  }

  const valueType = body.valueType === undefined ? undefined : requireText(body.valueType, "valueType", 16);
  const payload: Record<string, unknown> = {};
  if (!update || body.code !== undefined) payload.code = requireText(body.code, "code", 64);
  if (!update || body.name !== undefined) payload.name = requireText(body.name, "name", 128);
  if (!update || body.valueType !== undefined) payload.value_type = valueType;
  if (!update || body.value !== undefined) {
    if (!valueType) throw new AdminApiError(400, "INVALID_PARAMETER_TYPE", "修改参数值时必须提供 valueType。");
    payload.value_json = parseParameterValue(body.value, valueType);
  }
  if (body.description !== undefined) payload.description = optionalText(body.description, "description", 255) ?? null;
  if (status !== undefined) payload.status = status;
  return payload;
}

export function serializeSetting(resource: SettingResource, value: unknown) {
  const row = value as Record<string, unknown>;
  const base = {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (resource === "laboratories") return { ...base, location: row.location, managerId: row.manager_id };
  if (resource === "departments") return { ...base, laboratoryId: row.laboratory_id, parentId: row.parent_id };
  if (resource === "groups") return { ...base, laboratoryId: row.laboratory_id, leaderId: row.leader_id };
  if (resource === "categories") return { ...base, categoryType: row.category_type, parentId: row.parent_id, description: row.description, sortOrder: row.sort_order };
  if (resource === "units") return { ...base, symbol: row.symbol, dimension: row.dimension, sortOrder: row.sort_order };
  return { ...base, valueType: row.value_type, value: row.value_json, description: row.description };
}

export async function validateSettingParent(
  supabase: SupabaseClient<Database>,
  resource: SettingResource,
  payload: Record<string, unknown>,
  currentId?: number,
) {
  if (resource === "departments") {
    if (payload.parent_id === undefined || payload.parent_id === null) return;
    const { data: parent, error } = await supabase.from("lab_department").select("id, laboratory_id, parent_id").eq("id", payload.parent_id as number).maybeSingle();
    if (error || !parent) throw new AdminApiError(400, "INVALID_PARENT", "部门父节点不存在。");
    if (payload.laboratory_id !== undefined && parent.laboratory_id !== payload.laboratory_id) throw new AdminApiError(400, "INVALID_PARENT", "部门父节点必须属于同一实验室。");
    if (currentId && parent.id === currentId) throw new AdminApiError(400, "INVALID_PARENT", "不能将自身设为父节点。");
  }
  if (resource === "categories") {
    if (payload.parent_id === undefined || payload.parent_id === null) return;
    const { data: parent, error } = await supabase.from("sys_category").select("id, category_type").eq("id", payload.parent_id as number).maybeSingle();
    if (error || !parent) throw new AdminApiError(400, "INVALID_PARENT", "分类父节点不存在。");
    if (payload.category_type !== undefined && parent.category_type !== payload.category_type) throw new AdminApiError(400, "INVALID_PARENT", "分类父节点必须属于同一分类类型。");
    if (currentId && parent.id === currentId) throw new AdminApiError(400, "INVALID_PARENT", "不能将自身设为父节点。");
  }
}

export function mapSettingDatabaseError(error: SettingsDbError | null, resource: SettingResource) {
  if (!error) return;
  if (error.code === "23505") throw new AdminApiError(409, "SETTING_CODE_EXISTS", "设置编码已经存在。");
  if (error.code === "23503") throw new AdminApiError(400, "INVALID_REFERENCE", "设置引用的对象不存在或不能修改。");
  throw new AdminApiError(500, resource === "parameters" ? "SETTINGS_PARAMETER_FAILED" : "SETTINGS_DATABASE_FAILED", "设置数据操作失败。");
}

export async function auditSetting(
  supabase: SupabaseClient<Database>,
  objectType: string,
  objectId: string,
  action: string,
  before: Json | null,
  after: Json | null,
) {
  await recordAudit(supabase, "settings.manage", objectType, objectId, action, before, after);
}
