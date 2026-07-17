import { describe, expect, it } from "vitest";

import { validateDemoEnvironment } from "../../scripts/integration/demo-preflight.mjs";

const approvedConfig = {
  scenarioId: "DEMO-LIMS-001",
  status: "approved",
  isolated: true,
  projectRef: "abcdefghijklmnopqrst",
  baseUrl: "https://demo.example.invalid",
  prefix: "DEMO_",
  forbiddenProjectRefs: ["fofjsknqdrmgyxtxwxwo"],
  accounts: [
    { roleCode: "SYSTEM_ADMIN", email: "<demo-admin@example.invalid>" },
    { roleCode: "RESEARCHER", email: "<demo-operator@example.invalid>" },
    { roleCode: "PROJECT_LEAD", email: "<demo-reviewer@example.invalid>" },
  ],
};

describe("demo environment preflight", () => {
  it("accepts an approved isolated environment with a matching Supabase URL", () => {
    expect(validateDemoEnvironment(approvedConfig, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    }).ok).toBe(true);
  });

  it("accepts real non-deliverable example.invalid addresses after placeholders are provisioned", () => {
    const config = {
      ...approvedConfig,
      accounts: approvedConfig.accounts.map((account) => ({
        ...account,
        email: account.email.slice(1, -1),
      })),
    };
    expect(validateDemoEnvironment(config, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    }).ok).toBe(true);
  });

  it("rejects the repository's production project even if someone marks it approved", () => {
    expect(validateDemoEnvironment({ ...approvedConfig, projectRef: "fofjsknqdrmgyxtxwxwo" }).errors)
      .toContain("projectRef is explicitly forbidden for demo data");
  });

  it("rejects blocked or non-isolated configuration", () => {
    const result = validateDemoEnvironment({ ...approvedConfig, status: "blocked", isolated: false, projectRef: null });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "environment status must be approved before any demo write",
      "isolated must be true; production projects are not valid demo targets",
      "projectRef must be a valid Supabase project ref",
    ]));
  });

  it("rejects a mismatched application URL or credential-shaped account config", () => {
    const result = validateDemoEnvironment({
      ...approvedConfig,
      accounts: [{ ...approvedConfig.accounts[0], password: "do-not-store" }, ...approvedConfig.accounts.slice(1)],
    }, { NEXT_PUBLIC_SUPABASE_URL: "https://another-project.supabase.co" });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "demo account configuration must not contain credentials",
      "application Supabase URL does not match the approved project ref",
    ]));
  });
});
