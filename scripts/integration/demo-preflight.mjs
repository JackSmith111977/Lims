import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEMO_ENVIRONMENT_PATH = path.join("docs", "demo", "demo-environment.json");
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

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

export function loadDemoEnvironment(configPath = DEMO_ENVIRONMENT_PATH) {
  const absolutePath = path.resolve(configPath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

export function runPreflight({ configPath = DEMO_ENVIRONMENT_PATH, runtimeEnv = process.env } = {}) {
  try {
    return validateDemoEnvironment(loadDemoEnvironment(configPath), runtimeEnv);
  } catch (error) {
    return {
      ok: false,
      errors: [`unable to read demo environment config: ${error instanceof Error ? error.message : "unknown error"}`],
      summary: { configPath: path.resolve(configPath) },
    };
  }
}

export function main() {
  const result = runPreflight();
  const output = JSON.stringify(result);
  if (result.ok) {
    console.log(`Demo preflight: PASSED ${output}`);
  } else {
    console.error(`Demo preflight: BLOCKED ${output}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
