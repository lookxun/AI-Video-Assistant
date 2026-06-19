import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function normalizeUrl(value) {
  return typeof value === "string" ? value.trim().split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/i, "") : "";
}

function loadJobs() {
  const file = ".runtime/media-save-jobs.json";
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.jobs) ? parsed.jobs : [];
}

loadEnv();

const userId = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length) || process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/audit-visible-duplicate-media.mjs --user=USER_ID");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.mediaAsset.findMany({
    where: { userId, archivedAt: null, userStates: { some: { hiddenAt: null } } },
    select: { id: true, mediaType: true, url: true, normalizedUrl: true, creditLedgerId: true, userStates: { where: { hiddenAt: null }, select: { currentName: true, currentCategory: true } } },
  });
  const localByRemote = new Map();
  for (const job of loadJobs().filter((job) => !job.userId || job.userId === userId)) {
    const remote = normalizeUrl(job.remoteUrl);
    const local = normalizeUrl(job.localUrl);
    if (remote && local) localByRemote.set(remote, local);
  }

  const byCanonical = new Map();
  for (const row of rows) {
    const normalized = normalizeUrl(row.normalizedUrl || row.url);
    const canonical = localByRemote.get(normalized) || normalized;
    const key = `${row.mediaType}:${canonical}`;
    const list = byCanonical.get(key) || [];
    list.push(row);
    byCanonical.set(key, list);
  }

  const duplicates = Array.from(byCanonical.entries()).filter(([, list]) => list.length > 1);
  console.log(JSON.stringify({
    userId,
    visibleMedia: rows.length,
    visibleDuplicateGroups: duplicates.length,
    visibleDuplicateItemsExtra: duplicates.reduce((sum, [, list]) => sum + list.length - 1, 0),
    samples: duplicates.slice(0, 10).map(([key, list]) => ({
      key,
      items: list.map((row) => ({ id: row.id, name: row.userStates[0]?.currentName, category: row.userStates[0]?.currentCategory, hasLedger: Boolean(row.creditLedgerId), url: row.url.slice(0, 140) })),
    })),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
