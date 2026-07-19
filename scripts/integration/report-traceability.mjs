import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

try {
  if (!process.env.REPORT_BASE_URL) throw new Error("REPORT_BASE_URL is required for report traceability integration");
  const result = await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run test:report-integration"], {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log(JSON.stringify({ ok: true, checks: ["immutable report snapshot contains task/sample/data/review chain", "report snapshot version stability", "report read-only boundary", "temporary report resource cleanup"] }));
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  console.error(`Report traceability integration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
