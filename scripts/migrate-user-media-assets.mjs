import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const userArg = args.find((arg) => arg.startsWith("--user="));
const userId = userArg?.slice("--user=".length)?.trim();
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify-only");

const root = process.cwd();

function rel(file) {
  return path.join(root, file);
}

function assertFile(file) {
  if (!fs.existsSync(rel(file))) {
    console.error(`Missing required script: ${file}`);
    process.exit(1);
  }
}

function run(file, scriptArgs) {
  const display = ["node", file, ...scriptArgs].join(" ");
  console.log(`\n$ ${display}`);
  const result = spawnSync(process.execPath, [rel(file), ...scriptArgs], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!userId) {
  console.error("Usage: node scripts/migrate-user-media-assets.mjs --user=USER_ID [--apply|--verify-only]");
  console.error("Default mode is dry-run. Add --apply only after reviewing every dry-run output.");
  process.exit(1);
}

const required = [
  "scripts/rebuild-media-asset-registry.mjs",
  "tmp/merge-duplicate-media.js",
  "tmp/enrich-media-assets-from-sources.js",
  "tmp/enrich-media-thumbnails.js",
  "tmp/verify-visible-media-after-merge.js",
  "tmp/verify-media-costs.js",
  "tmp/count-user-media-breakdown.js",
  "tmp/audit-duplicate-media-summary.js",
  "scripts/audit-visible-duplicate-media.mjs",
  "scripts/audit-user-media-cost-gaps.mjs",
];

for (const file of required) assertFile(file);

const userFlag = `--user=${userId}`;

if (!verifyOnly) {
  run("scripts/rebuild-media-asset-registry.mjs", ["--dry-run", userFlag]);
  if (apply) run("scripts/rebuild-media-asset-registry.mjs", [userFlag]);

  run("tmp/merge-duplicate-media.js", ["--dry-run", userFlag]);
  if (apply) run("tmp/merge-duplicate-media.js", [userFlag]);

  run("tmp/enrich-media-assets-from-sources.js", ["--dry-run", userFlag]);
  if (apply) run("tmp/enrich-media-assets-from-sources.js", [userFlag]);

  run("tmp/enrich-media-thumbnails.js", ["--dry-run", userFlag]);
  if (apply) run("tmp/enrich-media-thumbnails.js", [userFlag]);
}

run("tmp/verify-visible-media-after-merge.js", [userId]);
run("tmp/verify-media-costs.js", [userId]);
run("tmp/count-user-media-breakdown.js", [userId]);
run("tmp/audit-duplicate-media-summary.js", [userId]);
run("scripts/audit-visible-duplicate-media.mjs", [userId]);
run("scripts/audit-user-media-cost-gaps.mjs", [userId]);

if (!apply && !verifyOnly) {
  console.log("\nDry-run complete. Re-run with --apply only after the outputs look correct.");
}
