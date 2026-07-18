import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const DEMO_ENVIRONMENT_PATH = path.join("docs", "demo", "demo-environment.json");
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

export function loadRuntimeEnvironment(cwd = process.cwd()) {
  const { combinedEnv } = loadEnvConfig(cwd, false, { info: () => {}, error: () => {} }, true);
  return combinedEnv;
}

export function inspectLegacySupabaseKey(token) {
  if (typeof token !== "string" || token.split(".").length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return {
      projectRef: typeof payload?.ref === "string" ? payload.ref : null,
      role: typeof payload?.role === "string" ? payload.role : null,
    };
  } catch {
    return null;
  }
}

function isModernSupabaseKey(token, prefix) {
  return typeof token === "string" && token.startsWith(prefix);
}

export function validateDemoEnvironment(config, runtimeEnv = {}) {
  const errors = [];
  const projectRef = typeof config?.projectRef === "string" ? config.projectRef : null;
  const baseUrl = typeof config?.baseUrl === "string" ? config.baseUrl : null;
  const forbiddenProjectRefs = Array.isArray(config?.forbiddenProjectRefs) ? config.forbiddenProjectRefs : [];

  if (config?.scenarioId !== "DEMO-LIMS-001") errors.push("scenarioId must be DEMO-LIMS-001");
  if (config?.status !== "approved") errors.push("environment status must be approved before any demo write");
  if (config?.isolated !== true) errors.push("isolated must be true; production projects are not valid demo targets");
  if (!projectRef || !PROJECT_REF_PATTERN.test(projectRef)) errors.push("projectRef must be a valid Supabase project ref");
  if (projectRef && forbiddenProjectRefs.includes(projectRef)) errors.push("projectRef is explicitly forbidden for demo data");
  if (config?.prefix !== "DEMO_") errors.push("prefix must be DEMO_");

  if (!baseUrl) {
    errors.push("baseUrl is required for the isolated demo application");
  } else {
    try {
      const parsed = new URL(baseUrl);
      if (!/^https?:$/.test(parsed.protocol)) errors.push("baseUrl must use http or https");
    } catch {
      errors.push("baseUrl must be a valid URL");
    }
  }

  const accounts = Array.isArray(config?.accounts) ? config.accounts : [];
  if (accounts.length !== 3) errors.push("exactly three demo account placeholders are required");
  for (const account of accounts) {
    if (typeof account?.email !== "string" || !/^<?[^<>\s@]+@example\.invalid>?$/.test(account.email)) {
      errors.push("demo accounts must use non-deliverable example.invalid placeholders");
      break;
    }
    if (Object.keys(account).some((key) => /password|token|secret|key/i.test(key))) {
      errors.push("demo account configuration must not contain credentials");
      break;
    }
  }

  const configuredSupabaseUrl = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (configuredSupabaseUrl && projectRef) {
    try {
      const host = new URL(configuredSupabaseUrl).hostname;
      if (host !== `${projectRef}.supabase.co`) errors.push("application Supabase URL does not match the approved project ref");
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
    }
  }
  const publicKeyClaims = inspectLegacySupabaseKey(runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (publicKeyClaims && publicKeyClaims.role !== "anon") {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must contain an anon key");
  }
  if (publicKeyClaims && publicKeyClaims.projectRef !== projectRef) {
    errors.push("public Supabase key does not match the approved project ref");
  }
  const serverKeyClaims = inspectLegacySupabaseKey(runtimeEnv.SUPABASE_SERVICE_ROLE_KEY);
  if (serverKeyClaims && serverKeyClaims.role !== "service_role") {
    errors.push("SUPABASE_SERVICE_ROLE_KEY must contain a service_role key");
  }
  if (serverKeyClaims && serverKeyClaims.projectRef !== projectRef) {
    errors.push("server-only Supabase key does not match the approved project ref");
  }
  if (runtimeEnv.DEMO_PROJECT_REF && runtimeEnv.DEMO_PROJECT_REF !== projectRef) {
    errors.push("DEMO_PROJECT_REF does not match the approved project ref");
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      scenarioId: config?.scenarioId ?? null,
      status: config?.status ?? null,
      isolated: config?.isolated === true,
      projectRef,
      baseUrl,
      prefix: config?.prefix ?? null,
    },
  };
}

export async function validateRuntimeSupabaseKeys({ config, runtimeEnv = {}, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const errors = [];
  const projectRef = typeof config?.projectRef === "string" ? config.projectRef : null;
  if (!projectRef) return ["cannot verify Supabase keys without an approved project ref"];

  const checks = [
    {
      envName: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      modernPrefix: "sb_publishable_",
      legacyRole: "anon",
      label: "public Supabase key",
    },
    {
      envName: "SUPABASE_SERVICE_ROLE_KEY",
      value: runtimeEnv.SUPABASE_SERVICE_ROLE_KEY,
      modernPrefix: "sb_secret_",
      legacyRole: "service_role",
      label: "server-only Supabase key",
    },
  ];

  for (const check of checks) {
    if (typeof check.value !== "string" || check.value.length === 0) {
      errors.push(`${check.envName} is required for the isolated demo`);
      continue;
    }

    const legacyClaims = inspectLegacySupabaseKey(check.value);
    if (legacyClaims) {
      if (legacyClaims.role !== check.legacyRole) errors.push(`${check.envName} must contain a ${check.legacyRole} key`);
      if (legacyClaims.projectRef !== projectRef) errors.push(`${check.label} does not match the approved project ref`);
      continue;
    }
    if (!isModernSupabaseKey(check.value, check.modernPrefix)) {
      errors.push(`${check.envName} has an unsupported key format`);
      continue;
    }
    if (typeof fetchImpl !== "function") {
      errors.push(`${check.label} cannot be verified because fetch is unavailable`);
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`https://${projectRef}.supabase.co/auth/v1/health`, {
        headers: { apikey: check.value },
        signal: controller.signal,
      });
      if (!response.ok) errors.push(`${check.label} was rejected by the approved project`);
    } catch {
      errors.push(`${check.label} could not be verified against the approved project`);
    } finally {
      clearTimeout(timer);
    }
  }

  return errors;
}

export function loadDemoEnvironment(configPath = DEMO_ENVIRONMENT_PATH) {
  const absolutePath = path.resolve(configPath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

export function runPreflight({ configPath = DEMO_ENVIRONMENT_PATH, runtimeEnv, cwd = process.cwd() } = {}) {
  try {
    return validateDemoEnvironment(loadDemoEnvironment(configPath), runtimeEnv ?? loadRuntimeEnvironment(cwd));
  } catch (error) {
    return {
      ok: false,
      errors: [`unable to read demo environment config: ${error instanceof Error ? error.message : "unknown error"}`],
      summary: { configPath: path.resolve(configPath) },
    };
  }
}

export async function runConnectedPreflight(options = {}) {
  const result = runPreflight(options);
  if (!result.ok) return result;
  const runtimeEnv = options.runtimeEnv ?? loadRuntimeEnvironment(options.cwd ?? process.cwd());
  const config = loadDemoEnvironment(options.configPath ?? DEMO_ENVIRONMENT_PATH);
  const keyErrors = await validateRuntimeSupabaseKeys({ config, runtimeEnv, fetchImpl: options.fetchImpl });
  return { ...result, ok: keyErrors.length === 0, errors: [...result.errors, ...keyErrors] };
}

export async function main() {
  const result = await runConnectedPreflight();
  const output = JSON.stringify(result);
  if (result.ok) {
    console.log(`Demo preflight: PASSED ${output}`);
  } else {
    console.error(`Demo preflight: BLOCKED ${output}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Demo preflight: BLOCKED ${JSON.stringify({ ok: false, errors: [error instanceof Error ? error.message : "unknown error"] })}`);
    process.exitCode = 1;
  });
}
