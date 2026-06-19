import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCreditSettings } from "@/lib/credits";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";
import { compactWorkspaceState, hasJsonChanged, replaceLegacyMediaUrls } from "@/lib/workspace-state-cleanup";
import { DEFAULT_WORKSPACE_SESSION_LIMIT, getWorkspaceSessionMessages, stripSessionsFromWorkspaceState, upsertWorkspaceSessions, workspaceSessionRowToPayload } from "@/lib/workspace-sessions";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function applyLedgerUsageSummaries(userId: string, state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return state;

  const [settings, ledgers] = await Promise.all([
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId, direction: "consume", conversationId: { not: null } },
      select: { conversationId: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, metadata: true },
    }),
  ]);

  const summaries = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; usd: number; cny: number; credits: number }>();
  for (const item of ledgers) {
    if (!item.conversationId) continue;
    const summary = summaries.get(item.conversationId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, usd: 0, cny: 0, credits: 0 };
    const chargedCny = metadataNumber(item.metadata, "chargedCny") ?? (settings.creditsPerCny > 0 ? item.credits / settings.creditsPerCny : 0);
    const chargedUsd = metadataNumber(item.metadata, "chargedUsd") ?? (settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0);
    summary.promptTokens += item.promptTokens;
    summary.completionTokens += item.completionTokens;
    summary.totalTokens += item.totalTokens;
    summary.usd += chargedUsd;
    summary.cny += chargedCny;
    summary.credits += item.credits;
    summaries.set(item.conversationId, summary);
  }

  return {
    ...state,
    sessions: state.sessions.map((session) => {
      if (!isRecord(session) || typeof session.id !== "string") return session;
      const ledgerSummary = summaries.get(session.id);
      const existing = isRecord(session.usageSummary) ? session.usageSummary : undefined;
      const totalTokens = ledgerSummary?.totalTokens ?? Math.max(0, Math.floor(Number(existing?.totalTokens ?? 0)));
      const promptTokens = ledgerSummary?.promptTokens ?? Math.max(0, Math.floor(Number(existing?.promptTokens ?? 0)));
      const completionTokens = ledgerSummary?.completionTokens ?? Math.max(0, Math.floor(Number(existing?.completionTokens ?? 0)));
      return {
        ...session,
        usageSummary: {
          promptTokens,
          completionTokens,
          totalTokens,
          usd: ledgerSummary?.usd ?? 0,
          cny: ledgerSummary?.cny ?? 0,
          credits: ledgerSummary?.credits ?? 0,
        },
      };
    }),
  };
}

async function applyLedgerUsageSummariesToSessions(userId: string, sessions: unknown[]) {
  const state = await applyLedgerUsageSummaries(userId, { sessions });
  return isRecord(state) && Array.isArray(state.sessions) ? state.sessions : sessions;
}

function getPositiveInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(parsed)));
}

function getWorkspaceShellState(state: unknown) {
  if (!isRecord(state)) return {};
  const shell: Record<string, unknown> = {};
  (["activePanel", "activeSessionId", "assetFilter", "assetScrollTopByFilter", "activeWorkflowId", "nextConversationNumber", "inputSettings", "intentMemoryRules", "feedbackLogs"] as const).forEach((key) => {
    if (key in state) shell[key] = state[key];
  });
  return shell;
}

function getAssetMergeKey(asset: unknown) {
  if (!isRecord(asset)) return "";
  const url = typeof asset.url === "string" ? asset.url.trim() : "";
  if (url) return `url:${url.split("?")[0].split("#")[0]}`;
  const id = typeof asset.id === "string" ? asset.id.trim() : "";
  return id ? `id:${id}` : "";
}

function dbDateToMs(value: Date | null | undefined) {
  return value ? value.getTime() : undefined;
}

function getMediaModelDisplayName(model: string | null | undefined) {
  if (!model) return "-";
  const labels: Record<string, string> = {
    "byteplus:conversation-image.seedream-4-5": "Seedream 4.5",
    "byteplus:conversation-image.seedream-5-0": "Seedream 5.0",
    "byteplus:video.seedance-2-0-fast": "Seedance 2.0 Fast",
    "byteplus:video.seedance-2-0": "Seedance 2.0",
    "bytedance-seed/seedream-4.5": "Seedream 4.5",
    "google/gemini-3.1-flash-image-preview": "Gemini 3.1 Flash",
    "google/gemini-3-pro-image-preview": "Gemini 3 Pro",
    "openai/gpt-5.4-image-2": "GPT-5.4 Image 2",
    "bytedance/seedance-2.0-fast": "Seedance 2.0 Fast",
    "bytedance/seedance-2.0": "Seedance 2.0",
    "google/veo-3.1": "Veo 3.1",
    "kwaivgi/kling-v3.0-std": "Kling v3.0 Standard",
    "kwaivgi/kling-v3.0-pro": "Kling v3.0 Pro",
    "kwaivgi/kling-video-o1": "Kling Video O1",
  };
  return labels[model] ?? model.replace(/^byteplus:(conversation-image|video)\./, "").replace(/^[^/]+\//, "");
}

function normalizePreviewMetaForDisplay(value: Prisma.JsonValue | null, fallbackModel: string | null | undefined) {
  if (!isRecord(value)) return undefined;
  const modelLabel = typeof value.modelLabel === "string" ? value.modelLabel : fallbackModel || "";
  return { ...value, modelLabel: getMediaModelDisplayName(modelLabel) };
}

function categoryToLegacyType(value: unknown) {
  return typeof value === "string" && ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash"].includes(value) ? value : "other";
}

function mediaStateToLegacyAsset(item: {
  id: string;
  currentName: string | null;
  currentCategory: string;
  previousCategory: string | null;
  deletedAt: Date | null;
  purgeAt: Date | null;
  bytePlusAssetId: string | null;
  bytePlusAssetGroupId: string | null;
  bytePlusAssetStatus: string | null;
  bytePlusAssetError: string | null;
  bytePlusAssetUpdatedAt: Date | null;
  mediaAsset: {
    id: string;
    mediaType: string;
    url: string;
    posterUrl: string | null;
    thumbnailUrl: string | null;
    sourceKind: string;
    sourcePrompt: string | null;
    promptSource: string | null;
    reversePrompt: string | null;
    previewMeta: Prisma.JsonValue | null;
    model: string | null;
    ratio: string | null;
    resolution: string | null;
    imageSize: string | null;
    videoDuration: string | null;
    width: number | null;
    height: number | null;
    conversationId: string | null;
    messageId: string | null;
    createdAt: Date;
    firstSeenAt: Date;
    systemName: string | null;
    initialName: string | null;
    legacyLibrarySource: string | null;
  };
}) {
  const media = item.mediaAsset;
  const type = categoryToLegacyType(item.deletedAt ? "trash" : item.currentCategory);
  const sourcePrompt = media.reversePrompt || media.sourcePrompt || (media.sourceKind.includes("upload") ? "资产库上传" : "");
  const isAssetCategory = ["character_image", "scene_image", "shot_image"].includes(type);
  const librarySource = isAssetCategory ? "asset_generation" : "conversation";
  const previewMeta = isRecord(media.previewMeta)
    ? normalizePreviewMetaForDisplay(media.previewMeta, media.model)
    : media.model || media.ratio || media.resolution || media.imageSize || media.videoDuration || media.width || media.height
      ? {
          modelLabel: getMediaModelDisplayName(media.model),
          ratio: media.ratio || "-",
          sizeText: media.width && media.height ? `${media.width} × ${media.height}` : media.imageSize || "-",
          resolution: media.resolution || media.imageSize || "-",
          duration: media.videoDuration || undefined,
          mode: media.mediaType === "video" ? "video" : "image",
        }
      : undefined;
  return {
    id: item.id,
    mediaId: media.id,
    type,
    name: item.currentName || media.initialName || media.systemName || "未命名资产",
    systemName: media.systemName || media.initialName || undefined,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl || undefined,
    posterUrl: media.posterUrl || undefined,
    librarySource,
    sourcePrompt,
    promptSource: media.promptSource || (media.sourceKind.includes("upload") ? "upload" : "generated"),
    lockedType: true,
    previewMeta,
    sessionId: media.conversationId || "",
    messageId: media.messageId || undefined,
    previousType: item.previousCategory || undefined,
    createdAt: dbDateToMs(media.firstSeenAt) ?? dbDateToMs(media.createdAt) ?? Date.now(),
    deletedAt: dbDateToMs(item.deletedAt),
    purgeAt: dbDateToMs(item.purgeAt),
    bytePlusAssetId: item.bytePlusAssetId || undefined,
    bytePlusAssetGroupId: item.bytePlusAssetGroupId || undefined,
    bytePlusAssetStatus: item.bytePlusAssetStatus || undefined,
    bytePlusAssetError: item.bytePlusAssetError || undefined,
    bytePlusAssetUpdatedAt: dbDateToMs(item.bytePlusAssetUpdatedAt),
  };
}

type AssetFilterKey = "character_image" | "scene_image" | "shot_image" | "shot_video" | "other" | "trash" | "conversation_images" | "conversation_uploads" | "conversation_videos" | "workflow_images" | "workflow_uploads" | "workflow_videos";

function isAssetFilterKey(value: unknown): value is AssetFilterKey {
  return typeof value === "string" && ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash", "conversation_images", "conversation_uploads", "conversation_videos", "workflow_images", "workflow_uploads", "workflow_videos"].includes(value);
}

function getAssetPageWhere(userId: string, filter: AssetFilterKey): Prisma.UserAssetStateWhereInput {
  const visible: Prisma.UserAssetStateWhereInput = { userId, hiddenAt: null, mediaAsset: { archivedAt: null } };
  if (filter === "trash") return { ...visible, deletedAt: { not: null } };
  if (["character_image", "scene_image", "shot_image"].includes(filter)) return { ...visible, deletedAt: null, currentCategory: filter };
  if (filter === "workflow_uploads") return { ...visible, deletedAt: null, currentCategory: "workflow_uploads" };
  if (filter === "workflow_videos") return { ...visible, deletedAt: null, currentCategory: "workflow_videos" };
  if (filter === "workflow_images") return { ...visible, deletedAt: null, currentCategory: "workflow_images" };
  if (filter === "conversation_uploads") return { ...visible, deletedAt: null, mediaAsset: { archivedAt: null, url: { contains: "/upload_image/" } } };
  if (filter === "conversation_videos") return { ...visible, deletedAt: null, currentCategory: "conversation_videos" };
  if (filter === "conversation_images") return { ...visible, deletedAt: null, currentCategory: "conversation_images", NOT: { mediaAsset: { url: { contains: "/upload_image/" } } } };
  return { ...visible, deletedAt: null, currentCategory: "conversation_images", NOT: { mediaAsset: { url: { contains: "/upload_image/" } } } };
}

function isLegacyVideoAsset(asset: ReturnType<typeof mediaStateToLegacyAsset>) {
  return asset.type === "shot_video" || /\.(mp4|webm|mov)(\?|$)/i.test(asset.url);
}

function isLegacyUploadedAsset(asset: ReturnType<typeof mediaStateToLegacyAsset>) {
  return /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(asset.url);
}

async function getAssetCounts(userId: string) {
  const rows = await prisma.userAssetState.findMany({
    where: { userId, hiddenAt: null, mediaAsset: { archivedAt: null } },
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
          createdAt: true,
          firstSeenAt: true,
          systemName: true,
          initialName: true,
          legacyLibrarySource: true,
        },
      },
    },
  });
  const counts: Record<string, number> = { character_image: 0, scene_image: 0, shot_image: 0, trash: 0, conversation_images: 0, conversation_uploads: 0, conversation_videos: 0, workflow_images: 0, workflow_uploads: 0, workflow_videos: 0, asset_generation: 0, conversation: 0, workflow: 0 };
  for (const row of rows) {
    const asset = mediaStateToLegacyAsset(row);
    if (asset.type === "trash" || asset.deletedAt) {
      counts.trash += 1;
      continue;
    }
    if (asset.librarySource === "asset_generation") {
      counts.asset_generation += 1;
      counts[asset.type] = (counts[asset.type] ?? 0) + 1;
      continue;
    }
    if (row.currentCategory === "workflow_images" || row.currentCategory === "workflow_uploads" || row.currentCategory === "workflow_videos") {
      counts.workflow += 1;
      counts[row.currentCategory] = (counts[row.currentCategory] ?? 0) + 1;
      continue;
    }
    counts.conversation += 1;
    if (row.currentCategory === "conversation_videos" || isLegacyVideoAsset(asset)) counts.conversation_videos += 1;
    else if (row.currentCategory === "conversation_uploads" || isLegacyUploadedAsset(asset)) counts.conversation_uploads += 1;
    else counts.conversation_images += 1;
  }
  return counts;
}

const assetRowSelect = {
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
      createdAt: true,
      firstSeenAt: true,
      systemName: true,
      initialName: true,
      legacyLibrarySource: true,
    },
  },
} satisfies Prisma.UserAssetStateSelect;

function mergeWorkspaceAssets(existingState: unknown, nextState: unknown) {
  if (!isRecord(existingState) || !isRecord(nextState)) return nextState;
  const preservedState: Record<string, unknown> = { ...nextState };
  if (Array.isArray(existingState.assets) && !("assets" in nextState)) preservedState.assets = existingState.assets;
  if (Array.isArray(existingState.assetGenerateJobs) && !("assetGenerateJobs" in nextState)) preservedState.assetGenerateJobs = existingState.assetGenerateJobs;
  const nextRecord = preservedState;
  if (!Array.isArray(existingState.assets) || !Array.isArray(nextRecord.assets)) return nextRecord;
  const existingByKey = new Map(existingState.assets.map((asset) => [getAssetMergeKey(asset), asset]).filter(([key]) => Boolean(key)) as Array<[string, unknown]>);
  const nextAssets = nextRecord.assets.map((asset) => {
    const key = getAssetMergeKey(asset);
    const existingAsset = key ? existingByKey.get(key) : undefined;
    if (!isRecord(asset) || !isRecord(existingAsset)) return asset;
    const incomingType = typeof asset.type === "string" ? asset.type : "";
    const existingType = typeof existingAsset.type === "string" ? existingAsset.type : "";
    const incomingSource = typeof asset.librarySource === "string" ? asset.librarySource : "";
    const existingSource = typeof existingAsset.librarySource === "string" ? existingAsset.librarySource : "";
    const isIncomingDelete = incomingType === "trash" || toFiniteNumber(asset.deletedAt) > 0;
    const shouldPreserveClassification = !isIncomingDelete && existingSource === "asset_generation" && incomingSource !== "asset_generation";
    const shouldPreserveTypedAsset = !isIncomingDelete && ["character_image", "scene_image", "shot_image"].includes(existingType) && (incomingType === "other" || incomingType === "");
    return shouldPreserveClassification || shouldPreserveTypedAsset ? { ...asset, type: existingAsset.type, librarySource: existingAsset.librarySource, name: existingAsset.name, systemName: existingAsset.systemName, userName: existingAsset.userName, lockedType: existingAsset.lockedType } : asset;
  });
  if (nextAssets.length >= existingState.assets.length) return { ...nextRecord, assets: nextAssets };

  const seen = new Set(nextAssets.map(getAssetMergeKey).filter(Boolean));
  const restoredAssets = existingState.assets.filter((asset) => {
    const key = getAssetMergeKey(asset);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (restoredAssets.length === 0) return nextRecord;

  return { ...nextRecord, assets: [...nextAssets, ...restoredAssets] };
}

async function getWorkspaceStateWithoutLegacySessions(userId: string, state: unknown) {
  await migrateLegacyUserProfileFromWorkspace(userId, state);
  const cleanState = await applyLedgerUsageSummaries(userId, compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(state))));
  const stateWithoutSessions = stripSessionsFromWorkspaceState(cleanState);
  return { cleanState, state: stateWithoutSessions };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  const params = new URL(request.url).searchParams;
  const summaryOnly = params.get("summary") === "1";
  const historyOnly = params.get("historyOnly") === "1";
  const assetsOnly = params.get("assetsOnly") === "1";
  const panel = params.get("panel");
  const limit = getPositiveInteger(params.get("limit"), DEFAULT_WORKSPACE_SESSION_LIMIT, 50) || DEFAULT_WORKSPACE_SESSION_LIMIT;
  const offset = getPositiveInteger(params.get("offset"), 0, 100000);

  if (summaryOnly && historyOnly) {
    const rows = await prisma.workspaceSession.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
      skip: offset,
      take: limit + 1,
      select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
    });
    const pageRows = rows.slice(0, limit);
    return Response.json({
      state: {
        sessions: pageRows.map((row) => workspaceSessionRowToPayload(row, false)),
        sessionsHasMore: rows.length > limit,
        sessionsNextOffset: offset + pageRows.length,
      },
    });
  }

  const workspace = await prisma.userWorkspaceState.findUnique({
    where: { userId: user.id },
  });

  let baseState: unknown = workspace?.state ?? null;

  if (assetsOnly) {
    const assetFilter = isAssetFilterKey(params.get("assetFilter")) ? params.get("assetFilter") as AssetFilterKey : undefined;
    const assetLimit = getPositiveInteger(params.get("assetLimit"), 60, 120) || 60;
    const assetOffset = getPositiveInteger(params.get("assetOffset"), 0, 100000);
    const countsPromise = getAssetCounts(user.id);
    if (assetFilter) {
      const rowsPromise = prisma.userAssetState.findMany({
        where: getAssetPageWhere(user.id, assetFilter),
        orderBy: [{ mediaAsset: { firstSeenAt: "desc" } }, { mediaAsset: { createdAt: "desc" } }, { id: "desc" }],
        skip: assetOffset,
        take: assetLimit + 1,
        select: assetRowSelect,
      });
      const [assetCounts, rows] = await Promise.all([countsPromise, rowsPromise]);
      const pageRows = rows.slice(0, assetLimit);
      return Response.json({
        state: {
          assets: pageRows.map(mediaStateToLegacyAsset),
          assetCounts,
          assetsHasMore: rows.length > assetLimit,
          assetsNextOffset: assetOffset + pageRows.length,
          assetFilter,
        },
      });
    }
    const assetRows = await prisma.userAssetState.findMany({
      where: { userId: user.id },
      orderBy: [{ mediaAsset: { firstSeenAt: "desc" } }, { mediaAsset: { createdAt: "desc" } }, { id: "desc" }],
      select: assetRowSelect,
    });
    const assetCounts = await countsPromise;
    if (assetRows.length > 0) {
      return Response.json({
        state: {
          assets: assetRows.map(mediaStateToLegacyAsset),
          assetCounts,
        },
      });
    }
    const cleanState = isRecord(baseState) ? replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(baseState)) : {};
    const state = isRecord(cleanState) ? cleanState : {};
    return Response.json({
      state: {
        assets: Array.isArray(state.assets) ? state.assets : [],
        assetGenerateJobs: Array.isArray(state.assetGenerateJobs) ? state.assetGenerateJobs : [],
        assetFilter: state.assetFilter,
        assetScrollTopByFilter: state.assetScrollTopByFilter,
      },
    });
  }

  if (summaryOnly && panel === "chat") {
    const shellState = getWorkspaceShellState(baseState);
    const activeSessionId = typeof shellState.activeSessionId === "string" ? shellState.activeSessionId : "";
    const rows = await prisma.workspaceSession.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
      skip: offset,
      take: limit + 2,
      select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
    });
    const pageRows = rows.slice(0, limit);
    const activeRow = activeSessionId && !pageRows.some((row) => row.sessionId === activeSessionId)
      ? await prisma.workspaceSession.findFirst({
          where: { userId: user.id, sessionId: activeSessionId, deletedAt: null },
          select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
        })
      : null;
    const firstExtraRow = rows[limit];
    const activeRowWasFirstExtra = Boolean(activeRow && firstExtraRow?.sessionId === activeRow.sessionId);
    const nextActiveSessionId = (activeRow?.sessionId ?? (pageRows.some((row) => row.sessionId === activeSessionId) ? activeSessionId : "")) || (pageRows[0]?.sessionId ?? "");
    const activeMessagePage = nextActiveSessionId ? await getWorkspaceSessionMessages(user.id, nextActiveSessionId) : undefined;
    const sessionRows = activeRow ? [...pageRows, activeRow] : pageRows;
    return Response.json({
      state: {
        ...shellState,
        activeSessionId: nextActiveSessionId,
        sessions: sessionRows.map((row) => workspaceSessionRowToPayload(row, row.sessionId === nextActiveSessionId, row.sessionId === nextActiveSessionId ? activeMessagePage?.messages : undefined, row.sessionId === nextActiveSessionId ? activeMessagePage : undefined)),
        sessionsHasMore: rows.length > limit + (activeRowWasFirstExtra ? 1 : 0),
        sessionsNextOffset: offset + pageRows.length,
      },
    });
  }

  if (workspace?.state) {
    const cleaned = await getWorkspaceStateWithoutLegacySessions(user.id, workspace.state);
    baseState = cleaned.state;
    if (!isRecord(cleaned.cleanState) || !Array.isArray(cleaned.cleanState.sessions)) {
      if (hasJsonChanged(workspace.state, cleaned.state)) {
        await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: cleaned.state as Prisma.InputJsonValue } });
      }
    }
  }

  if (summaryOnly) {
    const activeSessionId = isRecord(baseState) && typeof baseState.activeSessionId === "string" ? baseState.activeSessionId : "";
    const rows = await prisma.workspaceSession.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
      skip: offset,
      take: limit + 2,
      select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
    });
    const pageRows = rows.slice(0, limit);
    const activeRow = activeSessionId && !pageRows.some((row) => row.sessionId === activeSessionId)
      ? await prisma.workspaceSession.findFirst({
          where: { userId: user.id, sessionId: activeSessionId, deletedAt: null },
          select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
        })
      : null;
    const firstExtraRow = rows[limit];
    const activeRowWasFirstExtra = Boolean(activeRow && firstExtraRow?.sessionId === activeRow.sessionId);
    const hasMore = rows.length > limit + (activeRowWasFirstExtra ? 1 : 0);
    const nextActiveSessionId = (activeRow?.sessionId ?? (pageRows.some((row) => row.sessionId === activeSessionId) ? activeSessionId : "")) || (pageRows[0]?.sessionId ?? "");
    const sessionRows = activeRow ? [...pageRows, activeRow] : pageRows;
    const activeMessagePage = !historyOnly && nextActiveSessionId ? await getWorkspaceSessionMessages(user.id, nextActiveSessionId) : undefined;
    const sessions = await applyLedgerUsageSummariesToSessions(
      user.id,
      sessionRows.map((row) => workspaceSessionRowToPayload(row, !historyOnly && row.sessionId === nextActiveSessionId, row.sessionId === nextActiveSessionId ? activeMessagePage?.messages : undefined, row.sessionId === nextActiveSessionId ? activeMessagePage : undefined)),
    );
    const state = {
      ...(isRecord(baseState) ? baseState : {}),
      activeSessionId: nextActiveSessionId,
      sessions,
      sessionsHasMore: hasMore,
      sessionsNextOffset: offset + pageRows.length,
    };

    return Response.json({ state });
  }

  const allRows = await prisma.workspaceSession.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
    select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, messagesJson: true, summaryJson: true, usageSummary: true, memorySummary: true },
  });
  if (allRows.length > 0) {
    const sessions = await applyLedgerUsageSummariesToSessions(user.id, allRows.map((row) => workspaceSessionRowToPayload(row, true)));
    return Response.json({ state: { ...(isRecord(baseState) ? baseState : {}), sessions } });
  }

  if (baseState) return Response.json({ state: { ...(isRecord(baseState) ? baseState : {}), sessions: [], sessionsHasMore: false, sessionsNextOffset: 0 } });

  return Response.json({ state: null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("工作区数据无效");

  await migrateLegacyUserProfileFromWorkspace(user.id, body);
  if (isRecord(body)) await upsertWorkspaceSessions(user.id, body.sessions);
  const cleanBody = stripSessionsFromWorkspaceState(compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(body))));
  const existingWorkspace = await prisma.userWorkspaceState.findUnique({ where: { userId: user.id }, select: { state: true } });
  const safeBody = mergeWorkspaceAssets(existingWorkspace?.state, cleanBody);

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: safeBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: safeBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
