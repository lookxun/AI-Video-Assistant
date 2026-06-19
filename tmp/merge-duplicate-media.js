const fs = require("fs");
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

function loadJobs() {
  const file = ".runtime/media-save-jobs.json";
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.jobs) ? parsed.jobs : [];
}

function isRemote(url) {
  return /^https?:\/\//i.test(url || "");
}

function isLocal(url) {
  return typeof url === "string" && url.startsWith("/generated/");
}

function hasCost(row) {
  return Boolean(row.creditLedgerId || row.chargedUsd || row.chargedCny || row.chargedCredits || row.totalTokens || row.requestId);
}

function mergeFactPatch(keeper, duplicate) {
  return {
    creditLedgerId: keeper.creditLedgerId || duplicate.creditLedgerId,
    costSource: keeper.costSource || duplicate.costSource,
    chargedUsd: keeper.chargedUsd || duplicate.chargedUsd || 0,
    chargedCny: keeper.chargedCny || duplicate.chargedCny || 0,
    chargedCredits: keeper.chargedCredits || duplicate.chargedCredits || 0,
    promptTokens: keeper.promptTokens || duplicate.promptTokens || 0,
    completionTokens: keeper.completionTokens || duplicate.completionTokens || 0,
    totalTokens: keeper.totalTokens || duplicate.totalTokens || 0,
    costShareCount: keeper.costShareCount || duplicate.costShareCount,
    costShareIndex: keeper.costShareIndex || duplicate.costShareIndex,
    requestId: keeper.requestId || duplicate.requestId,
    model: keeper.model || duplicate.model,
    modelProvider: keeper.modelProvider || duplicate.modelProvider,
    ratio: keeper.ratio || duplicate.ratio,
    resolution: keeper.resolution || duplicate.resolution,
    imageSize: keeper.imageSize || duplicate.imageSize,
    videoDuration: keeper.videoDuration || duplicate.videoDuration,
    generationSettings: keeper.generationSettings || duplicate.generationSettings,
    previewMeta: keeper.previewMeta || duplicate.previewMeta,
    sourcePrompt: keeper.sourcePrompt || duplicate.sourcePrompt,
    promptSource: keeper.promptSource || duplicate.promptSource,
    reversePrompt: keeper.reversePrompt || duplicate.reversePrompt,
    conversationId: keeper.conversationId || duplicate.conversationId,
    messageId: keeper.messageId || duplicate.messageId,
    firstSeenAt: keeper.firstSeenAt < duplicate.firstSeenAt ? keeper.firstSeenAt : duplicate.firstSeenAt,
  };
}

async function main() {
  loadEnv();
  const userId = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length) || "ID_636611";
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  try {
    const jobs = loadJobs().filter((job) => !job.userId || job.userId === userId);
    const localByRemote = new Map();
    for (const job of jobs) {
      const remote = normalizeUrl(job.remoteUrl);
      const local = normalizeUrl(job.localUrl);
      if (remote && local) localByRemote.set(remote, local);
    }

    const rows = await prisma.mediaAsset.findMany({
      where: { userId, archivedAt: null },
      include: { userStates: true },
      orderBy: [{ firstSeenAt: "desc" }, { createdAt: "desc" }],
    });
    const groups = new Map();
    for (const row of rows) {
      const normalized = normalizeUrl(row.normalizedUrl || row.url);
      const canonical = localByRemote.get(normalized) || normalized;
      const key = `${row.mediaType}:${canonical}`;
      const list = groups.get(key) || [];
      list.push({ ...row, canonical, isRemote: isRemote(row.url), isLocal: isLocal(row.url) });
      groups.set(key, list);
    }

    const plans = [];
    for (const [key, list] of groups.entries()) {
      if (list.length < 2) continue;
      const locals = list.filter((row) => row.isLocal);
      const remotes = list.filter((row) => row.isRemote);
      if (locals.length === 0 || remotes.length === 0) continue;
      const keeper = locals.sort((a, b) => {
        const aNamed = a.userStates.some((state) => state.currentName) ? 1 : 0;
        const bNamed = b.userStates.some((state) => state.currentName) ? 1 : 0;
        return bNamed - aNamed || a.firstSeenAt.getTime() - b.firstSeenAt.getTime();
      })[0];
      for (const duplicate of remotes) plans.push({ key, keeper, duplicate, patch: mergeFactPatch(keeper, duplicate) });
    }

    const summary = {
      dryRun,
      userId,
      plans: plans.length,
      mergeCosts: plans.filter((plan) => hasCost(plan.duplicate)).length,
      sample: plans.slice(0, 12).map((plan) => ({
        key: plan.key,
        keep: { id: plan.keeper.id, url: plan.keeper.url, name: plan.keeper.userStates[0]?.currentName, category: plan.keeper.userStates[0]?.currentCategory, hasCost: hasCost(plan.keeper) },
        archive: { id: plan.duplicate.id, url: plan.duplicate.url.slice(0, 140), name: plan.duplicate.userStates[0]?.currentName, category: plan.duplicate.userStates[0]?.currentCategory, hasCost: hasCost(plan.duplicate) },
      })),
    };

    if (!dryRun) {
      const now = new Date();
      for (const plan of plans) {
        await prisma.$transaction([
          prisma.mediaAsset.update({ where: { id: plan.keeper.id }, data: plan.patch }),
          prisma.userAssetState.updateMany({ where: { mediaAssetId: plan.duplicate.id }, data: { hiddenAt: now, hiddenReason: "duplicate_remote_url" } }),
          prisma.mediaAsset.update({ where: { id: plan.duplicate.id }, data: { archivedAt: now, archiveReason: "duplicate_remote_url", duplicateOfMediaAssetId: plan.keeper.id } }),
        ]);
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
