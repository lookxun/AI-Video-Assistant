import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getLocalImageDimensions, saveRemoteAsset, type ImageDimensions } from "@/lib/local-assets";
import { createVideoPosterFromLocalVideo } from "@/lib/video-poster";
import { getOpenRouterHeaders, getRequiredOpenRouterApiKey } from "@/lib/openrouter-video";
import { upsertVideoManifestEntry } from "@/lib/video-manifest";

type MediaSaveType = "image" | "video";
type MediaSaveStatus = "pending" | "downloading" | "saved" | "failed" | "expired";
type MediaSaveAuthProvider = "openrouter";

export type MediaSaveJob = {
  id: string;
  remoteUrl: string;
  type: MediaSaveType;
  status: MediaSaveStatus;
  localUrl?: string;
  posterUrl?: string;
  dimensions?: ImageDimensions;
  attempts: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  nextRetryAt?: number;
  expiresAt?: number;
  authProvider?: MediaSaveAuthProvider;
  videoTaskId?: string;
  requestId?: string;
  model?: string;
  prompt?: string;
};

const RUNTIME_DIR = join(process.cwd(), ".runtime");
const JOBS_PATH = join(RUNTIME_DIR, "media-save-jobs.json");
const inFlight = new Set<string>();
let fileQueue = Promise.resolve();
const STALE_DOWNLOADING_MS = 30 * 60 * 1000;

function isRemoteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function getJobId(remoteUrl: string) {
  return createHash("sha256").update(remoteUrl).digest("hex").slice(0, 24);
}

function parseTosDate(value: string | null) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return undefined;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
}

function getRemoteUrlExpiresAt(remoteUrl: string) {
  try {
    const url = new URL(remoteUrl);
    const expires = Number(url.searchParams.get("X-Tos-Expires") ?? url.searchParams.get("X-Amz-Expires"));
    const dateMs = parseTosDate(url.searchParams.get("X-Tos-Date") ?? url.searchParams.get("X-Amz-Date"));
    if (Number.isFinite(expires) && expires > 0 && dateMs) return dateMs + expires * 1000;

    const exp = Number(url.searchParams.get("exp") ?? url.searchParams.get("expires"));
    if (Number.isFinite(exp) && exp > 0) return exp > 10_000_000_000 ? exp : exp * 1000;
  } catch {
    return undefined;
  }

  return undefined;
}

function getRemoteUrlDebugInfo(remoteUrl: string) {
  try {
    const url = new URL(remoteUrl);
    const pathTail = url.pathname.split("/").filter(Boolean).slice(-2).join("/");
    return { host: url.host, pathTail };
  } catch {
    return { host: "unknown", pathTail: "unknown" };
  }
}

function getRetryDelayMs(attempts: number) {
  const delays = [10_000, 30_000, 60_000, 5 * 60_000, 10 * 60_000];
  return delays[Math.min(Math.max(0, attempts - 1), delays.length - 1)];
}

async function readJobsUnsafe(): Promise<MediaSaveJob[]> {
  try {
    const content = await readFile(JOBS_PATH, "utf8");
    const parsed = JSON.parse(content) as MediaSaveJob[];
    return Array.isArray(parsed) ? parsed.filter((job) => job && typeof job.remoteUrl === "string") : [];
  } catch {
    return [];
  }
}

async function writeJobsUnsafe(jobs: MediaSaveJob[]) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(JOBS_PATH, JSON.stringify(jobs.slice(-1000), null, 2));
}

async function updateJobs<T>(updater: (jobs: MediaSaveJob[]) => T | Promise<T>) {
  const run = fileQueue.then(async () => {
    const jobs = await readJobsUnsafe();
    const result = await updater(jobs);
    await writeJobsUnsafe(jobs);
    return result;
  });
  fileQueue = run.then(() => undefined, () => undefined);
  return run;
}

function getRequestInit(job: MediaSaveJob): RequestInit | undefined {
  if (job.authProvider === "openrouter") return { headers: getOpenRouterHeaders(getRequiredOpenRouterApiKey()) };
  return undefined;
}

async function markJob(id: string, patch: Partial<MediaSaveJob>) {
  return updateJobs((jobs) => {
    const index = jobs.findIndex((job) => job.id === id);
    if (index < 0) return undefined;
    jobs[index] = { ...jobs[index], ...patch, updatedAt: Date.now() };
    return jobs[index];
  });
}

function scheduleJob(job: MediaSaveJob) {
  const delay = Math.max(0, (job.nextRetryAt ?? Date.now()) - Date.now());
  setTimeout(() => {
    void processMediaSaveJob(job.id);
  }, delay);
}

async function processMediaSaveJob(id: string) {
  if (inFlight.has(id)) return;
  inFlight.add(id);

  try {
    const job = await updateJobs((jobs) => {
      const item = jobs.find((entry) => entry.id === id);
      if (!item) return undefined;
      const now = Date.now();
      if (item.status === "saved" || item.status === "expired") return undefined;
      if (item.expiresAt && now >= item.expiresAt) {
        item.status = "expired";
        item.error = "远程地址已过期";
        item.updatedAt = now;
        return undefined;
      }
      if (item.status === "downloading" && now - item.updatedAt < STALE_DOWNLOADING_MS) return undefined;
      if (item.nextRetryAt && now < item.nextRetryAt) return undefined;
      item.status = "downloading";
      item.attempts = (item.attempts ?? 0) + 1;
      item.updatedAt = now;
      return { ...item };
    });

    if (!job) return;

    try {
      const downloadStartedAt = Date.now();
      console.log("[media-save] downloading remote asset", {
        id: job.id,
        type: job.type,
        requestId: job.requestId,
        model: job.model,
        attempt: job.attempts,
        queuedMs: downloadStartedAt - job.createdAt,
        ...getRemoteUrlDebugInfo(job.remoteUrl),
      });
      const localUrl = await saveRemoteAsset(job.remoteUrl, job.type, getRequestInit(job));
      const dimensions = job.type === "image" ? getLocalImageDimensions(localUrl) : undefined;
      const posterUrl = job.type === "video" ? await createVideoPosterFromLocalVideo(localUrl).catch((error) => {
        console.warn("[media-save] video poster create failed", { id: job.id, requestId: job.requestId, model: job.model, localUrl, error: error instanceof Error ? error.message : String(error) });
        return undefined;
      }) : undefined;
      const savedJob = await markJob(job.id, { status: "saved", localUrl, posterUrl, dimensions, error: undefined, nextRetryAt: undefined });
      const savedAt = Date.now();

      if (savedJob?.type === "video" && savedJob.videoTaskId) {
        await upsertVideoManifestEntry({
          taskId: savedJob.videoTaskId,
          prompt: savedJob.prompt ?? "",
          localVideoUrl: localUrl,
          remoteVideoUrl: savedJob.remoteUrl,
          posterUrl: savedJob.posterUrl,
        });
      }

      console.log("[media-save] saved remote asset", {
        id: job.id,
        type: job.type,
        requestId: job.requestId,
        model: job.model,
        attempts: job.attempts,
        queuedMs: savedAt - job.createdAt,
        downloadMs: savedAt - downloadStartedAt,
        localUrl,
        posterUrl,
        dimensions,
        ...getRemoteUrlDebugInfo(job.remoteUrl),
      });
    } catch (error) {
      const now = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const expired = Boolean(job.expiresAt && now >= job.expiresAt);
      const nextRetryAt = expired ? undefined : now + getRetryDelayMs(job.attempts);
      const nextJob = await markJob(job.id, {
        status: expired ? "expired" : "failed",
        error: errorMessage.slice(0, 300),
        nextRetryAt,
      });

      console.warn("[media-save] remote asset save failed", { id: job.id, type: job.type, requestId: job.requestId, model: job.model, attempts: job.attempts, expired, error: errorMessage.slice(0, 160), ...getRemoteUrlDebugInfo(job.remoteUrl) });
      if (nextJob && !expired) scheduleJob(nextJob);
    }
  } finally {
    inFlight.delete(id);
  }
}

export async function enqueueRemoteAssetSave(input: {
  remoteUrl: string;
  type: MediaSaveType;
  authProvider?: MediaSaveAuthProvider;
  videoTaskId?: string;
  requestId?: string;
  model?: string;
  prompt?: string;
}) {
  if (!isRemoteUrl(input.remoteUrl)) return undefined;
  const id = getJobId(input.remoteUrl);
  const now = Date.now();
  const job = await updateJobs((jobs) => {
    const existing = jobs.find((item) => item.id === id || item.remoteUrl === input.remoteUrl);
    if (existing) {
      existing.type = input.type;
      existing.authProvider = input.authProvider ?? existing.authProvider;
      existing.videoTaskId = input.videoTaskId ?? existing.videoTaskId;
      existing.requestId = input.requestId ?? existing.requestId;
      existing.model = input.model ?? existing.model;
      existing.prompt = input.prompt ?? existing.prompt;
      existing.updatedAt = now;
      return { ...existing };
    }

    const next: MediaSaveJob = {
      id,
      remoteUrl: input.remoteUrl,
      type: input.type,
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: getRemoteUrlExpiresAt(input.remoteUrl),
      authProvider: input.authProvider,
      videoTaskId: input.videoTaskId,
      requestId: input.requestId,
      model: input.model,
      prompt: input.prompt,
    };
    jobs.push(next);
    console.log("[media-save] queued remote asset", {
      id,
      type: next.type,
      requestId: next.requestId,
      model: next.model,
      expiresAt: next.expiresAt,
      ...getRemoteUrlDebugInfo(next.remoteUrl),
    });
    return { ...next };
  });

  if ((job.status === "pending" || job.status === "failed") && (!job.nextRetryAt || Date.now() >= job.nextRetryAt)) scheduleJob(job);
  if (job.status === "saved" && job.type === "video" && job.videoTaskId && job.localUrl) {
    await upsertVideoManifestEntry({
      taskId: job.videoTaskId,
      prompt: job.prompt ?? "",
      localVideoUrl: job.localUrl,
      remoteVideoUrl: job.remoteUrl,
      posterUrl: job.posterUrl,
    });
  }
  return job;
}

export async function getMediaSaveStatuses(remoteUrls: string[]) {
  const uniqueUrls = Array.from(new Set(remoteUrls.filter(isRemoteUrl)));
  const jobs = await readJobsUnsafe();
  const byUrl = new Map(jobs.map((job) => [job.remoteUrl, job]));
  const statuses = [] as MediaSaveJob[];

  for (const remoteUrl of uniqueUrls) {
    let job = byUrl.get(remoteUrl);
    if (!job) {
      const type: MediaSaveType = /\.(mp4|mov|webm)(\?|$)/i.test(remoteUrl) ? "video" : "image";
      job = await enqueueRemoteAssetSave({ remoteUrl, type });
    } else if ((job.status === "pending" || job.status === "failed") && (!job.nextRetryAt || Date.now() >= job.nextRetryAt)) {
      scheduleJob(job);
    }
    if (job) statuses.push(job);
  }

  return statuses;
}
