import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits } from "@/lib/credits";
import { createOpenRouterVideoTask, getOpenRouterVideoTask } from "@/lib/openrouter-video";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { validateReferenceImageCount } from "@/lib/upload-rules";
import { enqueueRemoteAssetSave } from "@/lib/media-save-queue";
import { upsertVideoManifestEntry } from "@/lib/video-manifest";
import { isAgentVideoModelEnabled, isConversationVideoModelEnabled } from "@/lib/system-settings";

type UsageMeta = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
};

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
  try {
    const body = (await request.json()) as {
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
    };

    const taskId = body.taskId?.trim();
    const prompt = body.prompt?.trim();

    if (taskId) {
      const startedAt = Date.now();
      const task = await getOpenRouterVideoTask(taskId);
      const queryDoneAt = Date.now();
      const videoError = getVideoErrorMessage(task);

      if (videoError) {
        const codedError = await createCodedApiError(new Error(videoError), GENERIC_MEDIA_ERROR_MESSAGE, "video task polling failed");
        return NextResponse.json({ ...task, status: "failed", error: { message: codedError.error }, errorCode: codedError.errorCode });
      }

      const status = getTaskStatus(task) ?? normalizeVideoStatus(task.status) ?? "running";
      const videoUrl = getVideoUrl(task);

      if ((status === "succeeded" || status === "success" || status === "completed" || status === "complete") && videoUrl) {
        const needsOpenRouterAuth = videoUrl.startsWith("https://openrouter.ai/api/v1/videos/");
        const saveJob = await enqueueRemoteAssetSave({
          remoteUrl: videoUrl,
          type: "video",
          authProvider: needsOpenRouterAuth ? "openrouter" : undefined,
          videoTaskId: taskId,
          requestId: body.requestId ?? taskId,
          model: body.model,
          prompt: body.prompt ?? "",
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

        await upsertVideoManifestEntry({ taskId, prompt: body.prompt ?? "", localVideoUrl: saveJob?.localUrl ?? videoUrl, remoteVideoUrl: videoUrl, posterUrl: saveJob?.posterUrl });

        const user = await getCurrentUser();
        const usage = withBytePlusVideoUsd(getUsageMeta(task) ?? body.usage, body.model, body.settings);
        const credit = user ? await chargeCredits(user.id, "video", usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ?? taskId, label: "视频生成", model: body.model, videoCount: 1, metadata: { ...body.metadata, mediaUrls: [saveJob?.localUrl ?? videoUrl], remoteMediaUrls: [videoUrl], posterUrl: saveJob?.posterUrl, delivered: true, savedLocal: saveJob?.status === "saved", localSaveStatus: saveJob?.status ?? "pending", mediaSaveJobId: saveJob?.id } }) : undefined;

        return NextResponse.json({
          ...task,
          status: "succeeded",
          usage,
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
    const referenceLimitError = validateReferenceImageCount({ mode: "video", modelId: body.model, transportMode: "local-base64" }, referenceImages.length);
    if (referenceLimitError) return NextResponse.json({ error: referenceLimitError }, { status: 400 });

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "video");

    const createStartedAt = Date.now();
    const task = await createOpenRouterVideoTask(prompt, referenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource) });
    const createDoneAt = Date.now();
    const videoError = getVideoErrorMessage(task);

    if (videoError) {
      const codedError = await createCodedApiError(new Error(videoError), GENERIC_MEDIA_ERROR_MESSAGE, "video task create failed");
      return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
    }

    const id = task.polling_url ?? task.pollingUrl ?? getCreateTaskId(task);

    if (!id) {
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
        referenceCount: referenceImages.length,
      });
    }

    return NextResponse.json({ ...task, id, job_id: getCreateTaskId(task), usage: getUsageMeta(task) });
  } catch (error) {
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "video request failed");
    return NextResponse.json(codedError, { status: 500 });
  }
}
