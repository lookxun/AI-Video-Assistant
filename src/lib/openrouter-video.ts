import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { DEFAULT_VIDEO_MODEL, resolveVideoSettingsForModel } from "@/lib/models";
import { getBytePlusBaseUrl, getBytePlusModelForRequest, getConfiguredBytePlusApiKey, getConfiguredOpenRouterApiKey } from "@/lib/system-settings";

type VideoSettings = {
  ratio?: string;
  resolution?: string;
  duration?: string;
};

export type VideoReferenceMode = "reference" | "first_frame" | "last_frame" | "first_last_frame";

type OpenRouterVideoImage = {
  type: "image_url";
  image_url: { url: string };
};

export type OpenRouterVideoTask = {
  id?: string;
  generation_id?: string;
  polling_url?: string;
  pollingUrl?: string;
  status?: string;
  unsigned_urls?: string[];
  content?: { video_url?: string; remote_video_url?: string };
  error?: { message?: string } | string;
};

type CreateVideoOptions = {
  generateAudio?: boolean;
};

const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const execFileAsync = promisify(execFile);

function getBytePlusVideoModelName(modelId?: string, providerKey?: string) {
  if (modelId === "byteplus:video.seedance-2-0-fast") return getBytePlusModelForRequest(providerKey ?? "video.seedance-2-0-fast");
  if (modelId === "byteplus:video.seedance-2-0") return getBytePlusModelForRequest(providerKey ?? "video.seedance-2-0");
  return undefined;
}

function getCurlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toCurlHeaderArgs(headers: Record<string, string>) {
  return Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
}

async function curlGetJson(url: string, headers: Record<string, string>) {
  const { stdout } = await execFileAsync(getCurlCommand(), ["-sS", "-L", ...toCurlHeaderArgs(headers), url], { maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout) as OpenRouterVideoTask;
}

function getOpenRouterApiKey() {
  return getConfiguredOpenRouterApiKey();
}

export function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "FlashMuse",
  };
}

function getBytePlusHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function getRequiredOpenRouterApiKey() {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error("缺少 API Key");
  return apiKey;
}

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

function toDataUrlIfLocalPublicAsset(url: string) {
  if (!url.startsWith("/generated/")) return url;

  const filePath = join(process.cwd(), "public", url.replace(/^\//, ""));
  if (!existsSync(filePath)) return url;

  const data = readFileSync(filePath);
  return `data:${getMimeType(filePath)};base64,${data.toString("base64")}`;
}

function getClosestDuration(seconds: number, supported: number[]) {
  return supported.reduce((best, item) => (Math.abs(item - seconds) < Math.abs(best - seconds) ? item : best), supported[0]);
}

function getDuration(model: string, value?: string) {
  const seconds = Number(value?.match(/\d+/)?.[0]);
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 5;

  if (model.startsWith("byteplus:video.")) return Math.min(15, Math.max(4, safeSeconds));
  if (model === "google/veo-3.1") return getClosestDuration(safeSeconds, [4, 6, 8]);
  if (model === "kwaivgi/kling-video-o1") return getClosestDuration(safeSeconds, [5, 10]);

  return safeSeconds;
}

function toOpenRouterImage(url: string): OpenRouterVideoImage {
  return {
    type: "image_url",
    image_url: { url: toDataUrlIfLocalPublicAsset(url) },
  };
}

function getBytePlusReferenceRole(index: number, mode?: VideoReferenceMode) {
  if (mode === "first_last_frame") {
    if (index === 0) return "first_frame";
    if (index === 1) return "last_frame";
  }
  if (mode === "first_frame" && index === 0) return "first_frame";
  return "reference_image";
}

export function getBytePlusEffectiveReferenceImages(referenceImages: string[] = [], mode?: VideoReferenceMode) {
  const images = referenceImages.filter(Boolean);
  if (mode === "first_last_frame") return images.slice(0, 2);
  if (mode === "first_frame") return images.slice(0, 1);
  return images.slice(0, 9);
}

async function getOpenRouterError(response: Response, fallback: string) {
  const text = await response.text();

  try {
    const data = JSON.parse(text) as { error?: { message?: string; code?: number | string } };
    const message = data.error?.message ?? text;
    return `${fallback}：${message}`;
  } catch {
    return `${fallback}：${text}`;
  }
}

async function postOpenRouterVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings, model = DEFAULT_VIDEO_MODEL, options: CreateVideoOptions = {}) {
  const apiKey = getRequiredOpenRouterApiKey();

  const images = referenceImages.filter(Boolean).map(toOpenRouterImage);
  const videoSettings = resolveVideoSettingsForModel(model, settings);
  const response = await fetch(OPENROUTER_VIDEOS_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      duration: getDuration(model, settings?.duration),
      resolution: videoSettings.resolution,
      aspect_ratio: videoSettings.ratio,
      generate_audio: options.generateAudio ?? true,
      ...(images.length > 0 ? { input_references: images } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "视频任务创建失败"));
  }

  return (await response.json()) as OpenRouterVideoTask;
}

export async function createOpenRouterVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings, model = DEFAULT_VIDEO_MODEL, options?: { bytePlusProviderKey?: string; referenceMode?: VideoReferenceMode }) {
  if (getBytePlusVideoModelName(model, options?.bytePlusProviderKey)) return createBytePlusVideoTask(prompt, referenceImages, settings, model, options?.bytePlusProviderKey, options?.referenceMode);

  try {
    return await postOpenRouterVideoTask(prompt, referenceImages, settings, model, { generateAudio: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/audio|generate_audio|sound|voice/i.test(message)) {
      return postOpenRouterVideoTask(prompt, referenceImages, settings, model, { generateAudio: false });
    }

    throw error;
  }
}

async function createBytePlusVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings, model = DEFAULT_VIDEO_MODEL, bytePlusProviderKey?: string, referenceMode?: VideoReferenceMode) {
  const apiKey = getConfiguredBytePlusApiKey();
  if (!apiKey) throw new Error("缺少 BytePlus API Key");

  const bytePlusModel = getBytePlusVideoModelName(model, bytePlusProviderKey);
  if (!bytePlusModel) throw new Error("连接不到模型，请联系管理员！");

  const videoSettings = resolveVideoSettingsForModel(model, settings);
  const images = getBytePlusEffectiveReferenceImages(referenceImages, referenceMode).map((url, index) => ({
    type: "image_url",
    image_url: { url: toDataUrlIfLocalPublicAsset(url) },
    role: getBytePlusReferenceRole(index, referenceMode),
  }));
  const body = {
    model: bytePlusModel,
    content: [
      { type: "text", text: prompt },
      ...images,
    ],
    resolution: videoSettings.resolution,
    ratio: videoSettings.ratio,
    duration: getDuration(model, settings?.duration),
    generate_audio: true,
    watermark: false,
  };

  const url = `${getBytePlusBaseUrl()}/contents/generations/tasks`;
  const response = await fetch(url, {
    method: "POST",
    headers: getBytePlusHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await getOpenRouterError(response, "BytePlus 视频任务创建失败"));

  return (await response.json()) as OpenRouterVideoTask;
}

export async function getOpenRouterVideoTask(taskId: string) {
  if (/^cgt-/i.test(taskId)) return getBytePlusVideoTask(taskId);

  const apiKey = getRequiredOpenRouterApiKey();

  const url = /^https?:\/\//.test(taskId)
    ? taskId
    : taskId.startsWith("/api/")
      ? `https://openrouter.ai${taskId}`
      : `${OPENROUTER_VIDEOS_URL}/${encodeURIComponent(taskId)}`;

  const headers = getOpenRouterHeaders(apiKey);
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (response.status === 404) {
    try {
      return await curlGetJson(url, headers);
    } catch {
      // OpenRouter can briefly return 404 before the job is visible; keep polling.
    }

    return {
      id: taskId,
      polling_url: url,
      status: "pending",
    } satisfies OpenRouterVideoTask;
  }

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "视频任务查询失败"));
  }

  return (await response.json()) as OpenRouterVideoTask;
}

async function getBytePlusVideoTask(taskId: string) {
  const apiKey = getConfiguredBytePlusApiKey();
  if (!apiKey) throw new Error("缺少 BytePlus API Key");

  const url = `${getBytePlusBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`;
  const headers = getBytePlusHeaders(apiKey);
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) throw new Error(await getOpenRouterError(response, "BytePlus 视频任务查询失败"));

  return (await response.json()) as OpenRouterVideoTask;
}
