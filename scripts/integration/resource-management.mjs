import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const checks = [
  ["test:instrument-integration", "设备档案、维护校准、数据关联和审计"],
  ["test:inventory-integration", "试剂耗材、库存变动、并发余额和审计"],
];

const failures = [];
for (const [script, description] of checks) {
  try {
    const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", `npm.cmd run ${script}`] : ["run", script];
    const result = await execFileAsync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    const output = result.stdout.trim();
    console.log(JSON.stringify({ script, description, ok: true, output: output ? output.split(/\r?\n/).slice(-2) : [] }));
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    failures.push({ script, description, message: error instanceof Error ? error.message : "unknown error", output: output ? output.split(/\r?\n/).slice(-4) : [] });
    console.error(JSON.stringify({ script, description, ok: false, message: failures.at(-1).message, output: failures.at(-1).output }));
  }
}

if (failures.length > 0) {
  throw new Error(`Resource management integration failed: ${failures.map(({ script }) => script).join(", ")}`);
}

console.log(JSON.stringify({ ok: true, checks: checks.map(([script, description]) => ({ script, description })) }));
