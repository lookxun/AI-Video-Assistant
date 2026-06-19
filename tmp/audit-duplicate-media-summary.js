const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
  if (key && !(key in process.env)) process.env[key] = value;
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

async function main() {
  const userId = process.argv[2] || "ID_636611";
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.mediaAsset.findMany({ where: { userId }, select: { id: true, mediaType: true, url: true, normalizedUrl: true, sourceKind: true, creditLedgerId: true, requestId: true, firstSeenAt: true, userStates: { select: { currentName: true, currentCategory: true } } } });
    const jobs = loadJobs().filter((job) => !job.userId || job.userId === userId);
    const localByRemote = new Map();
    for (const job of jobs) {
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
      list.push({ ...row, canonical, isRemote: /^https?:\/\//i.test(row.url), isLocal: row.url.startsWith("/generated/") });
      byCanonical.set(key, list);
    }
    const duplicates = Array.from(byCanonical.entries()).filter(([, list]) => list.length > 1);
    const remoteLocal = duplicates.filter(([, list]) => list.some((row) => row.isRemote) && list.some((row) => row.isLocal));
    const sameLocal = duplicates.filter(([, list]) => list.filter((row) => row.isLocal).length > 1);
    console.log(JSON.stringify({
      userId,
      total: rows.length,
      duplicateCanonicalGroups: duplicates.length,
      duplicateItemsExtra: duplicates.reduce((sum, [, list]) => sum + list.length - 1, 0),
      remoteLocalGroups: remoteLocal.length,
      sameLocalGroups: sameLocal.length,
      sampleRemoteLocal: remoteLocal.slice(0, 8).map(([key, list]) => ({ key, items: list.map((row) => ({ id: row.id, name: row.userStates[0]?.currentName, category: row.userStates[0]?.currentCategory, urlType: row.isLocal ? "local" : "remote", sourceKind: row.sourceKind, hasLedger: Boolean(row.creditLedgerId), requestId: row.requestId, firstSeenAt: row.firstSeenAt.toISOString(), url: row.url.slice(0, 130) })) })),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
