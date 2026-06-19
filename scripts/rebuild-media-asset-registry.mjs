import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && fs.existsSync(".env.local")) {
  const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.trim().startsWith("DATABASE_URL=") && item.includes("postgres"));
  if (line) process.env.DATABASE_URL = line.trim().slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_USER = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length) || "";

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const ASSET_GENERATION_CATEGORIES = new Set(["character_image", "scene_image", "shot_image", "shot_video"]);
const CURRENT_ASSET_CATEGORIES = new Set(["character_image", "scene_image", "shot_image"]);
const VALID_CATEGORIES = new Set(["character_image", "scene_image", "shot_image", "conversation_images", "conversation_uploads", "conversation_videos", "workflow_images", "workflow_uploads", "workflow_videos", "trash"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUrl(url) {
  if (typeof url !== "string") return "";
  return url.trim().split("?")[0].split("#")[0];
}

function mediaTypeFromUrl(url) {
  if (VIDEO_EXT.test(url)) return "video";
  if (IMAGE_EXT.test(url)) return "image";
  return "image";
}

function toDate(value) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? new Date(n) : undefined;
}

function getMessageVideos(message) {
  return [...(Array.isArray(message.videos) ? message.videos : []), ...(typeof message.videoUrl === "string" ? [message.videoUrl] : [])].filter(Boolean);
}

function getDimension(map, url) {
  return isRecord(map) && isRecord(map[url]) ? map[url] : undefined;
}

function categoryFromCreditSource(source, mediaType) {
  if (mediaType === "video") return "conversation_videos";
  if (source.includes("character")) return "character_image";
  if (source.includes("scene")) return "scene_image";
  if (source.includes("shot")) return "shot_image";
  return "conversation_images";
}

function currentCategoryFromFact(sourceKind, mediaType, preferredCategory) {
  if (sourceKind?.startsWith("workflow_upload")) return "workflow_uploads";
  if (sourceKind?.startsWith("workflow_generation") || sourceKind?.startsWith("workflow_")) return mediaType === "video" ? "workflow_videos" : "workflow_images";
  if ((sourceKind === "asset_generation_image" || sourceKind === "asset_upload_image") && CURRENT_ASSET_CATEGORIES.has(preferredCategory)) return preferredCategory;
  if (mediaType === "video") return "conversation_videos";
  if (sourceKind?.includes("upload")) return "conversation_uploads";
  return "conversation_images";
}

function sourceKindFromLegacy(asset, mediaType) {
  if (asset.librarySource === "asset_generation") return mediaType === "video" ? "asset_generation_video" : "asset_generation_image";
  if (asset.promptSource === "upload" || asset.sourcePrompt === "资产库上传") return mediaType === "video" ? "conversation_upload_video" : "asset_upload_image";
  if (asset.librarySource === "conversation") return mediaType === "video" ? "conversation_generation_video" : "conversation_generation_image";
  return mediaType === "video" ? "conversation_generation_video" : "conversation_generation_image";
}

function stateFromAsset(asset, index) {
  const mediaType = mediaTypeFromUrl(normalizeUrl(asset.url || ""));
  const sourceKind = sourceKindFromLegacy(asset, mediaType);
  const category = currentCategoryFromFact(sourceKind, mediaType, asset.type);
  return {
    currentName: typeof asset.name === "string" ? asset.name : undefined,
    currentCategory: category,
    originalCategory: category,
    previousCategory: typeof asset.previousType === "string" ? asset.previousType : undefined,
    userRenamed: Boolean(asset.userName),
    userRecategorized: Boolean(asset.lockedType || asset.userName),
    lockedCategory: Boolean(asset.lockedType),
    sortOrder: index,
    deletedAt: toDate(asset.deletedAt),
    purgeAt: toDate(asset.purgeAt),
    bytePlusAssetId: asset.bytePlusAssetId,
    bytePlusAssetGroupId: asset.bytePlusAssetGroupId,
    bytePlusAssetStatus: asset.bytePlusAssetStatus,
    bytePlusAssetError: asset.bytePlusAssetError,
    bytePlusAssetUpdatedAt: toDate(asset.bytePlusAssetUpdatedAt),
    legacyAssetJson: asset,
  };
}

function factFromAsset(userId, asset) {
  const url = normalizeUrl(asset.url);
  if (!url) return undefined;
  const mediaType = mediaTypeFromUrl(url);
  const previewMeta = isRecord(asset.previewMeta) ? asset.previewMeta : undefined;
  const sourceKind = sourceKindFromLegacy(asset, mediaType);
  const initialCategory = currentCategoryFromFact(sourceKind, mediaType, asset.type);
  return {
    userId,
    mediaType,
    url: asset.url,
    normalizedUrl: url,
    posterUrl: asset.posterUrl,
    sourceKind,
    sourceDetail: asset.librarySource,
    sourcePrompt: typeof asset.sourcePrompt === "string" ? asset.sourcePrompt : undefined,
    promptSource: asset.promptSource,
    reversePrompt: asset.promptSource === "reverse" ? asset.sourcePrompt : undefined,
    model: previewMeta?.modelLabel,
    ratio: previewMeta?.ratio,
    resolution: previewMeta?.resolution,
    imageSize: previewMeta?.sizeText,
    videoDuration: previewMeta?.duration,
    previewMeta,
    systemName: asset.systemName,
    initialName: asset.systemName || asset.name,
    initialCategory,
    conversationId: asset.sessionId,
    messageId: asset.messageId,
    legacyAssetId: asset.id,
    legacyLibrarySource: asset.librarySource,
    firstSeenAt: toDate(asset.createdAt) || new Date(),
  };
}

function addCandidate(map, fact, state, priority) {
  if (!fact?.normalizedUrl) return;
  const key = `${fact.userId}:${fact.normalizedUrl}`;
  const existing = map.get(key);
  if (!existing || priority >= existing.priority) {
    map.set(key, {
      fact: { ...(existing?.fact || {}), ...fact },
      state: { ...(existing?.state || {}), ...state },
      priority,
    });
  } else {
    existing.fact = { ...fact, ...existing.fact };
    existing.state = { ...state, ...existing.state };
  }
}

function addMessageMedia(map, userId, sessionTitle, row) {
  const message = row.messageJson;
  if (!isRecord(message) || message.role !== "assistant") return;
  const imageUrls = Array.isArray(message.images) ? message.images : [];
  const videoUrls = getMessageVideos(message);
  const meta = isRecord(message.generationMeta) ? message.generationMeta : {};
  const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : {};
  const createdAt = row.createdAt || new Date();

  for (const urlRaw of imageUrls) {
    const url = normalizeUrl(urlRaw);
    if (!url) continue;
    const dimensions = getDimension(message.imageDimensions, urlRaw);
    const sourcePrompt = isRecord(message.imagePrompts) && typeof message.imagePrompts[urlRaw] === "string" ? message.imagePrompts[urlRaw] : meta.originalPrompt || message.content || sessionTitle;
    addCandidate(map, {
      userId,
      mediaType: "image",
      url: urlRaw,
      normalizedUrl: url,
      width: dimensions?.width,
      height: dimensions?.height,
      sourceKind: "conversation_generation_image",
      sourcePrompt,
      promptSource: "generated",
      model: meta.model,
      ratio: meta.settings?.ratio,
      resolution: meta.settings?.resolution,
      imageSize: meta.settings?.imageCount,
      generationSettings: meta.settings,
      previewMeta: isRecord(message.previewMeta) ? message.previewMeta : undefined,
      systemName: mediaSystemNames[urlRaw],
      initialName: mediaSystemNames[urlRaw],
      initialCategory: "other",
      requestId: message.requestId,
      conversationId: row.sessionId,
      messageId: row.messageId,
      firstSeenAt: createdAt,
    }, { currentCategory: "conversation_images", originalCategory: "conversation_images", currentName: mediaSystemNames[urlRaw] }, 20);
  }

  let videoIndex = 0;
  for (const urlRaw of videoUrls) {
    const url = normalizeUrl(urlRaw);
    if (!url) continue;
    const dimensions = getDimension(message.videoDimensionsMap, urlRaw);
    const sourcePrompt = isRecord(message.videoPrompts) && typeof message.videoPrompts[urlRaw] === "string" ? message.videoPrompts[urlRaw] : Array.isArray(meta.itemPrompts) ? meta.itemPrompts[videoIndex] : meta.originalPrompt || message.content || sessionTitle;
    addCandidate(map, {
      userId,
      mediaType: "video",
      url: urlRaw,
      normalizedUrl: url,
      posterUrl: isRecord(message.videoPosters) ? message.videoPosters[urlRaw] : undefined,
      width: dimensions?.width,
      height: dimensions?.height,
      sourceKind: "conversation_generation_video",
      sourcePrompt,
      promptSource: "generated",
      model: meta.model,
      ratio: meta.settings?.ratio,
      resolution: meta.settings?.resolution,
      videoDuration: meta.settings?.duration,
      generationSettings: meta.settings,
      systemName: mediaSystemNames[urlRaw],
      initialName: mediaSystemNames[urlRaw],
      initialCategory: "conversation_videos",
      requestId: message.requestId,
      conversationId: row.sessionId,
      messageId: row.messageId,
      firstSeenAt: createdAt,
    }, { currentCategory: "conversation_videos", originalCategory: "conversation_videos", currentName: mediaSystemNames[urlRaw] }, 20);
    videoIndex += 1;
  }
}

function mediaUrlsFromMetadata(metadata) {
  if (!isRecord(metadata)) return [];
  if (Array.isArray(metadata.mediaUrls)) return metadata.mediaUrls.filter((url) => typeof url === "string");
  if (typeof metadata.mediaUrl === "string") return [metadata.mediaUrl];
  if (Array.isArray(metadata.urls)) return metadata.urls.filter((url) => typeof url === "string");
  return [];
}

function getNumber(value) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : 0;
}

function isTextOnlyCreditSource(source) {
  return source === "prompt_optimization" || source === "image_prompt_reverse" || source === "conversation_text" || source === "agent_plan" || source === "general_text";
}

function isMediaCostLedger(ledger, creditSource) {
  if (ledger.direction && ledger.direction !== "consume") return false;
  if (isTextOnlyCreditSource(creditSource)) return false;
  return ledger.kind === "image" || ledger.kind === "video";
}

function getLedgerCostShare(ledger, creditSource, shareIndex, shareCount) {
  if (!isMediaCostLedger(ledger, creditSource) || shareCount <= 0) return {};
  return {
    costSource: creditSource || ledger.kind,
    chargedUsd: getNumber(ledger.usd) / shareCount,
    chargedCny: getNumber(ledger.cny) / shareCount,
    chargedCredits: getNumber(ledger.credits) / shareCount,
    promptTokens: getNumber(ledger.promptTokens) / shareCount,
    completionTokens: getNumber(ledger.completionTokens) / shareCount,
    totalTokens: getNumber(ledger.totalTokens) / shareCount,
    costShareCount: shareCount,
    costShareIndex: shareIndex,
  };
}

async function main() {
  const users = await prisma.user.findMany({
    where: ONLY_USER ? { id: ONLY_USER } : undefined,
    select: {
      id: true,
      workspace: { select: { state: true } },
      workspaceSessions: { select: { sessionId: true, title: true } },
      workspaceMessages: { select: { sessionId: true, messageId: true, messageJson: true, createdAt: true } },
      creditLedgers: { where: { direction: "consume" }, select: { id: true, conversationId: true, requestId: true, direction: true, kind: true, label: true, model: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, usd: true, cny: true, imageCount: true, videoCount: true, metadata: true, createdAt: true } },
    },
  });

  const summary = [];
  for (const user of users) {
    const map = new Map();
    const sessionsById = new Map(user.workspaceSessions.map((session) => [session.sessionId, session]));
    const state = isRecord(user.workspace?.state) ? user.workspace.state : {};
    const oldAssets = Array.isArray(state.assets) ? state.assets : [];

    oldAssets.forEach((asset, index) => addCandidate(map, factFromAsset(user.id, asset), stateFromAsset(asset, index), 100));

    for (const row of user.workspaceMessages) addMessageMedia(map, user.id, sessionsById.get(row.sessionId)?.title || "", row);

    for (const ledger of user.creditLedgers) {
      const metadata = isRecord(ledger.metadata) ? ledger.metadata : {};
      const creditSource = typeof metadata.creditSource === "string" ? metadata.creditSource : "";
      if (isTextOnlyCreditSource(creditSource)) continue;
      const urls = mediaUrlsFromMetadata(metadata);
      const shareUrls = urls.filter((url) => normalizeUrl(url));
      const shareCount = isMediaCostLedger(ledger, creditSource) ? Math.max(1, shareUrls.length || getNumber(ledger.imageCount) || getNumber(ledger.videoCount) || 1) : 0;
      let shareIndex = 0;
      for (const urlRaw of urls) {
        const normalizedUrl = normalizeUrl(urlRaw);
        if (!normalizedUrl) continue;
        shareIndex += 1;
        const mediaType = mediaTypeFromUrl(normalizedUrl);
        const preferredCategory = categoryFromCreditSource(creditSource, mediaType);
        const sourceKind = creditSource.includes("upload")
          ? mediaType === "video" ? "conversation_upload_video" : "conversation_upload_image"
          : creditSource.includes("asset") || ASSET_GENERATION_CATEGORIES.has(preferredCategory)
            ? mediaType === "video" ? "asset_generation_video" : "asset_generation_image"
            : mediaType === "video" ? "conversation_generation_video" : "conversation_generation_image";
        const category = currentCategoryFromFact(sourceKind, mediaType, preferredCategory);
        addCandidate(map, {
          userId: user.id,
          mediaType,
          url: urlRaw,
          normalizedUrl,
          sourceKind,
          sourceDetail: creditSource,
          sourcePrompt: typeof metadata.originalPrompt === "string" ? metadata.originalPrompt : undefined,
          promptSource: sourceKind.includes("upload") ? "upload" : "generated",
          model: ledger.model,
          ratio: metadata.ratio || metadata.settings?.ratio,
          resolution: metadata.resolution || metadata.settings?.resolution,
          imageSize: metadata.size || metadata.settings?.size,
          videoDuration: metadata.duration || metadata.settings?.duration,
          generationSettings: metadata.settings,
          systemName: metadata.systemName,
          initialName: metadata.assetName || metadata.systemName,
          initialCategory: category,
          creditLedgerId: ledger.id,
          ...getLedgerCostShare(ledger, creditSource, shareIndex, shareCount),
          requestId: ledger.requestId,
          conversationId: ledger.conversationId,
          firstSeenAt: ledger.createdAt,
        }, { currentCategory: category, originalCategory: category, currentName: metadata.assetName || metadata.systemName }, 50);
      }
    }

    if (!DRY_RUN) {
      for (const item of map.values()) {
        const media = await prisma.mediaAsset.upsert({
          where: { userId_normalizedUrl: { userId: user.id, normalizedUrl: item.fact.normalizedUrl } },
          create: item.fact,
          update: item.fact,
          select: { id: true },
        });
        await prisma.userAssetState.upsert({
          where: { userId_mediaAssetId: { userId: user.id, mediaAssetId: media.id } },
          create: { userId: user.id, mediaAssetId: media.id, currentCategory: item.state.currentCategory || item.fact.initialCategory || "other", ...item.state },
          update: item.state,
        });
      }
    }

    const counts = {};
    for (const item of map.values()) {
      const key = item.state.currentCategory || item.fact.initialCategory || "other";
      counts[key] = (counts[key] || 0) + 1;
    }
    summary.push({ userId: user.id, legacyAssets: oldAssets.length, discovered: map.size, counts });
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, users: summary.length, summary }, null, 2));
}

main().finally(() => prisma.$disconnect());
