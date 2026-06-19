const fs = require("fs");
const { spawnSync } = require("child_process");

const envText = fs.readFileSync(".env.local", "utf8");
const line = envText.split(/\r?\n/).find((item) => item.trim().startsWith("DATABASE_URL=") && item.includes("postgres"));
if (!line) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}
const databaseUrl = line.trim().slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
const args = process.argv.slice(2);
const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
process.exit(result.status ?? 1);
