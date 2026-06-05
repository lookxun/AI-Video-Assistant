import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type VideoManifestEntry = {
  taskId: string;
  prompt: string;
  model?: string;
  settings?: { ratio?: string; resolution?: string; duration?: string };
  localVideoUrl?: string;
  remoteVideoUrl?: string;
  posterUrl?: string;
  createdAt: number;
  updatedAt: number;
};

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const VIDEO_DIR = join(GENERATED_ROOT, "videos");
const MANIFEST_PATH = join(VIDEO_DIR, "manifest.json");

async function readManifest(): Promise<VideoManifestEntry[]> {
  try {
    const content = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(content) as VideoManifestEntry[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.taskId === "string") : [];
  } catch {
    return [];
  }
}

async function writeManifest(entries: VideoManifestEntry[]) {
  await mkdir(VIDEO_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(entries.slice(-500), null, 2));
}

export async function upsertVideoManifestEntry(entry: Omit<VideoManifestEntry, "createdAt" | "updatedAt"> & Partial<Pick<VideoManifestEntry, "createdAt" | "updatedAt">>) {
  const entries = await readManifest();
  const now = Date.now();
  const existingIndex = entries.findIndex((item) => item.taskId === entry.taskId);
  const previous = existingIndex >= 0 ? entries[existingIndex] : undefined;
  const nextEntry: VideoManifestEntry = {
    ...(previous ?? { createdAt: entry.createdAt ?? now }),
    ...entry,
    prompt: entry.prompt || previous?.prompt || "",
    updatedAt: entry.updatedAt ?? now,
  };

  if (existingIndex >= 0) entries[existingIndex] = nextEntry;
  else entries.push(nextEntry);

  await writeManifest(entries);
  return nextEntry;
}

export async function listRecoverableVideos() {
  const manifest = await readManifest();
  const manifestUrls = new Set(manifest.map((entry) => entry.localVideoUrl).filter(Boolean));
  const files = existsSync(VIDEO_DIR) ? await readdir(VIDEO_DIR) : [];
  const orphanVideos = await Promise.all(
    files
      .filter((file) => /\.(mp4|webm|mov)$/i.test(file))
      .map(async (file) => {
        const filePath = join(VIDEO_DIR, file);
        const stats = await stat(filePath);
        return {
          url: `/generated/videos/${file}`,
          name: file,
          createdAt: stats.birthtimeMs || stats.mtimeMs,
          updatedAt: stats.mtimeMs,
        };
      }),
  );

  return {
    manifest,
    orphanVideos: orphanVideos.filter((video) => !manifestUrls.has(video.url)).sort((a, b) => b.updatedAt - a.updatedAt),
  };
}
