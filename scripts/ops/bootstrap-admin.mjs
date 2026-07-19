import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envFile = process.env.BOOTSTRAP_ENV_FILE ?? ".env.local";
  const values = Object.fromEntries(
    fs.readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      }),
  );
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Missing Supabase URL or service role key in ${envFile}`);
  }
  return values;
}

function requireEmail(value) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address");
  }
  return email;
}

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findAuthUser(service, email) {
  const result = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = must(result, "list Auth users");
  return users.users.find((user) => user.email?.toLowerCase() === email) ?? null;
}

async function main() {
  const env = loadEnv();
  const email = requireEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const dryRun = process.argv.includes("--dry-run");
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const role = must(
    await service.from("sys_role").select("id, code, status").eq("code", "SYSTEM_ADMIN").single(),
    "read SYSTEM_ADMIN role",
  );
  if (role.status !== "ACTIVE") throw new Error("SYSTEM_ADMIN role is not ACTIVE");

  let authUser = await findAuthUser(service, email);
  let createdUser = false;
  if (!authUser) {
    if (dryRun) {
      console.log(JSON.stringify({ dryRun: true, email, wouldCreateUser: true, wouldAssignRole: true }));
      return;
    }
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!password || password.length < 8) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters when creating a user");
    }
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim() || email.split("@", 1)[0];
    const realName = process.env.BOOTSTRAP_ADMIN_REAL_NAME?.trim() || "系统管理员";
    const result = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, real_name: realName },
    });
    authUser = must(result, "create Auth user").user;
    if (!authUser) throw new Error("create Auth user: missing user");
    createdUser = true;
  }

  const profile = must(
    await service.from("sys_user").select("id, status").eq("id", authUser.id).maybeSingle(),
    "read business user profile",
  );
  if (profile?.status === "INACTIVE") throw new Error("target business user is INACTIVE; refusing to reactivate it");
  if (!profile) {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim() || email.split("@", 1)[0];
    const realName = process.env.BOOTSTRAP_ADMIN_REAL_NAME?.trim() || "系统管理员";
    must(
      await service.from("sys_user").insert({ id: authUser.id, username, real_name: realName, email }),
      "create business user profile",
    );
  }

  const currentRole = must(
    await service.from("sys_user_role").select("user_id").eq("user_id", authUser.id).eq("role_id", role.id).maybeSingle(),
    "read current SYSTEM_ADMIN assignment",
  );
  let roleAssigned = false;
  if (!currentRole) {
    if (dryRun) {
      console.log(JSON.stringify({ dryRun: true, email, userId: authUser.id, createdUser, wouldAssignRole: true }));
      return;
    }
    must(
      await service.from("sys_user_role").insert({ user_id: authUser.id, role_id: role.id }),
      "assign SYSTEM_ADMIN role",
    );
    roleAssigned = true;
  }

  if (roleAssigned) {
    must(
      await service.from("audit_log").insert({
        operator_id: null,
        object_type: "sys_user",
        object_id: authUser.id,
        action: "BOOTSTRAP_ADMIN",
        after_json: { role: "SYSTEM_ADMIN", source: "controlled-bootstrap-script" },
      }),
      "write bootstrap audit",
    );
  }

  console.log(JSON.stringify({ email, userId: authUser.id, createdUser, roleAssigned, role: "SYSTEM_ADMIN" }));
}

main().catch((error) => {
  console.error(`Admin bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
