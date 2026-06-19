const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function normalizeUrl(value) {
  return typeof value === "string" ? value.trim().split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/i, "") : "";
}

function basenameKey(value) {
  const normalized = normalizeUrl(value);
  const base = path.posix.basename(normalized);
  return base || normalized;
}

function promptKey(value) {
  return typeof value === "string" ? value.replace(/\s+/g, "").slice(0, 120) : "";
}

function hash(value) {
  return crypto.createHash("sha1").update(value || "").digest("hex").slice(0, 12);
}

function groupBy(rows, getKey) {
  const map = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return Array.from(map.entries()).filter(([, list]) => list.length > 1).map(([key, list]) => ({ key, count: list.length, list }));
}

function loadMediaSaveJobs() {
  const file = ".runtime/media-save-jobs.json";
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch {
    return [];
  }
}

async function main() {
  loadEnv();
  const userId = process.argv[2] || "ID_636611";
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.mediaAsset.findMany({
      where: { userId },
      orderBy: [{ firstSeenAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        mediaType: true,
        url: true,
        normalizedUrl: true,
        sourceKind: true,
        sourcePrompt: true,
        creditLedgerId: true,
        requestId: true,
        conversationId: true,
        messageId: true,
        firstSeenAt: true,
        createdAt: true,
        userStates: { select: { id: true, currentName: true, currentCategory: true, deletedAt: true } },
      },
    });
    const jobs = loadMediaSaveJobs().filter((job) => !job.userId || job.userId === userId);
    const localByRemote = new Map();
    const remoteByLocal = new Map();
    for (const job of jobs) {
      const remote = normalizeUrl(job.remoteUrl);
      const local = normalizeUrl(job.localUrl);
      if (remote && local) {
        localByRemote.set(remote, local);
        const list = remoteByLocal.get(local) || [];
        list.push(remote);
        remoteByLocal.set(local, list);
      }
    }

    const rowsWithCanonical = rows.map((row) => {
      const normalized = normalizeUrl(row.normalizedUrl || row.url);
      const canonical = localByRemote.get(normalized) || normalized;
      return { ...row, normalized, canonical, base: basenameKey(canonical), promptHash: hash(promptKey(row.sourcePrompt)), timeBucket: Math.floor(row.firstSeenAt.getTime() / 60000) };
    });

    const canonicalDuplicates = groupBy(rowsWithCanonical, (row) => `${row.mediaType}:${row.canonical}`);
    const basenameDuplicates = groupBy(rowsWithCanonical, (row) => `${row.mediaType}:${row.base}`);
    const promptTimeDuplicates = groupBy(rowsWithCanonical, (row) => `${row.mediaType}:${row.promptHash}:${row.timeBucket}`)
      .filter((group) => group.list.some((row) => row.promptHash !== hash("")));

    const summarize = (groups, limit = 20) => groups
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((group) => ({
        key: group.key,
        count: group.count,
        items: group.list.map((row) => ({
          id: row.id,
          type: row.mediaType,
          name: row.userStates[0]?.currentName,
          category: row.userStates[0]?.currentCategory,
          sourceKind: row.sourceKind,
          url: row.url,
          canonical: row.canonical,
          requestId: row.requestId,
          ledger: row.creditLedgerId,
          firstSeenAt: row.firstSeenAt.toISOString(),
        })),
      }));

    console.log(JSON.stringify({
      userId,
      total: rows.length,
      canonicalDuplicateGroups: canonicalDuplicates.length,
      basenameDuplicateGroups: basenameDuplicates.length,
      promptTimeDuplicateGroups: promptTimeDuplicates.length,
      canonicalDuplicates: summarize(canonicalDuplicates),
      basenameDuplicates: summarize(basenameDuplicates),
      promptTimeDuplicates: summarize(promptTimeDuplicates, 10),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
