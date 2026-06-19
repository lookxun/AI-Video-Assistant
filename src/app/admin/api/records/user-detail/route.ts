import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getCreditSettings } from "@/lib/credits";
import { bytePlusImageGenerationModels, bytePlusVideoGenerationModels, imageGenerationModels, videoGenerationModels } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import type { AdminCreditCategoryDetail, AdminCreditConversationDetail, AdminCreditFlowItem, AdminCreditUser } from "../../../admin-credits-panel";
import type { AdminConversation, AdminConversationMessage, AdminMediaItem, AdminUserRow } from "../../../admin-users-panel";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatTimestamp(value: unknown) {
  const timestamp = finiteNumber(value);
  return timestamp > 0 ? formatDate(new Date(timestamp)) : "-";
}

function normalizeMediaUrlForAdmin(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getModelLabel(type: "image" | "video", modelId: string) {
  const models = type === "image" ? [...imageGenerationModels, ...bytePlusImageGenerationModels] : [...videoGenerationModels, ...bytePlusVideoGenerationModels];
  return models.find((model) => model.id === modelId)?.label ?? modelId;
}

function getDimensionsLabel(value: unknown) {
  if (!isRecord(value)) return "-";
  const width = Math.max(0, Math.floor(finiteNumber(value.width)));
  const height = Math.max(0, Math.floor(finiteNumber(value.height)));
  return width > 0 && height > 0 ? `${width} × ${height}` : "-";
}

function formatAdminMediaName(systemName: string | undefined, userName: string | undefined, fallback: string) {
  const system = (systemName ?? "").trim();
  const user = (userName ?? "").trim();
  if (system && user && user !== system) return `${system} / ${user}`;
  return system || user || fallback;
}

function getMetadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return "";
  return getString(metadata[key]).trim();
}

function getMetadataBoolean(metadata: unknown, key: string) {
  return isRecord(metadata) ? metadata[key] === true : false;
}

function getMetadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getLedgerMediaUrls(metadata: unknown) {
  if (!isRecord(metadata)) return [];
  return getStringArray(metadata.mediaUrls);
}

function getCreditSource(metadata: unknown) {
  if (!isRecord(metadata)) return "conversation";
  const source = metadata.creditSource;
  return typeof source === "string" ? source : "conversation";
}

function getCreditLedgerReason(kind: string, label: string | null, metadata: unknown) {
  if (kind === "signup") return "注册送积分";
  if (kind === "admin_adjust") return "后台调整赠送积分";
  const creditSource = getCreditSource(metadata);
  if (creditSource === "character_image_generation") return "资产库_角色图片";
  if (creditSource === "scene_image_generation") return "资产库_场景图片";
  if (creditSource === "shot_image_generation") return "资产库_分镜图片";
  if (creditSource === "image_prompt_reverse") return "图片反推提示词";
  if (creditSource === "prompt_optimization") return "优化提示词";
  if (kind === "text") return label || "对话/规划";
  if (kind === "image") return "对话流图片生成";
  if (kind === "video") return "对话流视频生成";
  return label || kind;
}

function getLedgerExpectedCredits(item: { credits: number; cny: number; metadata: unknown }, creditsPerCny: number) {
  if (getMetadataBoolean(item.metadata, "creditChargeDisabled")) return 0;
  return Math.max(0, Math.floor(getMetadataNumber(item.metadata, "expectedCredits") ?? Math.round(item.cny * creditsPerCny) ?? item.credits));
}

function buildAdminWorkspaceState(state: unknown, sessionRows: Array<{ sessionId: string; title: string; updatedAt: Date; deletedAt: Date | null; messagesJson: unknown; summaryJson: unknown; usageSummary: unknown; memorySummary: unknown }>, messageRows: Array<{ sessionId: string; messageJson: unknown; createdAt: Date }>) {
  if (sessionRows.length === 0) return state;
  const messagesBySession = new Map<string, unknown[]>();
  for (const row of [...messageRows].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const messages = messagesBySession.get(row.sessionId) ?? [];
    messages.push(row.messageJson);
    messagesBySession.set(row.sessionId, messages);
  }

  return {
    ...(isRecord(state) ? state : {}),
    sessions: sessionRows.map((row) => ({
      ...(isRecord(row.summaryJson) ? row.summaryJson : {}),
      id: row.sessionId,
      title: row.title,
      updatedAt: row.updatedAt.getTime(),
      deletedAt: row.deletedAt ? row.deletedAt.getTime() : undefined,
      messages: messagesBySession.get(row.sessionId) ?? (Array.isArray(row.messagesJson) ? row.messagesJson : []),
      usageSummary: row.usageSummary,
      memorySummary: row.memorySummary,
    })),
  };
}

function getDeletedAssetInfoMap(state: unknown) {
  const map = new Map<string, { deletedAtLabel?: string }>();
  if (!isRecord(state) || !Array.isArray(state.assets)) return map;
  for (const asset of state.assets.filter(isRecord)) {
    const url = getString(asset.url);
    const deletedAt = finiteNumber(asset.deletedAt);
    if (!url || asset.type !== "trash" && deletedAt <= 0) continue;
    const info = { deletedAtLabel: deletedAt > 0 ? formatTimestamp(deletedAt) : undefined };
    map.set(url, info);
    map.set(normalizeMediaUrlForAdmin(url), info);
  }
  return map;
}

function getWorkspaceAssetDisplayNameMap(state: unknown) {
  const map = new Map<string, string>();
  if (!isRecord(state) || !Array.isArray(state.assets)) return map;
  for (const asset of state.assets.filter(isRecord)) {
    const url = getString(asset.url);
    if (!url) continue;
    const systemName = getString(asset.systemName) || getString(asset.name);
    const userName = getString(asset.userName) || (getString(asset.name) && getString(asset.name) !== systemName ? getString(asset.name) : "");
    const displayName = formatAdminMediaName(systemName, userName, userName || systemName || "媒体");
    map.set(url, displayName);
    map.set(normalizeMediaUrlForAdmin(url), displayName);
  }
  return map;
}

function getWorkspaceConversations(state: unknown): AdminConversation[] {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return [];
  const assetDisplayNameMap = getWorkspaceAssetDisplayNameMap(state);
  return state.sessions.filter(isRecord).map((session, index) => {
    const id = getString(session.id, `conversation-${index}`);
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    const updatedAtTs = Math.max(finiteNumber(session.updatedAt), finiteNumber(session.createdAt), ...messages.map((message) => finiteNumber(message.createdAt)));
    return {
      id,
      title: getString(session.title, "新对话") || "新对话",
      isDeleted: finiteNumber(session.deletedAt) > 0,
      deletedAtLabel: finiteNumber(session.deletedAt) > 0 ? formatTimestamp(session.deletedAt) : undefined,
      conversationCode: getString(session.conversationCode),
      updatedAtLabel: formatTimestamp(updatedAtTs),
      updatedAtTs,
      messages: messages.map((message, messageIndex): AdminConversationMessage => {
        const videos = getStringArray(message.videos);
        const videoUrl = getString(message.videoUrl);
        const images = getStringArray(message.images);
        const allVideos = videoUrl ? [...videos, videoUrl].filter((url, urlIndex, array) => array.indexOf(url) === urlIndex) : videos;
        const mediaNames = new Map<string, string>();
        images.forEach((url, mediaIndex) => mediaNames.set(url, assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? `图片${mediaIndex + 1}`));
        allVideos.forEach((url, mediaIndex) => mediaNames.set(url, assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? `视频${mediaIndex + 1}`));
        const role = message.role === "user" || message.role === "assistant" || message.role === "system" ? message.role : "assistant";
        return { id: getString(message.id, `${id}-message-${messageIndex}`), role, content: getString(message.content), createdAtLabel: formatTimestamp(message.createdAt), images, videos: allVideos, mediaNames: Object.fromEntries(mediaNames), error: getString(message.error) };
      }),
    };
  });
}

function getWorkspaceMediaItems(state: unknown): AdminMediaItem[] {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return [];
  const items: AdminMediaItem[] = [];
  const deletedAssetInfoMap = getDeletedAssetInfoMap(state);
  const assetDisplayNameMap = getWorkspaceAssetDisplayNameMap(state);
  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const meta = isRecord(message.generationMeta) ? message.generationMeta : undefined;
      const settings = isRecord(meta?.settings) ? meta.settings : undefined;
      const modelId = getString(meta?.model, "-");
      const ratio = getString(settings?.ratio, "-");
      const resolution = getString(settings?.resolution, "-");
      const duration = getString(settings?.duration, "-");
      const imageDimensions = isRecord(message.imageDimensions) ? message.imageDimensions : undefined;
      const videoDimensionsMap = isRecord(message.videoDimensionsMap) ? message.videoDimensionsMap : undefined;
      const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : undefined;
      const imageSlotUrls = Array.isArray(message.imageResultSlots) ? message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean) : [];
      const imageUrls = imageSlotUrls.length > 0 ? imageSlotUrls : getStringArray(message.images);
      imageUrls.forEach((url, index) => {
        const deletedInfo = deletedAssetInfoMap.get(url) ?? deletedAssetInfoMap.get(normalizeMediaUrlForAdmin(url));
        const systemName = getString(mediaSystemNames?.[url]);
        items.push({ id: `${getString(message.id, "message")}-image-${index}`, requestId: `${getString(message.requestId, getString(message.id, "message"))}:image:${index}`, type: "image", systemName, isDeleted: Boolean(deletedInfo), deletedAtLabel: deletedInfo?.deletedAtLabel, name: assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(systemName, undefined, `图片${index + 1}`), url, prompt: getMetadataString(meta, "originalPrompt") || getString(message.content), model: getModelLabel("image", modelId), ratio, resolution, duration: "-", size: getDimensionsLabel(imageDimensions?.[url]), style: getString(settings?.style, "-"), createdAtTs: finiteNumber(message.createdAt) });
      });
      const videoUrl = getString(message.videoUrl);
      const videoUrls = videoUrl ? [...getStringArray(message.videos), videoUrl].filter((url, index, array) => array.indexOf(url) === index) : getStringArray(message.videos);
      videoUrls.forEach((url, index) => {
        const deletedInfo = deletedAssetInfoMap.get(url) ?? deletedAssetInfoMap.get(normalizeMediaUrlForAdmin(url));
        const systemName = getString(mediaSystemNames?.[url]);
        items.push({ id: `${getString(message.id, "message")}-video-${index}`, requestId: `${getString(message.requestId, getString(message.id, "message"))}:video:${index}`, type: "video", systemName, isDeleted: Boolean(deletedInfo), deletedAtLabel: deletedInfo?.deletedAtLabel, name: assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(systemName, undefined, `视频${index + 1}`), url, prompt: getMetadataString(meta, "originalPrompt") || getString(message.content), model: getModelLabel("video", modelId), ratio, resolution, duration, size: getDimensionsLabel(videoDimensionsMap?.[url] ?? message.videoDimensions), style: "-", createdAtTs: finiteNumber(message.createdAt) });
      });
    }
  }
  return items;
}

function getWorkspaceAssetMediaItems(state: unknown): AdminMediaItem[] {
  if (!isRecord(state) || !Array.isArray(state.assets)) return [];
  return state.assets.filter(isRecord).flatMap((asset, index): AdminMediaItem[] => {
    const assetType = getString(asset.type);
    const effectiveAssetType = assetType === "trash" ? getString(asset.previousType) : assetType;
    if (asset.librarySource !== "asset_generation") return [];
    if (effectiveAssetType !== "character_image" && effectiveAssetType !== "scene_image" && effectiveAssetType !== "shot_image") return [];
    const url = getString(asset.url);
    if (!url) return [];
    const previewMeta = isRecord(asset.previewMeta) ? asset.previewMeta : undefined;
    const prompt = getString(asset.sourcePrompt);
    const isUploadedAsset = !previewMeta;
    const systemName = getString(asset.systemName) || getString(asset.name);
    const userName = getString(asset.userName) || (getString(asset.name) && getString(asset.name) !== systemName ? getString(asset.name) : "");
    return [{ id: getString(asset.id, `asset-image-${index}`), type: "image", assetType: effectiveAssetType, isDeleted: assetType === "trash" || Boolean(asset.deletedAt), deletedAtLabel: finiteNumber(asset.deletedAt) > 0 ? formatTimestamp(asset.deletedAt) : undefined, isUploadedAsset, isReversePrompt: isUploadedAsset && Boolean(prompt.trim()) && prompt !== "资产库上传", systemName, userName, name: formatAdminMediaName(systemName, userName, `资产${index + 1}`), url, prompt: prompt === "资产库上传" ? "" : prompt, model: getString(previewMeta?.modelLabel, "-"), ratio: getString(previewMeta?.ratio, "-"), resolution: getString(previewMeta?.resolution, "-"), duration: "-", size: getString(previewMeta?.sizeText, "-"), style: getString(previewMeta?.styleLabel, "-"), createdAtTs: finiteNumber(asset.createdAt) }];
  });
}

function makeMediaFlowItem(item: AdminMediaItem, index: number, creditLookup: Map<string, AdminCreditFlowItem>): AdminCreditFlowItem {
  const creditItem = (item.requestId ? creditLookup.get(item.requestId) : undefined) ?? creditLookup.get(item.url) ?? creditLookup.get(normalizeMediaUrlForAdmin(item.url));
  return { id: item.id || `${item.url}-${index}`, requestId: item.requestId || item.id || `${item.url}-${index}`, kind: item.type, systemName: item.systemName || item.name || "", displayName: item.name || item.systemName || (item.type === "video" ? `视频${index + 1}` : `图片${index + 1}`), url: item.url, status: "success", errorText: item.isDeleted ? "用户已删除" : undefined, deletedAtLabel: item.deletedAtLabel, credits: creditItem?.credits ?? 0, expectedCredits: creditItem?.expectedCredits, totalTokens: creditItem?.totalTokens ?? 0, usd: creditItem?.usd ?? 0, cny: creditItem?.cny ?? 0, count: 1, model: creditItem?.model ?? item.model, parameters: [item.model, item.ratio, [item.size, item.resolution].filter((value) => value && value !== "-").join(" "), item.type === "video" ? item.duration : ""].filter((value) => value && value !== "-").join(" | "), isCreditMissing: !creditItem, isCostUnavailable: Boolean(creditItem && !creditItem.isChargeDisabled && creditItem.status !== "failed" && creditItem.credits === 0 && creditItem.usd === 0 && creditItem.cny === 0), isReversePrompt: item.isReversePrompt, promptText: item.prompt, createdAtLabel: item.createdAtTs ? formatShortDate(new Date(item.createdAtTs)) : "-", createdAtTs: item.createdAtTs ?? 0 };
}

function addCategoryItem(map: Map<string, AdminCreditCategoryDetail>, id: string, title: string, item: AdminCreditFlowItem) {
  const detail = map.get(id) ?? { id, title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [] };
  detail.totalCredits += item.credits;
  detail.totalUsd += item.usd;
  detail.totalCny += item.cny;
  detail.items.push(item);
  map.set(id, detail);
}

function getAssetCategory(source: string) {
  if (source === "character_image_generation") return { id: "character", title: "角色" };
  if (source === "scene_image_generation") return { id: "scene", title: "场景" };
  return { id: "shot", title: "分镜" };
}

function getAssetUploadCategory(assetType: string | undefined) {
  if (assetType === "character_image") return { id: "character", title: "角色" };
  if (assetType === "scene_image") return { id: "scene", title: "场景" };
  if (assetType === "shot_image") return { id: "shot", title: "分镜" };
  return undefined;
}

function getPromptToolCategory(source: string) {
  return source === "image_prompt_reverse" ? { id: "reverse", title: "反推提示词" } : { id: "optimization", title: "优化提示词" };
}

export async function GET(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

  const [user, creditSettings, ledgers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspace: { select: { state: true, updatedAt: true } },
        workspaceSessions: { orderBy: { updatedAt: "desc" }, select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, messagesJson: true, summaryJson: true, usageSummary: true, memorySummary: true } },
        workspaceMessages: { orderBy: { createdAt: "asc" }, select: { sessionId: true, messageJson: true, createdAt: true } },
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        _count: { select: { sessions: true } },
      },
    }),
    getCreditSettings(),
    prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const workspaceState = buildAdminWorkspaceState(user.workspace?.state, user.workspaceSessions, user.workspaceMessages);
  const conversations = getWorkspaceConversations(workspaceState);
  const mediaItems = getWorkspaceMediaItems(workspaceState);
  const assetMediaItems = getWorkspaceAssetMediaItems(workspaceState);
  const mediaByUrl = new Map<string, AdminMediaItem>();
  for (const media of [...mediaItems, ...assetMediaItems]) {
    mediaByUrl.set(media.url, media);
    mediaByUrl.set(normalizeMediaUrlForAdmin(media.url), media);
    if (media.requestId) mediaByUrl.set(media.requestId, media);
  }

  const creditLookup = new Map<string, AdminCreditFlowItem>();
  const conversationDetails = new Map<string, AdminCreditConversationDetail>();
  const assetCategoryDetails = new Map<string, AdminCreditCategoryDetail>();
  const promptToolCategoryDetails = new Map<string, AdminCreditCategoryDetail>();
  let giftedCredits = 0;
  let signupGiftedCredits = 0;
  let adminAdjustedGiftedCredits = 0;
  let consumedCredits = 0;
  let consumedTokens = 0;
  let consumedUsd = 0;
  let consumedCny = 0;
  let conversationConsumedCredits = 0;
  let assetGenerationConsumedCredits = 0;
  let promptToolConsumedCredits = 0;

  const chronologicalLedgers = [...ledgers].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  let balance = user.credits - chronologicalLedgers.reduce((sum, item) => sum + (item.direction === "increase" ? item.credits : -item.credits), 0);
  const currentCreditDetails = chronologicalLedgers.map((item) => {
    balance += item.direction === "increase" ? item.credits : -item.credits;
    return { id: item.id, reason: getCreditLedgerReason(item.kind, item.label, item.metadata), delta: item.direction === "increase" ? item.credits : -item.credits, balanceAfter: balance, createdAtLabel: formatShortDate(item.createdAt), createdAtTs: item.createdAt.getTime() };
  }).sort((left, right) => right.createdAtTs - left.createdAtTs);

  for (const item of ledgers) {
    if (item.direction === "increase") {
      giftedCredits += item.credits;
      if (item.kind === "signup") signupGiftedCredits += item.credits;
      if (item.kind === "admin_adjust") adminAdjustedGiftedCredits += item.credits;
      continue;
    }

    consumedCredits += item.credits;
    consumedTokens += item.totalTokens;
    consumedUsd += item.usd;
    consumedCny += item.cny;

    const creditSource = getCreditSource(item.metadata);
    const ledgerUrl = getLedgerMediaUrls(item.metadata)[0] ?? "";
    const matchedMedia = ledgerUrl ? mediaByUrl.get(ledgerUrl) ?? mediaByUrl.get(normalizeMediaUrlForAdmin(ledgerUrl)) : item.requestId ? mediaByUrl.get(item.requestId) : undefined;
    const flowItem: AdminCreditFlowItem = { id: item.id, requestId: item.requestId ?? item.id, kind: item.kind === "video" ? "video" : "image", systemName: matchedMedia?.systemName || "", displayName: matchedMedia?.name || item.label || (item.kind === "video" ? "视频" : "图片"), url: matchedMedia?.url || ledgerUrl, status: getMetadataString(item.metadata, "status") === "failed" ? "failed" : "success", errorText: getMetadataString(item.metadata, "failureReason") || (matchedMedia?.isDeleted ? "用户已删除" : undefined), deletedAtLabel: matchedMedia?.deletedAtLabel, credits: item.credits, expectedCredits: getLedgerExpectedCredits(item, creditSettings.creditsPerCny), totalTokens: item.totalTokens, usd: item.usd, cny: item.cny, count: item.kind === "video" ? item.videoCount : item.imageCount, model: item.model || "-", parameters: matchedMedia ? [matchedMedia.model, matchedMedia.ratio, [matchedMedia.size, matchedMedia.resolution].filter((value) => value && value !== "-").join(" "), matchedMedia.type === "video" ? matchedMedia.duration : ""].filter((value) => value && value !== "-").join(" | ") : getModelLabel(item.kind === "video" ? "video" : "image", item.model || "-"), isChargeDisabled: getMetadataBoolean(item.metadata, "creditChargeDisabled"), isCostUnavailable: !getMetadataBoolean(item.metadata, "creditChargeDisabled") && item.credits === 0 && item.usd === 0 && item.cny === 0, promptText: matchedMedia?.prompt || getMetadataString(item.metadata, "originalPrompt") || getMetadataString(item.metadata, "prompt"), createdAtLabel: formatShortDate(item.createdAt), createdAtTs: item.createdAt.getTime() };
    if (item.requestId) creditLookup.set(item.requestId, flowItem);
    if (flowItem.url) {
      creditLookup.set(flowItem.url, flowItem);
      creditLookup.set(normalizeMediaUrlForAdmin(flowItem.url), flowItem);
    }

    if (creditSource === "character_image_generation" || creditSource === "scene_image_generation" || creditSource === "shot_image_generation") {
      assetGenerationConsumedCredits += item.credits;
      const category = getAssetCategory(creditSource);
      addCategoryItem(assetCategoryDetails, category.id, category.title, flowItem);
    } else if (creditSource === "image_prompt_reverse" || creditSource === "prompt_optimization") {
      promptToolConsumedCredits += item.credits;
      const category = getPromptToolCategory(creditSource);
      addCategoryItem(promptToolCategoryDetails, category.id, category.title, flowItem);
    } else {
      const conversationId = item.conversationId || `unknown-${user.id}`;
      const detail = conversationDetails.get(conversationId) ?? { id: conversationId, title: item.conversationTitle || "未命名对话", updatedAtLabel: formatShortDate(item.createdAt), updatedAtTs: item.createdAt.getTime(), chatCredits: 0, chatExpectedCredits: 0, chatUsd: 0, chatCny: 0, planCredits: 0, planExpectedCredits: 0, planUsd: 0, planCny: 0, mediaItems: [] };
      if (item.conversationTitle) detail.title = item.conversationTitle;
      if (item.createdAt.getTime() >= (detail.updatedAtTs ?? 0)) {
        detail.updatedAtLabel = formatShortDate(item.createdAt);
        detail.updatedAtTs = item.createdAt.getTime();
      }
      if (item.kind === "text") {
        detail.chatCredits += item.credits;
        detail.chatExpectedCredits = (detail.chatExpectedCredits ?? 0) + getLedgerExpectedCredits(item, creditSettings.creditsPerCny);
        detail.chatUsd = (detail.chatUsd ?? 0) + item.usd;
        detail.chatCny = (detail.chatCny ?? 0) + item.cny;
      } else if (item.kind === "image" || item.kind === "video") {
        detail.mediaItems.push(flowItem);
      }
      conversationConsumedCredits += item.credits;
      conversationDetails.set(conversationId, detail);
    }
  }

  for (const conversation of conversations) {
    const detail = conversationDetails.get(conversation.id) ?? { id: conversation.id, title: conversation.title, conversationCode: conversation.conversationCode, updatedAtLabel: conversation.updatedAtLabel, updatedAtTs: conversation.updatedAtTs, chatCredits: 0, chatExpectedCredits: 0, chatUsd: 0, chatCny: 0, planCredits: 0, planExpectedCredits: 0, planUsd: 0, planCny: 0, mediaItems: [] };
    detail.title = conversation.title;
    detail.conversationCode = conversation.conversationCode;
    detail.updatedAtLabel = conversation.updatedAtLabel;
    detail.updatedAtTs = conversation.updatedAtTs;
    const existingUrls = new Set(detail.mediaItems.map((media) => media.url).filter(Boolean).flatMap((url) => [url, normalizeMediaUrlForAdmin(url)]));
    [...mediaItems].filter((media) => media.createdAtTs && media.createdAtTs <= (conversation.updatedAtTs ?? Number.MAX_SAFE_INTEGER)).forEach((media, index) => {
      if (existingUrls.has(media.url) || existingUrls.has(normalizeMediaUrlForAdmin(media.url))) return;
      detail.mediaItems.push(makeMediaFlowItem(media, index, creditLookup));
      existingUrls.add(media.url);
      existingUrls.add(normalizeMediaUrlForAdmin(media.url));
    });
    detail.mediaItems.sort((left, right) => right.createdAtTs - left.createdAtTs);
    if (detail.mediaItems.length > 0 || detail.chatCredits > 0 || detail.planCredits > 0) conversationDetails.set(conversation.id, detail);
  }

  for (const asset of assetMediaItems) {
    if (!asset.isUploadedAsset) continue;
    const category = getAssetUploadCategory(asset.assetType);
    if (!category) continue;
    addCategoryItem(assetCategoryDetails, category.id, category.title, { id: `${asset.id}-upload-record`, requestId: `${asset.id}-upload-record`, kind: "image", systemName: asset.name || "", displayName: asset.name || "上传图片", url: asset.url, status: "success", errorText: asset.isDeleted ? "用户已删除" : undefined, deletedAtLabel: asset.deletedAtLabel, credits: 0, totalTokens: 0, usd: 0, cny: 0, count: 1, model: "-", parameters: "资产库上传", isUploadRecord: true, isReversePrompt: asset.isReversePrompt, promptText: asset.isReversePrompt ? asset.prompt : undefined, createdAtLabel: asset.createdAtTs ? formatShortDate(new Date(asset.createdAtTs)) : "-", createdAtTs: asset.createdAtTs ?? 0 });
  }

  const workspaceSummary = { generatedImageCount: mediaItems.filter((item) => item.type === "image" && !item.isUploadedAsset).length + assetMediaItems.filter((item) => !item.isUploadedAsset).length, generatedVideoCount: mediaItems.filter((item) => item.type === "video").length, conversationCount: conversations.length };
  const adminUser: AdminUserRow = { id: user.id, email: user.email, nickname: user.nickname, phone: user.phone, avatarUrl: user.avatarUrl, language: user.language, credits: user.credits, disabled: user.disabled, generalModeEnabled: user.generalModeEnabled, generatedImageCount: Math.max(user.generatedImageCount, workspaceSummary.generatedImageCount), generatedVideoCount: Math.max(user.generatedVideoCount, workspaceSummary.generatedVideoCount), conversationCount: workspaceSummary.conversationCount, consumedCredits, consumedTokens, consumedAmountLabel: `$${consumedUsd.toFixed(4)} / ¥${consumedCny.toFixed(2)}`, notifyOnGenerationComplete: user.notifyOnGenerationComplete, autoSaveHistory: user.autoSaveHistory, previewWheelZoom: user.previewWheelZoom, previewWheelFlip: user.previewWheelFlip, hasPassword: Boolean(user.passwordHash), createdAtLabel: formatDate(user.createdAt), updatedAtLabel: formatDate(user.updatedAt), lastLoginAtLabel: formatDate(user.lastLoginAt ?? user.sessions[0]?.lastSeenAt), lastLoginIp: user.lastLoginIp, lastLoginLocation: user.lastLoginLocation, lastLoginUserAgent: user.lastLoginUserAgent, workspaceSaved: Boolean(user.workspace), workspaceUpdatedAtLabel: formatDate(user.workspace?.updatedAt), sessionCount: user._count.sessions, lastSessionSeenAtLabel: formatDate(user.sessions[0]?.lastSeenAt), conversations, mediaItems, assetMediaItems };
  const creditUser: AdminCreditUser = { id: user.id, userEmail: user.email, nickname: user.nickname, avatarUrl: user.avatarUrl, currentCredits: user.credits, giftedCredits, signupGiftedCredits, adminAdjustedGiftedCredits, consumedCredits, consumedTokens, consumedUsd, consumedCny, conversationConsumedCredits, assetGenerationConsumedCredits, promptToolConsumedCredits, conversationCreditDetails: Array.from(conversationDetails.values()), assetGenerationCreditDetails: Array.from(assetCategoryDetails.values()).map((detail) => ({ ...detail, items: detail.items.sort((left, right) => right.createdAtTs - left.createdAtTs) })), promptToolCreditDetails: Array.from(promptToolCategoryDetails.values()).map((detail) => ({ ...detail, items: detail.items.sort((left, right) => right.createdAtTs - left.createdAtTs) })), currentCreditDetails, lastActiveLabel: ledgers[0] ? formatShortDate(ledgers[0].createdAt) : "-" };

  return NextResponse.json({ detail: { user: adminUser, creditUser } });
}
