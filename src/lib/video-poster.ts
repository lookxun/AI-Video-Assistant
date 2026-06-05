import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename, join, parse } from "node:path";
import { promisify } from "node:util";

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const execFileAsync = promisify(execFile);

function getLocalGeneratedFilePath(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return undefined;
  return join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

function createVideoPosterPath(videoUrl: string) {
  const parsed = parse(basename(videoUrl.split("?")[0] || `video-${Date.now()}.mp4`));
  const filename = `${parsed.name || `${Date.now()}-${randomUUID()}`}.jpg`;

  return {
    directory: join(GENERATED_ROOT, "video-posters"),
    filePath: join(GENERATED_ROOT, "video-posters", filename),
    publicUrl: `/generated/video-posters/${filename}`,
  };
}

export async function createVideoPosterFromLocalVideo(publicVideoUrl: string) {
  const { default: ffmpegPath } = await import("ffmpeg-static");
  if (!ffmpegPath) return undefined;

  const videoPath = getLocalGeneratedFilePath(publicVideoUrl);
  if (!videoPath || !existsSync(videoPath)) return undefined;

  const poster = createVideoPosterPath(publicVideoUrl);
  await mkdir(poster.directory, { recursive: true });

  if (!existsSync(poster.filePath)) {
    await execFileAsync(ffmpegPath, ["-y", "-ss", "0", "-i", videoPath, "-frames:v", "1", "-q:v", "2", poster.filePath], { maxBuffer: 20 * 1024 * 1024 });
  }

  return poster.publicUrl;
}
