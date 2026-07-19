import { describe, expect, it } from "vitest";

import {
  AdminApiError,
  parseStringArray,
  requireId,
  requireText,
  requireUuid,
} from "@/lib/server/admin";
import { buildSettingPayload } from "@/lib/server/settings";

describe("admin API validation", () => {
  it("deduplicates role and permission codes", () => {
    expect(parseStringArray(["SYSTEM_ADMIN", "SYSTEM_ADMIN", ""], "role_codes")).toEqual(["SYSTEM_ADMIN"]);
  });

  it("rejects non-array role input", () => {
    expect(() => parseStringArray("SYSTEM_ADMIN", "role_codes")).toThrowError(AdminApiError);
    try {
      parseStringArray("SYSTEM_ADMIN", "role_codes");
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "INVALID_FIELD" });
    }
  });

  it("validates UUID and numeric identifiers", () => {
    expect(requireUuid("feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5")).toBe("feb25d2c-daef-4c8b-abb5-fdbb5f5dd2c5");
    expect(requireId("12")).toBe(12);
    expect(() => requireUuid("not-a-uuid")).toThrowError(AdminApiError);
    expect(() => requireId("0")).toThrowError(AdminApiError);
  });

  it("trims required text and rejects blank values", () => {
    expect(requireText("  admin  ", "username", 64)).toBe("admin");
    expect(() => requireText(" ", "username", 64)).toThrowError(AdminApiError);
  });

  it("normalizes settings payloads and parameter values", () => {
    expect(buildSettingPayload("categories", {
      categoryType: "SAMPLE",
      code: "  BIO  ",
      name: "生物样品",
      parentId: null,
    })).toMatchObject({ category_type: "SAMPLE", code: "BIO", parent_id: null });
    expect(buildSettingPayload("parameters", {
      code: "sample.default.unit",
      name: "默认单位",
      valueType: "STRING",
      value: "g",
    })).toMatchObject({ value_type: "STRING", value_json: "g" });
  });

  it("rejects invalid typed system parameters", () => {
    expect(() => buildSettingPayload("parameters", {
      code: "invalid.number",
      name: "无效数字",
      valueType: "NUMBER",
      value: "not-a-number",
    })).toThrowError(AdminApiError);
  });

  it("validates report template resources as JSON with a reserved code prefix", () => {
    expect(buildSettingPayload("report-templates", {
      code: "REPORT_TEMPLATE_DEFAULT",
      name: "默认报告模板",
      value: JSON.stringify({ title: "实验报告", fields: ["task", "data"] }),
    })).toMatchObject({ code: "REPORT_TEMPLATE_DEFAULT", value_type: "JSON", value_json: { fields: ["task", "data"] } });
    expect(buildSettingPayload("report-templates", {
      value: JSON.stringify({ title: "更新后的报告模板", fields: ["task", "samples", "data"] }),
    }, true)).toMatchObject({ value_type: "JSON", value_json: { fields: ["task", "samples", "data"] } });
    expect(() => buildSettingPayload("report-templates", { code: "OTHER", name: "bad", value: "{}" })).toThrowError(AdminApiError);
    expect(() => buildSettingPayload("report-templates", { code: "REPORT_TEMPLATE_BAD", name: "bad", value: JSON.stringify({ fields: [] }) })).toThrowError(AdminApiError);
  });
});
