import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits } from "@/lib/credits";
import { createOpenRouterVideoTask, getBytePlusEffectiveReferenceImages, getOpenRouterVideoTask, type VideoReferenceMode } from "@/lib/openrouter-video";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { validateReferenceImageCount } from "@/lib/upload-rules";
import { enqueueRemoteAssetSave } from "@/lib/media-save-queue";
import { getMediaSaveStatuses } from "@/lib/media-save-queue";
import { upsertVideoManifestEntry } from "@/lib/video-manifest";
import { isAgentVideoModelEnabled, isConversationVideoModelEnabled } from "@/lib/system-settings";
import { prisma } from "@/lib/prisma";
import { appendUploadRuleFeedbackLog } from "@/lib/upload-rule-feedback-log";
import { appendVideoDiagnosticsLog, summarizeVideoReference } from "@/lib/video-diagnostics-log";
import { createBytePlusAsset, getBytePlusAsset } from "@/lib/byteplus-assets";
import { Prisma } from "@prisma/client";

type UsageMeta = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
};

function withChargedUsage(usage: UsageMeta | undefined, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return usage;
  return { ...(usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny };
}

function getFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getUsageMeta(value: unknown): UsageMeta | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const usage = record.usage && typeof record.usage === "object" ? record.usage as Record<string, unknown> : record;
  const promptTokens = Math.max(0, Math.floor(getFiniteNumber(usage.promptTokens ?? usage.prompt_tokens) ?? 0));
  const completionTokens = Math.max(0, Math.floor(getFiniteNumber(usage.completionTokens ?? usage.completion_tokens) ?? 0));
  const totalTokens = Math.max(0, Math.floor(getFiniteNumber(usage.totalTokens ?? usage.total_tokens) ?? promptTokens + completionTokens));
  const usd = getFiniteNumber(usage.usd ?? usage.cost ?? usage.totalCost ?? usage.total_cost ?? usage.amount);

  if (totalTokens > 0 || usd !== undefined) return { promptTokens, completionTokens, totalTokens, usd };

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedUsage = getUsageMeta(record[key]);
    if (nestedUsage) return nestedUsage;
  }

  return undefined;
}

function withBytePlusVideoUsd(usage: UsageMeta | undefined, model: string | undefined, settings?: { resolution?: string }) {
  if (!usage || usage.usd !== undefined || !model?.startsWith("byteplus:video.")) return usage;
  const outputTokens = Math.max(0, usage.completionTokens ?? usage.totalTokens ?? 0);
  const pricePerMillion = model === "byteplus:video.seedance-2-0-fast" ? 5.6 : settings?.resolution === "1080p" ? 7.7 : 7.0;
  return { ...usage, usd: (outputTokens / 1_000_000) * pricePerMillion };
}

function isBytePlusVideoModel(model?: string) {
  return Boolean(model?.startsWith("byteplus:video."));
}

function getBytePlusReferenceRole(index: number, mode?: VideoReferenceMode) {
  if (mode === "first_last_frame") {
    if (index === 0) return "first_frame";
    if (index === 1) return "last_frame";
  }
  if (mode === "first_frame" && index === 0) return "first_frame";
  return "reference_image";
}

function summarizeVideoReferencesForLog(references: string[], mode?: VideoReferenceMode) {
  return references.map((url, index) => summarizeVideoReference(url, index, getBytePlusReferenceRole(index, mode)));
}

function isBytePlusHumanReferenceError(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /inputimagesensitivecontentdetected|privacyinformation|input image.*real person|real person|privacy information|真人|隐私/i.test(message) && !/output|copyright|版权/i.test(message);
}

function normalizeMediaUrlForMatch(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getAssetString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

async function getWorkspaceAssets(userId: string | undefined) {
  if (!userId) return [];
  const workspace = await prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } }).catch(() => null);
  const state = workspace?.state;
  const assets = state && typeof state === "object" && Array.isArray((state as { assets?: unknown }).assets) ? (state as { assets: unknown[] }).assets : [];
  return assets.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

async function resolveBytePlusVideoReferenceImages(userId: string | undefined, model: string | undefined, referenceImages: string[], assets?: Record<string, unknown>[]) {
  if (!userId || !isBytePlusVideoModel(model) || referenceImages.length === 0) return referenceImages;

  const workspaceAssets = assets ?? await getWorkspaceAssets(userId);
  if (workspaceAssets.length === 0) return referenceImages;

  const assetIdByUrl = new Map<string, string>();
  for (const record of workspaceAssets) {
    const url = getAssetString(record, "url");
    const bytePlusAssetId = getAssetString(record, "bytePlusAssetId");
    const status = getAssetString(record, "bytePlusAssetStatus");
    if (!url || !bytePlusAssetId || status !== "Active") continue;
    assetIdByUrl.set(normalizeMediaUrlForMatch(url), bytePlusAssetId);
  }

  let replacedCount = 0;
  const nextReferences = referenceImages.map((url) => {
    if (url.startsWith("asset://")) return url;
    const assetId = assetIdByUrl.get(normalizeMediaUrlForMatch(url));
    if (!assetId) return url;
    replacedCount += 1;
    return `asset://${assetId}`;
  });

  if (replacedCount > 0) {
    logVideoTiming("BytePlus asset references applied", { model, referenceCount: referenceImages.length, replacedCount });
  }

  return nextReferences;
}

function toPublicAssetUrl(value: string) {
  const url = value.trim();
  if (!url || url.startsWith("asset://")) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/generated/")) {
    const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "https://main.venusface.com").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return "";
}

async function toReviewablePublicAssetUrl(value: string, userId?: string) {
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) {
    const saved = (await getMediaSaveStatuses([url], userId)).find((job) => job.status === "saved" && job.localUrl);
    if (saved?.localUrl) return toPublicAssetUrl(saved.localUrl);
    throw new Error("review reference unavailable");
  }
  return toPublicAssetUrl(url);
}

async function waitForBytePlusAssetActive(assetId: string) {
  const startedAt = Date.now();
  let lastAsset: Awaited<ReturnType<typeof getBytePlusAsset>> | undefined;
  while (Date.now() - startedAt < 180_000) {
    lastAsset = await getBytePlusAsset(assetId);
    if (lastAsset.Status === "Active") return lastAsset;
    if (lastAsset.Status === "Failed") throw new Error(lastAsset.Error?.Message || "参考图审核未通过，无法作为该视频模型的真人参考图使用。");
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(lastAsset?.Error?.Message || "参考图审核仍在处理中，请稍后重试。");
}

async function patchWorkspaceBytePlusAssets(userId: string | undefined, updates: AutoBytePlusAssetReviewItem[]) {
  if (!userId || updates.length === 0) return;
  const workspace = await prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } }).catch(() => null);
  const state = workspace?.state;
  if (!state || typeof state !== "object" || Array.isArray(state) || !Array.isArray((state as { assets?: unknown }).assets)) return;

  const updateByUrl = new Map(updates.map((item) => [normalizeMediaUrlForMatch(item.url), item]));
  let changed = false;
  const nextAssets = (state as { assets: unknown[] }).assets.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    const url = getAssetString(record, "url");
    const update = url ? updateByUrl.get(normalizeMediaUrlForMatch(url)) : undefined;
    if (!update) return item;
    changed = true;
    return {
      ...record,
      bytePlusAssetId: update.assetId,
      bytePlusAssetGroupId: update.groupId,
      bytePlusAssetStatus: update.status,
      bytePlusAssetError: update.error,
      bytePlusAssetUpdatedAt: Date.now(),
    };
  });

  if (!changed) return;
  await prisma.userWorkspaceState.update({ where: { userId }, data: { state: { ...(state as Record<string, unknown>), assets: nextAssets } as Prisma.InputJsonValue } });
}

type AutoBytePlusAssetReviewItem = {
  url: string;
  assetId: string;
  groupId?: string;
  status: "Active" | "Processing" | "Failed";
  error?: string;
};

async function autoReviewBytePlusVideoReferences(input: { userId: string | undefined; model: string | undefined; referenceImages: string[]; requestId?: string; referenceMode?: VideoReferenceMode; settings?: unknown; conversationId?: string; conversationTitle?: string }) {
  const { userId, model, referenceImages, requestId, referenceMode, settings, conversationId, conversationTitle } = input;
  if (!userId || !isBytePlusVideoModel(model) || referenceImages.length === 0) return undefined;

  void appendVideoDiagnosticsLog({
    event: "byteplus-auto-review-start",
    requestId,
    conversationId,
    conversationTitle,
    model,
    provider: "byteplus",
    referenceMode,
    referenceCount: referenceImages.length,
    settings,
    references: summarizeVideoReferencesForLog(referenceImages, referenceMode),
  });

  const workspaceAssets = await getWorkspaceAssets(userId);
  const assetByUrl = new Map<string, Record<string, unknown>>();
  for (const record of workspaceAssets) {
    const url = normalizeMediaUrlForMatch(getAssetString(record, "url"));
    if (url) assetByUrl.set(url, record);
  }
  const updates: AutoBytePlusAssetReviewItem[] = [];
  const references: string[] = [];
  let triggered = false;

  for (const reference of referenceImages) {
    if (!reference || reference.startsWith("asset://")) {
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-skip-asset-reference", requestId, model, provider: "byteplus", referenceMode, references: [summarizeVideoReference(reference, references.length, getBytePlusReferenceRole(references.length, referenceMode))] });
      references.push(reference);
      continue;
    }

    const matchedAsset = assetByUrl.get(normalizeMediaUrlForMatch(reference));
    let assetId = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetId") : "";
    let groupId = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetGroupId") : "";
    let status = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetStatus") : "";

    if (assetId && status === "Active") {
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-reuse-active-asset", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, getBytePlusReferenceRole(references.length, referenceMode)), status, assetId }] });
      references.push(`asset://${assetId}`);
      continue;
    }

    triggered = true;
    if (!assetId) {
      let publicUrl = "";
      try {
        publicUrl = await toReviewablePublicAssetUrl(reference, userId);
        if (!publicUrl) throw new Error("参考图不是可审核的公网图片地址。");
        void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-public-url-resolved", requestId, model, provider: "byteplus", referenceMode, references: [summarizeVideoReference(publicUrl, references.length, getBytePlusReferenceRole(references.length, referenceMode))] });
      } catch (error) {
        void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-public-url-failed", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, getBytePlusReferenceRole(references.length, referenceMode)), error }] });
        throw error;
      }
      const created = await createBytePlusAsset({ url: publicUrl, name: matchedAsset ? getAssetString(matchedAsset, "name") || "FlashMuse reference" : "FlashMuse reference", assetType: "Image", moderationStrategy: "Skip" });
      assetId = created.id;
      groupId = created.groupId;
      status = "Processing";
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-asset-created", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, getBytePlusReferenceRole(references.length, referenceMode)), status, assetId }] });
    }

    let activeAsset: Awaited<ReturnType<typeof waitForBytePlusAssetActive>>;
    try {
      activeAsset = await waitForBytePlusAssetActive(assetId);
    } catch (error) {
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-asset-failed", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, getBytePlusReferenceRole(references.length, referenceMode)), status, assetId, error }] });
      throw error;
    }
    const update: AutoBytePlusAssetReviewItem = { url: reference, assetId, groupId: groupId || activeAsset.GroupId, status: "Active" };
    updates.push(update);
    references.push(`asset://${assetId}`);
    void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-asset-active", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length - 1, getBytePlusReferenceRole(references.length - 1, referenceMode)), status: "Active", assetId }] });
  }

  if (!triggered) return undefined;
  await patchWorkspaceBytePlusAssets(userId, updates).catch((error) => logVideoTiming("BytePlus asset workspace patch failed", { error: error instanceof Error ? error.message : String(error) }));
  void appendVideoDiagnosticsLog({
    event: "byteplus-auto-review-complete",
    requestId,
    conversationId,
    conversationTitle,
    model,
    provider: "byteplus",
    referenceMode,
    referenceCount: referenceImages.length,
    assetReferenceCount: references.filter((url) => url.startsWith("asset://")).length,
    settings,
    references: summarizeVideoReferencesForLog(references, referenceMode),
    autoReview: { updateCount: updates.length },
  });
  return { references, updates };
}

function getBytePlusProviderKey(modelId: string | undefined, source: string | undefined) {
  if (!modelId?.startsWith("byteplus:video.")) return undefined;
  const prefix = source === "agent_video_generation" ? "agent-video" : "video";
  if (modelId.endsWith("seedance-2-0-fast")) return `${prefix}.seedance-2-0-fast`;
  if (modelId.endsWith("seedance-2-0")) return `${prefix}.seedance-2-0`;
  return undefined;
}

function logVideoTiming(label: string, data: Record<string, unknown>) {
  console.log(`[video-generation] ${label}`, data);
}

function getCreateTaskId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const preferredKeys = ["taskId", "task_id", "taskID", "id", "generationId", "generation_id"];

  for (const key of preferredKeys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number") return String(item);
  }

  const priorityContainers = ["data", "result", "task", "content", "payload"];
  for (const key of priorityContainers) {
    const taskId = getCreateTaskId(record[key]);
    if (taskId) return taskId;
  }

  return undefined;
}

function normalizeVideoStatus(status: unknown) {
  if (typeof status === "number") {
    if (status === 0) return "queued";
    if (status === 1) return "running";
    if (status === 2) return "succeeded";
    if (status === 3) return "failed";
    if (status === 4) return "cancelled";
  }

  if (typeof status === "string") {
    const value = status.trim().toLowerCase();
    if (value === "pending") return "queued";
    if (value === "in_progress" || value === "processing") return "running";
    if (value === "completed" || value === "complete" || value === "done") return "succeeded";
    return value;
  }

  return undefined;
}

function getVideoErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const success = record.success;
  const code = record.code;
  const message = record.msg ?? record.message ?? record.error;

  if (success === false || (typeof code === "string" && code !== "0" && code !== "200")) {
    return [
      typeof code === "string" || typeof code === "number" ? `code=${code}` : "",
      typeof message === "string" ? message : "视频平台返回失败",
    ]
      .filter(Boolean)
      .join("，");
  }

  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object" && typeof (message as { message?: unknown }).message === "string") return (message as { message: string }).message;

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedMessage = getVideoErrorMessage(record[key]);
    if (nestedMessage) return nestedMessage;
  }

  return undefined;
}

function getTaskStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const status = normalizeVideoStatus(record.status ?? record.state ?? record.taskStatus ?? record.task_status);
  if (status) return status;

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedStatus = getTaskStatus(record[key]);
    if (nestedStatus) return nestedStatus;
  }

  return undefined;
}

function getVideoUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value) && /(\.mp4|\.mov|\.webm)(\?|$)/i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /^https?:\/\//.test(item)) return item;

      const videoUrl = getVideoUrl(item);
      if (videoUrl) return videoUrl;
    }

    return undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const keys = ["video_url", "videoUrl", "url", "video", "outputUrl", "output_url", "message", "unsigned_urls", "urls"];

  for (const key of keys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }

  for (const item of Object.values(record)) {
    const videoUrl = getVideoUrl(item);
    if (videoUrl) return videoUrl;
  }

  return undefined;
}

export async function POST(request: Request) {
  let body: {
    prompt?: string;
    model?: string;
    taskId?: string;
    referenceImages?: string[];
    settings?: { ratio?: string; resolution?: string; duration?: string };
    conversationId?: string;
    conversationTitle?: string;
    requestId?: string;
    usage?: UsageMeta;
    metadata?: { creditSource?: string };
    autoBytePlusAssetReview?: boolean;
    referenceMode?: VideoReferenceMode;
  } | undefined;

  try {
    body = (await request.json()) as {
      prompt?: string;
      model?: string;
      taskId?: string;
      referenceImages?: string[];
      settings?: { ratio?: string; resolution?: string; duration?: string };
      conversationId?: string;
      conversationTitle?: string;
      requestId?: string;
      usage?: UsageMeta;
      metadata?: { creditSource?: string };
      autoBytePlusAssetReview?: boolean;
      referenceMode?: VideoReferenceMode;
    };

    const taskId = body.taskId?.trim();
    const prompt = body.prompt?.trim();

    if (taskId) {
      const startedAt = Date.now();
      const task = await getOpenRouterVideoTask(taskId);
      const queryDoneAt = Date.now();
      const videoError = getVideoErrorMessage(task);

      if (videoError) {
        if (isBytePlusVideoModel(body.model)) {
          void appendVideoDiagnosticsLog({
            event: "byteplus-polling-error",
            requestId: body.requestId ?? taskId,
            conversationId: body.conversationId,
            conversationTitle: body.conversationTitle,
            model: body.model,
            provider: "byteplus",
            taskId,
            settings: body.settings,
            error: videoError,
            extra: { queryMs: queryDoneAt - startedAt },
          });
        }
        const codedError = await createCodedApiError(new Error(videoError), GENERIC_MEDIA_ERROR_MESSAGE, "video task polling failed");
        return NextResponse.json({ ...task, status: "failed", error: { message: codedError.error }, errorCode: codedError.errorCode });
      }

      const status = getTaskStatus(task) ?? normalizeVideoStatus(task.status) ?? "running";
      const videoUrl = getVideoUrl(task);

      if ((status === "succeeded" || status === "success" || status === "completed" || status === "complete") && videoUrl) {
        const user = await getCurrentUser();
        const needsOpenRouterAuth = videoUrl.startsWith("https://openrouter.ai/api/v1/videos/");
        const saveJob = await enqueueRemoteAssetSave({
          remoteUrl: videoUrl,
          type: "video",
          authProvider: needsOpenRouterAuth ? "openrouter" : undefined,
          videoTaskId: taskId,
          requestId: body.requestId ?? taskId,
          model: body.model,
          prompt: body.prompt ?? "",
          userId: user?.id,
        });
        const saveQueuedAt = Date.now();

        logVideoTiming(isBytePlusVideoModel(body.model) ? "BytePlus completed" : "OpenRouter completed", {
          requestId: body.requestId ?? taskId,
          model: body.model,
          taskId,
          status,
          queryMs: queryDoneAt - startedAt,
          saveQueueMs: saveQueuedAt - queryDoneAt,
          totalMs: saveQueuedAt - startedAt,
          mediaSaveJobId: saveJob?.id,
          savedLocal: saveJob?.status === "saved",
          saveStatus: saveJob?.status,
          saveAttempts: saveJob?.attempts,
        });
        if (isBytePlusVideoModel(body.model)) {
          void appendVideoDiagnosticsLog({
            event: "byteplus-polling-succeeded",
            requestId: body.requestId ?? taskId,
            conversationId: body.conversationId,
            conversationTitle: body.conversationTitle,
            model: body.model,
            provider: "byteplus",
            taskId,
            settings: body.settings,
            extra: {
              status,
              queryMs: queryDoneAt - startedAt,
              saveQueueMs: saveQueuedAt - queryDoneAt,
              mediaSaveJobId: saveJob?.id,
              saveStatus: saveJob?.status,
              savedLocal: saveJob?.status === "saved",
            },
          });
        }

        await upsertVideoManifestEntry({ taskId, prompt: body.prompt ?? "", localVideoUrl: saveJob?.localUrl ?? videoUrl, remoteVideoUrl: videoUrl, posterUrl: saveJob?.posterUrl });

        const usage = withBytePlusVideoUsd(getUsageMeta(task) ?? body.usage, body.model, body.settings);
        const credit = user ? await chargeCredits(user.id, "video", usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ?? taskId, label: "视频生成", model: body.model, videoCount: 1, metadata: { ...body.metadata, settings: body.settings, ratio: body.settings?.ratio, resolution: body.settings?.resolution, duration: body.settings?.duration, originalPrompt: body.prompt, mediaUrls: [saveJob?.localUrl ?? videoUrl], remoteMediaUrls: [videoUrl], posterUrl: saveJob?.posterUrl, delivered: true, savedLocal: saveJob?.status === "saved", localSaveStatus: saveJob?.status ?? "pending", mediaSaveJobId: saveJob?.id } }) : undefined;

        return NextResponse.json({
          ...task,
          status: "succeeded",
          usage: withChargedUsage(usage, credit),
          credit,
          content: {
            ...task.content,
            video_url: saveJob?.localUrl ?? videoUrl,
            remote_video_url: videoUrl,
            poster_url: saveJob?.posterUrl,
            local_save_status: saveJob?.status ?? "pending",
            media_save_job_id: saveJob?.id,
          },
        });
      }

      if (status === "succeeded" || status === "success" || status === "completed" || status === "complete") {
        if (isBytePlusVideoModel(body.model)) {
          void appendVideoDiagnosticsLog({
            event: "byteplus-polling-completed-without-url",
            requestId: body.requestId ?? taskId,
            conversationId: body.conversationId,
            conversationTitle: body.conversationTitle,
            model: body.model,
            provider: "byteplus",
            taskId,
            settings: body.settings,
            extra: { status, queryMs: queryDoneAt - startedAt },
          });
        }
        const codedError = await createCodedApiError(new Error("视频平台返回已完成，但没有返回视频地址。"), GENERIC_MEDIA_ERROR_MESSAGE, "video task completed without url");
        return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
      }

      if (isBytePlusVideoModel(body.model)) {
        logVideoTiming("BytePlus polling", {
          model: body.model,
          taskId,
          status,
          queryMs: queryDoneAt - startedAt,
          hasVideoUrl: Boolean(videoUrl),
        });
      }

      return NextResponse.json({ ...task, status, usage: getUsageMeta(task), content: { ...task.content, video_url: videoUrl } });
    }

    if (!prompt) {
      return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
    }
    const creditSource = body.metadata?.creditSource;
    if (body.model && !(creditSource === "agent_video_generation" ? isAgentVideoModelEnabled(body.model) : isConversationVideoModelEnabled(body.model))) return NextResponse.json({ error: "连接不到模型，请联系管理员！" }, { status: 400 });
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : [];
    if (isBytePlusVideoModel(body.model) && body.referenceMode === "first_frame" && referenceImages.length < 1) return NextResponse.json({ error: "首帧生视频需要至少一张参考图" }, { status: 400 });
    if (isBytePlusVideoModel(body.model) && body.referenceMode === "first_last_frame" && referenceImages.length < 2) return NextResponse.json({ error: "首尾帧生视频需要至少两张参考图" }, { status: 400 });
    const referenceLimitError = validateReferenceImageCount({ mode: "video", modelId: body.model, transportMode: "local-base64" }, referenceImages.length);
    if (referenceLimitError) return NextResponse.json({ error: referenceLimitError }, { status: 400 });

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "video");
    const effectiveReferenceImages = isBytePlusVideoModel(body.model) ? getBytePlusEffectiveReferenceImages(referenceImages, body.referenceMode) : referenceImages;
    const modelReferenceImages = await resolveBytePlusVideoReferenceImages(user?.id, body.model, effectiveReferenceImages);
    if (isBytePlusVideoModel(body.model)) {
      void appendVideoDiagnosticsLog({
        event: "byteplus-create-request",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        model: body.model,
        provider: "byteplus",
        referenceMode: body.referenceMode,
        referenceCount: referenceImages.length,
        assetReferenceCount: modelReferenceImages.filter((url) => url.startsWith("asset://")).length,
        settings: body.settings,
        promptLength: prompt.length,
        references: summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
        extra: {
          creditSource,
          autoBytePlusAssetReview: Boolean(body.autoBytePlusAssetReview),
          originalReferenceCount: referenceImages.length,
          ignoredReferenceCount: Math.max(0, referenceImages.length - effectiveReferenceImages.length),
        },
      });
    }

    const createStartedAt = Date.now();
    let autoBytePlusAssetReview: Awaited<ReturnType<typeof autoReviewBytePlusVideoReferences>> | undefined;
    let task: Awaited<ReturnType<typeof createOpenRouterVideoTask>>;
    try {
      task = await createOpenRouterVideoTask(prompt, modelReferenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode });
    } catch (error) {
      if (!isBytePlusHumanReferenceError(error) || referenceImages.length === 0) throw error;
      void appendVideoDiagnosticsLog({
        event: "byteplus-create-human-reference-error",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        model: body.model,
        provider: "byteplus",
        referenceMode: body.referenceMode,
        referenceCount: effectiveReferenceImages.length,
        settings: body.settings,
        references: summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
        error,
        extra: { autoReviewRequested: Boolean(body.autoBytePlusAssetReview) },
      });
      if (!body.autoBytePlusAssetReview) return NextResponse.json({ status: "reviewing", autoBytePlusAssetReview: { triggered: true } });
      logVideoTiming("BytePlus human reference auto review started", { model: body.model, requestId: body.requestId, referenceCount: referenceImages.length });
      autoBytePlusAssetReview = await autoReviewBytePlusVideoReferences({ userId: user?.id, model: body.model, referenceImages: effectiveReferenceImages, requestId: body.requestId, referenceMode: body.referenceMode, settings: body.settings, conversationId: body.conversationId, conversationTitle: body.conversationTitle });
      if (!autoBytePlusAssetReview) throw error;
      task = await createOpenRouterVideoTask(prompt, autoBytePlusAssetReview.references, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode });
      logVideoTiming("BytePlus human reference auto review completed", { model: body.model, requestId: body.requestId, reviewedCount: autoBytePlusAssetReview.updates.length });
    }
    const createDoneAt = Date.now();
    const videoError = getVideoErrorMessage(task);

    if (videoError) {
      if (isBytePlusVideoModel(body.model)) {
        void appendVideoDiagnosticsLog({
          event: "byteplus-create-returned-error",
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          model: body.model,
          provider: "byteplus",
          referenceMode: body.referenceMode,
          referenceCount: effectiveReferenceImages.length,
          settings: body.settings,
          references: summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
          error: videoError,
        });
      }
      if (isBytePlusHumanReferenceError(videoError) && referenceImages.length > 0) {
        if (!body.autoBytePlusAssetReview) return NextResponse.json({ status: "reviewing", autoBytePlusAssetReview: { triggered: true } });
        logVideoTiming("BytePlus human reference auto review started", { model: body.model, requestId: body.requestId, referenceCount: referenceImages.length });
        autoBytePlusAssetReview = await autoReviewBytePlusVideoReferences({ userId: user?.id, model: body.model, referenceImages: effectiveReferenceImages, requestId: body.requestId, referenceMode: body.referenceMode, settings: body.settings, conversationId: body.conversationId, conversationTitle: body.conversationTitle });
        if (autoBytePlusAssetReview) {
          task = await createOpenRouterVideoTask(prompt, autoBytePlusAssetReview.references, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode });
          logVideoTiming("BytePlus human reference auto review completed", { model: body.model, requestId: body.requestId, reviewedCount: autoBytePlusAssetReview.updates.length });
        }
      }

      const retryVideoError = getVideoErrorMessage(task);
      if (retryVideoError && isBytePlusVideoModel(body.model)) {
        void appendVideoDiagnosticsLog({
          event: "byteplus-create-after-auto-review-error",
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          model: body.model,
          provider: "byteplus",
          referenceMode: body.referenceMode,
          referenceCount: effectiveReferenceImages.length,
          settings: body.settings,
          references: summarizeVideoReferencesForLog(autoBytePlusAssetReview?.references ?? modelReferenceImages, body.referenceMode),
          autoReview: autoBytePlusAssetReview ? { updateCount: autoBytePlusAssetReview.updates.length } : undefined,
          error: retryVideoError,
        });
      }
      if (!retryVideoError) {
        const retryId = task.polling_url ?? task.pollingUrl ?? getCreateTaskId(task);
        if (!retryId) {
          const codedError = await createCodedApiError(new Error("Missing video task id"), GENERIC_MEDIA_ERROR_MESSAGE, "video task id missing after auto review");
          return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
        }
        await upsertVideoManifestEntry({ taskId: retryId, prompt, model: body.model, settings: body.settings });
        return NextResponse.json({ ...task, id: retryId, job_id: getCreateTaskId(task), usage: getUsageMeta(task), autoBytePlusAssetReview: autoBytePlusAssetReview ? { triggered: true, assets: autoBytePlusAssetReview.updates } : undefined });
      }

      if (referenceImages.length > 0) {
        void appendUploadRuleFeedbackLog({
          source: "video",
          mode: "video",
          model: body.model,
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          error: retryVideoError,
          referenceImageCount: referenceImages.length,
          imageCount: referenceImages.length,
          settings: body.settings,
        });
      }
      const codedError = await createCodedApiError(new Error(retryVideoError), GENERIC_MEDIA_ERROR_MESSAGE, "video task create failed");
      return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
    }

    const id = task.polling_url ?? task.pollingUrl ?? getCreateTaskId(task);

    if (!id) {
      if (referenceImages.length > 0) {
        void appendUploadRuleFeedbackLog({
          source: "video",
          mode: "video",
          model: body.model,
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          error: "Missing video task id",
          referenceImageCount: referenceImages.length,
          imageCount: referenceImages.length,
          settings: body.settings,
        });
      }
      const codedError = await createCodedApiError(new Error("Missing video task id"), GENERIC_MEDIA_ERROR_MESSAGE, "video task id missing");
      return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
    }

    await upsertVideoManifestEntry({ taskId: id, prompt, model: body.model, settings: body.settings });

    if (isBytePlusVideoModel(body.model)) {
      logVideoTiming("BytePlus created", {
        model: body.model,
        taskId: id,
        createMs: createDoneAt - createStartedAt,
        ratio: body.settings?.ratio,
        resolution: body.settings?.resolution,
        duration: body.settings?.duration,
        referenceMode: body.referenceMode,
        referenceCount: modelReferenceImages.length,
        assetReferenceCount: modelReferenceImages.filter((url) => url.startsWith("asset://")).length,
      });
      void appendVideoDiagnosticsLog({
        event: "byteplus-create-success",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        model: body.model,
        provider: "byteplus",
        taskId: id,
        referenceMode: body.referenceMode,
        referenceCount: modelReferenceImages.length,
        assetReferenceCount: modelReferenceImages.filter((url) => url.startsWith("asset://")).length,
        settings: body.settings,
        promptLength: prompt.length,
        references: summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
        autoReview: autoBytePlusAssetReview ? { updateCount: autoBytePlusAssetReview.updates.length } : undefined,
        extra: { createMs: createDoneAt - createStartedAt },
      });
    }

    return NextResponse.json({ ...task, id, job_id: getCreateTaskId(task), usage: getUsageMeta(task), autoBytePlusAssetReview: autoBytePlusAssetReview ? { triggered: true, assets: autoBytePlusAssetReview.updates } : undefined });
  } catch (error) {
    const referenceImageCount = Array.isArray(body?.referenceImages) ? body.referenceImages.length : 0;
    if (referenceImageCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "video",
        mode: "video",
        model: body?.model,
        requestId: body?.requestId ?? body?.taskId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        referenceImageCount,
        imageCount: referenceImageCount,
        settings: body?.settings,
      });
    }
    if (isBytePlusVideoModel(body?.model) || body?.referenceMode === "first_frame" || body?.referenceMode === "last_frame" || body?.referenceMode === "first_last_frame") {
      void appendVideoDiagnosticsLog({
        event: "video-request-error",
        requestId: body?.requestId ?? body?.taskId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        model: body?.model,
        provider: isBytePlusVideoModel(body?.model) ? "byteplus" : "openrouter",
        referenceMode: body?.referenceMode,
        referenceCount: referenceImageCount,
        settings: body?.settings,
        references: summarizeVideoReferencesForLog(Array.isArray(body?.referenceImages) ? body.referenceImages : [], body?.referenceMode),
        error,
      });
    }
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "video request failed");
    return NextResponse.json(codedError, { status: 500 });
  }
}
