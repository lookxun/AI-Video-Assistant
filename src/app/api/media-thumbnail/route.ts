import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const PUBLIC_ROOT = join(process.cwd(), "public");
const GENERATED_ROOT = join(PUBLIC_ROOT, "generated");
const THUMBNAIL_ROOT = join(GENERATED_ROOT, "image-thumbnails");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif"]);

function isInsideGenerated(filePath: string) {
  const generatedRoot = resolve(GENERATED_ROOT);
  const resolvedPath = resolve(filePath);
  return resolvedPath === generatedRoot || resolvedPath.startsWith(`${generatedRoot}\\`) || resolvedPath.startsWith(`${generatedRoot}/`);
}

function toFallbackRedirect(request: Request, publicUrl: string) {
  return NextResponse.redirect(new URL(publicUrl, request.url), 307);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const publicUrl = requestUrl.searchParams.get("url")?.trim() ?? "";

  if (!publicUrl.startsWith("/generated/")) {
    return NextResponse.json({ error: "缩略图地址不正确" }, { status: 400 });
  }

  const cleanPublicUrl = publicUrl.split("?")[0].split("#")[0];
  const sourcePath = join(PUBLIC_ROOT, cleanPublicUrl.replace(/^\//, ""));

  if (!isInsideGenerated(sourcePath) || !existsSync(sourcePath)) {
    return toFallbackRedirect(request, cleanPublicUrl);
  }

  const extension = extname(sourcePath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension) || !ffmpegPath) {
    return toFallbackRedirect(request, cleanPublicUrl);
  }

  const generatedRelativePath = cleanPublicUrl.replace(/^\/generated\//, "").replace(/\.[^.\/\\]+$/, ".jpg");
  const thumbnailPath = join(THUMBNAIL_ROOT, generatedRelativePath);
  const thumbnailPublicUrl = `/generated/image-thumbnails/${generatedRelativePath.replace(/\\/g, "/")}`;

  try {
    if (!existsSync(thumbnailPath)) {
      await mkdir(dirname(thumbnailPath), { recursive: true });
      await execFileAsync(ffmpegPath, [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        sourcePath,
        "-vf",
        "scale=512:512:force_original_aspect_ratio=decrease",
        "-frames:v",
        "1",
        "-q:v",
        "5",
        thumbnailPath,
      ], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    }

    const body = await readFile(thumbnailPath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Thumbnail-Url": thumbnailPublicUrl,
      },
    });
  } catch (error) {
    console.warn("[media-thumbnail] failed to create thumbnail", { publicUrl: cleanPublicUrl, error });
    return toFallbackRedirect(request, cleanPublicUrl);
  }
}
