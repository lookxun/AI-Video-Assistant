import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const usersArg = args.find((arg) => arg.startsWith("--users="))?.slice("--users=".length) || "";
const users = usersArg.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
const logDir = args.find((arg) => arg.startsWith("--log-dir="))?.slice("--log-dir=".length) || ".runtime/media-migration-logs";

if (users.length === 0) {
  console.error("Usage: node scripts/migrate-selected-media-users.mjs --users=ID_1,ID_2 [--apply] [--log-dir=.runtime/media-migration-logs]");
  process.exit(1);
}

function runCapture(script, scriptArgs) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    const error = new Error(`${script} failed with exit ${result.status}`);
    error.stdout = result.stdout || "";
    error.stderr = result.stderr || "";
    throw error;
  }
  return result.stdout || "";
}

function writeLog(userId, text) {
  fs.mkdirSync(logDir, { recursive: true });
  const file = path.join(logDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${userId}.log`);
  fs.writeFileSync(file, text, "utf8");
  return file;
}

function parseJsonOutput(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  return JSON.parse(output.slice(start, end + 1));
}

const results = [];

for (const userId of users) {
  console.log(`migrating:${userId}`);
  let logText = "";
  try {
    const migrateArgs = [`--user=${userId}`];
    if (apply) migrateArgs.push("--apply");
    const migrateOutput = runCapture("scripts/migrate-user-media-assets.mjs", migrateArgs);
    logText += migrateOutput;

    const visible = parseJsonOutput(runCapture("scripts/audit-visible-duplicate-media.mjs", [`--user=${userId}`]));
    const costs = parseJsonOutput(runCapture("scripts/audit-user-media-cost-gaps.mjs", [`--user=${userId}`]));
    const verify = parseJsonOutput(runCapture("tmp/verify-visible-media-after-merge.js", [userId]));
    const logFile = writeLog(userId, logText);

    const result = {
      userId,
      logFile,
      visibleMedia: verify?.visibleMedia,
      archivedMedia: verify?.archivedMedia,
      visibleCategories: verify?.visibleCategories,
      visibleDuplicateGroups: visible?.visibleDuplicateGroups,
      unmatchedLedgers: costs?.unmatchedLedgers,
      unmatchedByReason: costs?.unmatchedByReason,
    };
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const logFile = writeLog(userId, `${logText}\n${error.stdout || ""}\n${error.stderr || ""}\n${error.stack || error.message}`);
    console.error(JSON.stringify({ userId, failed: true, logFile, message: error.message }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({ apply, users: users.length, results }, null, 2));
