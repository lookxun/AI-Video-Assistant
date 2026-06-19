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

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isNonEmpty(value) { return typeof value === "string" && value.trim().length > 0 && value.trim() !== "-"; }
function normalizeUrl(value) { return typeof value === "string" ? value.trim().split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/i, "") : ""; }
function cleanPrompt(value) {
  if (!isNonEmpty(value)) return undefined;
  const text = value.trim();
  if (/^内部强制规则/.test(text)) return undefined;
  return text;
}
function mediaTypeFromUrl(url) { return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? "video" : "image"; }
function messageVideos(message) { return [...(Array.isArray(message.videos) ? message.videos : []), ...(typeof message.videoUrl === "string" ? [message.videoUrl] : [])].filter(Boolean); }
function messageImages(message) { return Array.isArray(message.images) ? message.images : Array.isArray(message.imageResultSlots) ? message.imageResultSlots.filter(isRecord).map((slot) => slot.url).filter(Boolean) : []; }

function loadJobs() {
  const file = ".runtime/media-save-jobs.json";
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.jobs) ? parsed.jobs : [];
}

function buildCanonicalMap(userId) {
  const jobs = loadJobs().filter((job) => !job.userId || job.userId === userId);
  const localByRemote = new Map();
  for (const job of jobs) {
    const remote = normalizeUrl(job.remoteUrl);
    const local = normalizeUrl(job.localUrl);
    if (remote && local) localByRemote.set(remote, local);
  }
  return (url) => {
    const normalized = normalizeUrl(url);
    return localByRemote.get(normalized) || normalized;
  };
}

function getDimension(value) {
  return isRecord(value) && Number.isFinite(Number(value.width)) && Number.isFinite(Number(value.height)) ? { width: Math.floor(Number(value.width)), height: Math.floor(Number(value.height)) } : undefined;
}

function sourceFromMessage(row, message, url) {
  const meta = isRecord(message.generationMeta) ? message.generationMeta : {};
  const settings = isRecord(meta.settings) ? meta.settings : {};
  const isVideo = mediaTypeFromUrl(url) === "video";
  const prompt = cleanPrompt((isVideo && isRecord(message.videoPrompts) ? message.videoPrompts[url] : undefined)
    || (!isVideo && isRecord(message.imagePrompts) ? message.imagePrompts[url] : undefined)
    || (isVideo && Array.isArray(meta.itemPrompts) ? meta.itemPrompts[messageVideos(message).indexOf(url)] : undefined)
    || meta.originalPrompt
    || message.content);
  const dim = isVideo ? getDimension(isRecord(message.videoDimensionsMap) ? message.videoDimensionsMap[url] : undefined) || getDimension(message.videoDimensions) : getDimension(isRecord(message.imageDimensions) ? message.imageDimensions[url] : undefined);
  return {
    priority: 100,
    source: "message",
    sourcePrompt: prompt,
    promptSource: prompt ? "generated" : undefined,
    model: isNonEmpty(meta.model) ? meta.model : undefined,
    ratio: isNonEmpty(settings.ratio) ? settings.ratio : undefined,
    resolution: isNonEmpty(settings.resolution) ? settings.resolution : undefined,
    imageSize: !isVideo && isNonEmpty(settings.imageSize || settings.size) ? settings.imageSize || settings.size : undefined,
    videoDuration: isVideo && isNonEmpty(settings.duration) ? settings.duration : undefined,
    generationSettings: Object.keys(settings).length > 0 ? settings : undefined,
    width: dim?.width,
    height: dim?.height,
    conversationId: row.sessionId,
    messageId: row.messageId,
    requestId: isNonEmpty(message.requestId) ? message.requestId : undefined,
  };
}

function sourceFromLedger(ledger, url) {
  const metadata = isRecord(ledger.metadata) ? ledger.metadata : {};
  const settings = isRecord(metadata.settings) ? metadata.settings : {};
  const isVideo = mediaTypeFromUrl(url) === "video";
  const prompt = cleanPrompt(metadata.originalPrompt || metadata.prompt || metadata.sourcePrompt);
  return {
    priority: 80,
    source: "ledger",
    sourcePrompt: prompt,
    promptSource: prompt ? "generated" : undefined,
    model: isNonEmpty(ledger.model) ? ledger.model : undefined,
    ratio: isNonEmpty(metadata.ratio || settings.ratio) ? metadata.ratio || settings.ratio : undefined,
    resolution: isNonEmpty(metadata.resolution || settings.resolution) ? metadata.resolution || settings.resolution : undefined,
    imageSize: !isVideo && isNonEmpty(metadata.imageSize || metadata.size || settings.imageSize || settings.size) ? metadata.imageSize || metadata.size || settings.imageSize || settings.size : undefined,
    videoDuration: isVideo && isNonEmpty(metadata.duration || settings.duration) ? metadata.duration || settings.duration : undefined,
    generationSettings: Object.keys(settings).length > 0 ? settings : undefined,
    creditLedgerId: ledger.id,
    requestId: isNonEmpty(ledger.requestId) ? ledger.requestId : undefined,
    conversationId: isNonEmpty(ledger.conversationId) ? ledger.conversationId : undefined,
  };
}

function sourceFromLegacyAsset(asset) {
  const previewMeta = isRecord(asset.previewMeta) ? asset.previewMeta : {};
  const isVideo = mediaTypeFromUrl(asset.url) === "video";
  const prompt = cleanPrompt(asset.sourcePrompt);
  return {
    priority: 60,
    source: "legacy_asset",
    sourcePrompt: prompt,
    promptSource: isNonEmpty(asset.promptSource) ? asset.promptSource : prompt ? "generated" : undefined,
    model: isNonEmpty(previewMeta.modelId || previewMeta.model || previewMeta.modelLabel) ? previewMeta.modelId || previewMeta.model || previewMeta.modelLabel : undefined,
    ratio: isNonEmpty(previewMeta.ratio) ? previewMeta.ratio : undefined,
    resolution: isNonEmpty(previewMeta.resolution) ? previewMeta.resolution : undefined,
    imageSize: !isVideo && isNonEmpty(previewMeta.sizeText) ? previewMeta.sizeText : undefined,
    videoDuration: isVideo && isNonEmpty(previewMeta.duration) ? previewMeta.duration : undefined,
    conversationId: isNonEmpty(asset.sessionId) ? asset.sessionId : undefined,
    messageId: isNonEmpty(asset.messageId) ? asset.messageId : undefined,
  };
}

function mergeSources(sources) {
  const sorted = sources.filter(Boolean).sort((a, b) => b.priority - a.priority);
  const out = { enrichmentSources: sorted.map((item) => item.source) };
  for (const source of sorted) {
    for (const key of ["sourcePrompt", "promptSource", "model", "ratio", "resolution", "imageSize", "videoDuration", "generationSettings", "width", "height", "creditLedgerId", "requestId", "conversationId", "messageId"]) {
      if (out[key] === undefined && source[key] !== undefined && source[key] !== null && source[key] !== "") out[key] = source[key];
    }
  }
  return out;
}

function diffPatch(row, enriched) {
  const patch = {};
  for (const key of ["sourcePrompt", "promptSource", "model", "ratio", "resolution", "imageSize", "videoDuration", "generationSettings", "width", "height", "creditLedgerId", "requestId", "conversationId", "messageId"]) {
    if ((row[key] === null || row[key] === undefined || row[key] === "") && enriched[key] !== undefined) patch[key] = enriched[key];
  }
  if (isRecord(patch.generationSettings) || isRecord(row.generationSettings)) patch.generationSettings = { ...(isRecord(row.generationSettings) ? row.generationSettings : {}), ...(isRecord(patch.generationSettings) ? patch.generationSettings : {}) };
  return patch;
}

async function main() {
  loadEnv();
  const userId = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length) || "ID_636611";
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  const canonical = buildCanonicalMap(userId);
  try {
    const [mediaRows, messages, ledgers, workspace] = await Promise.all([
      prisma.mediaAsset.findMany({ where: { userId, archivedAt: null } }),
      prisma.workspaceMessage.findMany({ where: { userId }, select: { sessionId: true, messageId: true, messageJson: true, createdAt: true } }),
      prisma.creditLedger.findMany({ where: { userId, direction: "consume" } }),
      prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } }),
    ]);
    const sourceMap = new Map();
    const add = (url, source) => {
      const key = canonical(url);
      if (!key) return;
      const list = sourceMap.get(key) || [];
      list.push(source);
      sourceMap.set(key, list);
    };
    for (const row of messages) {
      const message = row.messageJson;
      if (!isRecord(message) || message.role !== "assistant") continue;
      for (const url of [...messageImages(message), ...messageVideos(message)]) add(url, sourceFromMessage(row, message, url));
    }
    for (const ledger of ledgers) {
      const metadata = isRecord(ledger.metadata) ? ledger.metadata : {};
      const urls = Array.isArray(metadata.mediaUrls) ? metadata.mediaUrls : typeof metadata.mediaUrl === "string" ? [metadata.mediaUrl] : [];
      for (const url of urls.filter(isNonEmpty)) add(url, sourceFromLedger(ledger, url));
    }
    const legacyAssets = Array.isArray(workspace?.state?.assets) ? workspace.state.assets : [];
    for (const asset of legacyAssets.filter(isRecord)) if (isNonEmpty(asset.url)) add(asset.url, sourceFromLegacyAsset(asset));

    const plans = [];
    for (const row of mediaRows) {
      const sources = sourceMap.get(canonical(row.url)) || [];
      const enriched = mergeSources(sources);
      const patch = diffPatch(row, enriched);
      if (Object.keys(patch).length > 0) plans.push({ row, patch, sources: enriched.enrichmentSources });
    }
    const fieldCounts = {};
    for (const plan of plans) for (const key of Object.keys(plan.patch)) fieldCounts[key] = (fieldCounts[key] || 0) + 1;
    if (!dryRun) {
      for (const plan of plans) await prisma.mediaAsset.update({ where: { id: plan.row.id }, data: plan.patch });
    }
    console.log(JSON.stringify({
      dryRun,
      userId,
      visibleMedia: mediaRows.length,
      updates: plans.length,
      fieldCounts,
      samples: plans.slice(0, 25).map((plan) => ({ id: plan.row.id, type: plan.row.mediaType, url: plan.row.url, sources: plan.sources, patch: plan.patch })),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
