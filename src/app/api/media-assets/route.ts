import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { canonicalizeSavedMediaUrl, normalizeMediaAssetUrl, resolvePersistableMediaAssetUrl } from "@/lib/media-assets";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mediaTypeFromUrl(url: string) {
  if (/\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/i.test(url)) return "audio";
  if (/\.(pdf|txt|md|csv|doc|docx|xls|xlsx)(\?|#|$)/i.test(url)) return "document";
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? "video" : "image";
}

function currentCategoryFromBody(value: unknown) {
  return typeof value === "string" && ["character_image", "scene_image", "shot_image", "conversation_images", "conversation_uploads", "conversation_videos", "conversation_upload_videos", "conversation_upload_audios", "conversation_upload_documents", "conversation_upload_files", "workflow_images", "workflow_uploads", "workflow_videos"].includes(value) ? value : "conversation_images";
}

function sourceKindFromCategory(category: string, mediaType: string, promptSource: string | undefined) {
  if (category === "character_image" || category === "scene_image" || category === "shot_image") return mediaType === "video" ? "asset_generation_video" : promptSource === "upload" ? "asset_upload_image" : "asset_generation_image";
  if (category.startsWith("workflow_")) return category.includes("upload") ? "workflow_upload" : "workflow_generation";
  if (category === "conversation_upload_videos") return "conversation_upload_video";
  if (category === "conversation_upload_audios") return "conversation_upload_audio";
  if (category === "conversation_upload_documents") return "conversation_upload_document";
  if (category === "conversation_upload_files") return "conversation_upload_file";
  if (category === "conversation_uploads") return mediaType === "video" ? "conversation_upload_video" : "conversation_upload_image";
  return mediaType === "video" ? "conversation_generation_video" : "conversation_generation_image";
}

function workspaceKindFromInput(category: string, body: Record<string, unknown>) {
  if (typeof body.workflowId === "string" || category.startsWith("workflow_")) return "workflow";
  if (category === "character_image" || category === "scene_image" || category === "shot_image") return "asset_generation";
  return "conversation";
}

function sourceDetailFromBody(value: unknown) {
  if (typeof value === "string") return value.trim() || undefined;
  if (!isRecord(value)) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function isInvalidSourcePrompt(value: unknown) {
  if (typeof value !== "string") return true;
  const text = value.trim();
  return !text || /^\?+$/.test(text);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dbDateToMs(value: Date | null | undefined) {
  return value ? value.getTime() : undefined;
}

function mediaCategoryToLegacyType(category: string, mediaType: string) {
  if (category === "workflow_videos" || mediaType === "video") return "shot_video";
  if (category === "character_image" || category === "scene_image" || category === "shot_image") return category;
  if (category === "trash") return "trash";
  return "other";
}

function normalizePreviewMeta(value: Prisma.JsonValue | null, media: { mediaType: string; model: string | null; ratio: string | null; resolution: string | null; imageSize: string | null; videoDuration: string | null; width: number | null; height: number | null }) {
  if (isRecord(value)) return value;
  if (!media.model && !media.ratio && !media.resolution && !media.imageSize && !media.videoDuration && !media.width && !media.height) return undefined;
  return {
    modelLabel: media.model || "-",
    ratio: media.width && media.height ? `${media.width}:${media.height}` : media.ratio || "-",
    sizeText: media.width && media.height ? `${media.width} × ${media.height}` : media.imageSize || "-",
    resolution: media.resolution || media.imageSize || "-",
    duration: media.videoDuration || undefined,
    mode: media.mediaType === "video" ? "video" : "image",
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(request.url);
  const workflowId = url.searchParams.get("workflowId")?.trim();
  if (!workflowId) return NextResponse.json({ assets: [] });

  const rows = await prisma.userAssetState.findMany({
    where: {
      userId: user.id,
      hiddenAt: null,
      deletedAt: null,
      mediaAsset: { archivedAt: null, workflowId, workspaceKind: "workflow" },
    },
    select: {
      id: true,
      currentName: true,
      currentCategory: true,
      previousCategory: true,
      deletedAt: true,
      purgeAt: true,
      bytePlusAssetId: true,
      bytePlusAssetGroupId: true,
      bytePlusAssetStatus: true,
      bytePlusAssetError: true,
      bytePlusAssetUpdatedAt: true,
      mediaAsset: {
        select: {
          id: true,
          mediaType: true,
          url: true,
          posterUrl: true,
          thumbnailUrl: true,
          sourceKind: true,
          sourcePrompt: true,
          promptSource: true,
          reversePrompt: true,
          previewMeta: true,
          model: true,
          ratio: true,
          resolution: true,
          imageSize: true,
          videoDuration: true,
          width: true,
          height: true,
          conversationId: true,
          messageId: true,
          workflowId: true,
          workflowNodeId: true,
          createdAt: true,
          firstSeenAt: true,
          systemName: true,
          initialName: true,
        },
      },
    },
    orderBy: [{ mediaAsset: { firstSeenAt: "desc" } }, { mediaAsset: { createdAt: "desc" } }, { id: "desc" }],
  });

  const assets = rows.map((row) => {
    const media = row.mediaAsset;
    const isWorkflowCategory = row.currentCategory === "workflow_images" || row.currentCategory === "workflow_uploads" || row.currentCategory === "workflow_videos";
    const promptSource = media.reversePrompt && media.reversePrompt !== "上传图片" ? "reverse" : row.currentCategory === "workflow_uploads" || media.sourceKind.includes("upload") ? "upload" : media.promptSource || "generated";
    return {
      id: row.id,
      mediaId: media.id,
      type: mediaCategoryToLegacyType(row.currentCategory, media.mediaType),
      name: row.currentName || media.systemName || media.initialName || "未命名资产",
      systemName: media.systemName || media.initialName || undefined,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl || undefined,
      posterUrl: media.posterUrl || undefined,
      librarySource: isWorkflowCategory ? "workflow" : "conversation",
      sourcePrompt: media.reversePrompt || media.sourcePrompt || (promptSource === "upload" ? "上传图片" : ""),
      promptSource,
      lockedType: true,
      previewMeta: normalizePreviewMeta(media.previewMeta, media),
      sessionId: media.workflowId || media.conversationId || "",
      messageId: media.messageId || undefined,
      workflowId: media.workflowId || undefined,
      workflowNodeId: media.workflowNodeId || undefined,
      previousType: row.previousCategory || undefined,
      createdAt: dbDateToMs(media.firstSeenAt) ?? dbDateToMs(media.createdAt) ?? Date.now(),
      deletedAt: dbDateToMs(row.deletedAt),
      purgeAt: dbDateToMs(row.purgeAt),
      bytePlusAssetId: row.bytePlusAssetId || undefined,
      bytePlusAssetGroupId: row.bytePlusAssetGroupId || undefined,
      bytePlusAssetStatus: row.bytePlusAssetStatus || undefined,
      bytePlusAssetError: row.bytePlusAssetError || undefined,
      bytePlusAssetUpdatedAt: dbDateToMs(row.bytePlusAssetUpdatedAt),
    };
  });

  return NextResponse.json({ assets });
}

async function getWorkflowNodeSourcePrompt(userId: string, workflowId: string | undefined, workflowNodeId: string | undefined) {
  if (!workflowId || !workflowNodeId) return undefined;
  const workflow = await prisma.workspaceWorkflow.findUnique({
    where: { userId_workflowId: { userId, workflowId } },
    select: { title: true, canvasJson: true },
  });
  if (!workflow || !isRecord(workflow.canvasJson) || !Array.isArray(workflow.canvasJson.nodes)) return undefined;
  const node = workflow.canvasJson.nodes.find((item) => isRecord(item) && item.id === workflowNodeId);
  if (!isRecord(node) || !isRecord(node.data)) return workflow.title;
  return getString(node.data.prompt) || getString(node.data.text) || getString(node.data.outputText) || workflow.title;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined);
  if (!isRecord(body)) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const inputUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!inputUrl) return NextResponse.json({ error: "缺少媒体地址" }, { status: 400 });

  const inputPosterUrl = typeof body.posterUrl === "string" && body.posterUrl.trim() ? body.posterUrl.trim() : undefined;
  const inputThumbnailUrl = typeof body.thumbnailUrl === "string" && body.thumbnailUrl.trim() ? body.thumbnailUrl.trim() : undefined;
  const resolved = resolvePersistableMediaAssetUrl(user.id, inputUrl, { posterUrl: inputPosterUrl, thumbnailUrl: inputThumbnailUrl });
  if (!resolved) return NextResponse.json({ ok: true, skipped: true, reason: "unsupported_media_url" });

  const url = resolved.url;
  const normalizedUrl = resolved.normalizedUrl;
  const currentCategory = currentCategoryFromBody(body.currentCategory);
  const mediaType = typeof body.mediaType === "string" ? body.mediaType : mediaTypeFromUrl(normalizedUrl);
  const promptSource = typeof body.promptSource === "string" ? body.promptSource : undefined;
  const sourceKind = sourceKindFromCategory(currentCategory, mediaType, promptSource);
  const workspaceKind = workspaceKindFromInput(currentCategory, body);
  const workspaceId = workspaceKind === "workflow" && typeof body.workflowId === "string" ? body.workflowId : workspaceKind === "conversation" && typeof body.conversationId === "string" ? body.conversationId : undefined;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
  const persistName = workspaceKind === "workflow" && (name === "图片生成" || name === "视频生成") ? undefined : name;
  const posterUrl = resolved.posterUrl;
  const thumbnailUrl = resolved.thumbnailUrl;
  const dimensions = isRecord(body.dimensions) ? body.dimensions : undefined;
  const width = typeof dimensions?.width === "number" ? Math.floor(dimensions.width) : undefined;
  const height = typeof dimensions?.height === "number" ? Math.floor(dimensions.height) : undefined;
  const durationSeconds = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds) && body.durationSeconds > 0 ? body.durationSeconds : undefined;
  const settings = isRecord(body.settings) ? body.settings : undefined;
  const settingsJson = settings as Prisma.InputJsonValue | undefined;
  const previewMetaJson = (isRecord(body.previewMeta) ? body.previewMeta : undefined) as Prisma.InputJsonValue | undefined;
  const sourceDetail = sourceDetailFromBody(body.sourceDetail);
  const bodySourcePrompt = typeof body.sourcePrompt === "string" ? body.sourcePrompt : undefined;
  const workflowNodeSourcePrompt = workspaceKind === "workflow" && isInvalidSourcePrompt(bodySourcePrompt)
    ? await getWorkflowNodeSourcePrompt(user.id, typeof body.workflowId === "string" ? body.workflowId : undefined, typeof body.workflowNodeId === "string" ? body.workflowNodeId : undefined)
    : undefined;
  const sourcePrompt = isInvalidSourcePrompt(bodySourcePrompt) ? workflowNodeSourcePrompt : bodySourcePrompt;

  const media = await prisma.mediaAsset.upsert({
    where: { userId_normalizedUrl: { userId: user.id, normalizedUrl } },
    create: {
      userId: user.id,
      mediaType,
      url,
      normalizedUrl,
      originalUrl: resolved.originalUrl,
      posterUrl,
      thumbnailUrl,
      sourceKind,
      sourceDetail,
      sourcePrompt,
      promptSource,
      model: typeof body.model === "string" ? body.model : undefined,
      ratio: typeof settings?.ratio === "string" ? settings.ratio : undefined,
      resolution: typeof settings?.resolution === "string" ? settings.resolution : undefined,
      imageSize: typeof settings?.imageSize === "string" ? settings.imageSize : undefined,
      videoDuration: typeof settings?.duration === "string" ? settings.duration : undefined,
      generationSettings: settingsJson,
      previewMeta: previewMetaJson,
      width,
      height,
      durationSeconds,
      systemName: persistName,
      initialName: persistName,
      initialCategory: currentCategory,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      messageId: typeof body.messageId === "string" ? body.messageId : undefined,
      workflowId: typeof body.workflowId === "string" ? body.workflowId : undefined,
      workflowNodeId: typeof body.workflowNodeId === "string" ? body.workflowNodeId : undefined,
      workspaceKind,
      workspaceId,
      requestId: typeof body.requestId === "string" ? body.requestId : undefined,
      firstSeenAt: new Date(),
    },
    update: {
      mediaType,
      url,
      originalUrl: resolved.originalUrl,
      posterUrl,
      thumbnailUrl,
      sourceKind,
      sourceDetail,
      sourcePrompt,
      promptSource,
      model: typeof body.model === "string" ? body.model : undefined,
      ratio: typeof settings?.ratio === "string" ? settings.ratio : undefined,
      resolution: typeof settings?.resolution === "string" ? settings.resolution : undefined,
      imageSize: typeof settings?.imageSize === "string" ? settings.imageSize : undefined,
      videoDuration: typeof settings?.duration === "string" ? settings.duration : undefined,
      generationSettings: settingsJson,
      previewMeta: previewMetaJson,
      width,
      height,
      durationSeconds,
      systemName: persistName,
      initialName: persistName,
      initialCategory: currentCategory,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      messageId: typeof body.messageId === "string" ? body.messageId : undefined,
      workflowId: typeof body.workflowId === "string" ? body.workflowId : undefined,
      workflowNodeId: typeof body.workflowNodeId === "string" ? body.workflowNodeId : undefined,
      workspaceKind,
      workspaceId,
      requestId: typeof body.requestId === "string" ? body.requestId : undefined,
    },
    select: { id: true },
  });

  const existingState = await prisma.userAssetState.findUnique({
    where: { userId_mediaAssetId: { userId: user.id, mediaAssetId: media.id } },
    select: { id: true, currentName: true, currentCategory: true, userRenamed: true, userRecategorized: true, lockedCategory: true },
  });
  if (existingState) {
    const shouldPreserveCategory = existingState.userRecategorized || existingState.lockedCategory;
    const hasTemporaryWorkflowName = existingState.currentCategory.startsWith("workflow_") && (existingState.currentName === "图片生成" || existingState.currentName === "视频生成");
    await prisma.userAssetState.update({
      where: { id: existingState.id },
      data: {
        ...(persistName && (!existingState.userRenamed || hasTemporaryWorkflowName) ? { currentName: persistName, userRenamed: false } : {}),
        ...(shouldPreserveCategory ? {} : { currentCategory, userRecategorized: true, lockedCategory: true }),
        hiddenAt: null,
        hiddenReason: null,
        deletedAt: null,
      },
    });
  } else {
    await prisma.userAssetState.create({
      data: {
        userId: user.id,
        mediaAssetId: media.id,
        currentName: persistName,
        currentCategory,
        originalCategory: currentCategory,
        lockedCategory: true,
        userRenamed: Boolean(persistName),
        userRecategorized: true,
      },
    });
  }

  await canonicalizeSavedMediaUrl(user.id, url);

  return NextResponse.json({ ok: true, mediaAssetId: media.id });
}

function stateCategoryFromBody(value: unknown, mediaUrl: string) {
  if (value === "conversation_image") return /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(mediaUrl) ? "conversation_uploads" : "conversation_images";
  return typeof value === "string" && ["character_image", "scene_image", "shot_image", "conversation_images", "conversation_uploads", "conversation_videos", "conversation_upload_videos", "conversation_upload_audios", "conversation_upload_documents", "conversation_upload_files", "workflow_images", "workflow_uploads", "workflow_videos"].includes(value) ? value : undefined;
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined);
  if (!isRecord(body)) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const assetId = typeof body.assetId === "string" ? body.assetId : undefined;
  const mediaAssetId = typeof body.mediaAssetId === "string" ? body.mediaAssetId : undefined;
  const url = typeof body.url === "string" ? body.url.trim() : undefined;
  const normalizedUrl = url ? normalizeMediaAssetUrl(url) : undefined;
  const reversePrompt = typeof body.reversePrompt === "string" ? body.reversePrompt.trim() : undefined;
  if (!assetId && !mediaAssetId && !normalizedUrl) return NextResponse.json({ error: "缺少资产标识" }, { status: 400 });

  const stateLookup: Prisma.UserAssetStateWhereInput[] = [];
  if (assetId) stateLookup.push({ id: assetId });
  if (mediaAssetId) stateLookup.push({ mediaAssetId });
  if (normalizedUrl) stateLookup.push({ mediaAsset: { normalizedUrl } });

  const state = await prisma.userAssetState.findFirst({
    where: {
      userId: user.id,
      OR: stateLookup,
    },
    include: { mediaAsset: true },
  });
  if (!state) {
    if (!url || !normalizedUrl) return NextResponse.json({ error: "资产不存在" }, { status: 404 });
    const resolved = resolvePersistableMediaAssetUrl(user.id, url);
    if (!resolved) return NextResponse.json({ ok: true, skipped: true, reason: "unsupported_media_url" });
    const fallbackCategory = stateCategoryFromBody(body.currentCategory, resolved.url) ?? (/\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(resolved.url) ? "conversation_uploads" : mediaTypeFromUrl(resolved.url) === "video" ? "conversation_videos" : "conversation_images");
    const fallbackMediaType = mediaTypeFromUrl(resolved.url);
    const fallbackPromptSource = fallbackCategory.includes("upload") ? "upload" : "generated";
    const fallbackWorkspaceKind = workspaceKindFromInput(fallbackCategory, body);
    const fallbackWorkspaceId = fallbackWorkspaceKind === "workflow" && typeof body.workflowId === "string" ? body.workflowId : fallbackWorkspaceKind === "conversation" && typeof body.conversationId === "string" ? body.conversationId : undefined;
    const fallbackMedia = await prisma.mediaAsset.upsert({
      where: { userId_normalizedUrl: { userId: user.id, normalizedUrl: resolved.normalizedUrl } },
      create: { userId: user.id, mediaType: fallbackMediaType, url: resolved.url, normalizedUrl: resolved.normalizedUrl, originalUrl: resolved.originalUrl, posterUrl: resolved.posterUrl, thumbnailUrl: resolved.thumbnailUrl, sourceKind: sourceKindFromCategory(fallbackCategory, fallbackMediaType, fallbackPromptSource), sourcePrompt: fallbackPromptSource === "upload" ? "上传图片" : undefined, promptSource: fallbackPromptSource, reversePrompt: reversePrompt || undefined, initialCategory: fallbackCategory, workspaceKind: fallbackWorkspaceKind, workspaceId: fallbackWorkspaceId, firstSeenAt: new Date() },
      update: { mediaType: fallbackMediaType, url: resolved.url, originalUrl: resolved.originalUrl, posterUrl: resolved.posterUrl, thumbnailUrl: resolved.thumbnailUrl, workspaceKind: fallbackWorkspaceKind, workspaceId: fallbackWorkspaceId, reversePrompt: reversePrompt || undefined },
      select: { id: true },
    });
    const deletedAt = body.delete === true ? new Date() : null;
    await prisma.userAssetState.upsert({
      where: { userId_mediaAssetId: { userId: user.id, mediaAssetId: fallbackMedia.id } },
      create: { userId: user.id, mediaAssetId: fallbackMedia.id, currentCategory: fallbackCategory, originalCategory: fallbackCategory, currentName: typeof body.name === "string" ? body.name.trim() || undefined : undefined, deletedAt, purgeAt: deletedAt ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null },
      update: { hiddenAt: null, hiddenReason: null, ...(body.delete === true ? { deletedAt, purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } : {}) },
    });
    return NextResponse.json({ ok: true, mediaAssetId: fallbackMedia.id });
  }

  const data: Prisma.UserAssetStateUpdateInput = {};
  const mediaData: Prisma.MediaAssetUpdateInput = {};
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name) {
    data.currentName = name;
    data.userRenamed = true;
  }

  const category = stateCategoryFromBody(body.currentCategory, state.mediaAsset.url);
  if (category && category !== state.currentCategory) {
    data.previousCategory = state.currentCategory;
    data.currentCategory = category;
    data.sortOrder = Math.floor(Date.now() / 1000);
    data.userRecategorized = true;
    data.lockedCategory = true;
    data.deletedAt = null;
    data.purgeAt = null;
    data.restoredAt = null;
  }

  if (body.delete === true) {
    data.deletedAt = new Date();
    data.purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  if (body.restore === true) {
    data.deletedAt = null;
    data.purgeAt = null;
    data.restoredAt = new Date();
  }

  if (reversePrompt) mediaData.reversePrompt = reversePrompt;

  if (Object.keys(data).length === 0 && Object.keys(mediaData).length === 0) return NextResponse.json({ ok: true, mediaAssetId: state.mediaAssetId });

  await prisma.$transaction([
    ...(Object.keys(data).length > 0 ? [prisma.userAssetState.update({ where: { id: state.id }, data })] : []),
    ...(Object.keys(mediaData).length > 0 ? [prisma.mediaAsset.update({ where: { id: state.mediaAssetId }, data: mediaData })] : []),
  ]);
  return NextResponse.json({ ok: true, mediaAssetId: state.mediaAssetId });
}
