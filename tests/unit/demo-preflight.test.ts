import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resetEnv } from "@next/env";
import { describe, expect, it, vi } from "vitest";

import { runPreflight, validateDemoEnvironment, validateRuntimeSupabaseKeys } from "../../scripts/integration/demo-preflight.mjs";

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

function fakeLegacySupabaseKey(payload: Record<string, unknown>) {
  return ["header", Buffer.from(JSON.stringify(payload)).toString("base64url"), "signature"].join(".");
}

describe("demo environment preflight", () => {
  it("accepts an approved isolated environment with a matching Supabase URL", () => {
    expect(validateDemoEnvironment(approvedConfig, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: fakeLegacySupabaseKey({ ref: "abcdefghijklmnopqrst", role: "service_role" }),
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
      SUPABASE_SERVICE_ROLE_KEY: fakeLegacySupabaseKey({ ref: "abcdefghijklmnopqrst", role: "service_role" }),
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

  it("rejects a legacy server key from a different Supabase project", () => {
    const result = validateDemoEnvironment(approvedConfig, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: fakeLegacySupabaseKey({ ref: "fofjsknqdrmgyxtxwxwo", role: "service_role" }),
    });
    expect(result.errors).toContain("server-only Supabase key does not match the approved project ref");
  });

  it("rejects a legacy non-service key in the server-only slot", () => {
    const result = validateDemoEnvironment(approvedConfig, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: fakeLegacySupabaseKey({ ref: "abcdefghijklmnopqrst", role: "anon" }),
    });
    expect(result.errors).toContain("SUPABASE_SERVICE_ROLE_KEY must contain a service_role key");
  });

  it("rejects a legacy public key from a different Supabase project", () => {
    const result = validateDemoEnvironment(approvedConfig, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeLegacySupabaseKey({ ref: "fofjsknqdrmgyxtxwxwo", role: "anon" }),
    });
    expect(result.errors).toContain("public Supabase key does not match the approved project ref");
  });

  it("verifies modern publishable and secret keys against the approved project", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const keyErrors = await validateRuntimeSupabaseKeys({
      config: approvedConfig,
      runtimeEnv: {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_demo",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_demo",
      },
      fetchImpl,
    });
    expect(keyErrors).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a modern key is rejected by the approved project", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));
    const keyErrors = await validateRuntimeSupabaseKeys({
      config: approvedConfig,
      runtimeEnv: {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_wrong",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_wrong",
      },
      fetchImpl,
    });
    expect(keyErrors).toEqual([
      "public Supabase key was rejected by the approved project",
      "server-only Supabase key was rejected by the approved project",
    ]);
  });

  it("loads the actual Next.js env files when no runtime override is provided", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "lims-demo-preflight-"));
    const configPath = path.join(cwd, "demo-environment.json");
    writeFileSync(path.join(cwd, ".env.test.local"), "NEXT_PUBLIC_SUPABASE_URL=https://another-project.supabase.co\n");
    writeFileSync(configPath, JSON.stringify(approvedConfig));

    try {
      const result = runPreflight({ configPath, cwd });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("application Supabase URL does not match the approved project ref");
    } finally {
      resetEnv();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
