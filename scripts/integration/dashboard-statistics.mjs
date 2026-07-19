import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

if (!process.env.DASHBOARD_BASE_URL) {
  console.error("Dashboard integration requires DASHBOARD_BASE_URL pointing to a running application.");
  process.exitCode = 1;
} else {
  try {
    const result = await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run test:processing-integration"], {
      cwd: process.cwd(),
      env: { ...process.env, DASHBOARD_ASSERT: "1" },
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    console.log(JSON.stringify({ ok: true, checks: ["filtered sample and task statistics", "pending review list", "flagged processing anomaly", "task statistics endpoint parity", "inventory dashboard endpoint", "invalid filter rejection", "temporary fixture cleanup"] }));
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    console.error(`Dashboard statistics integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
