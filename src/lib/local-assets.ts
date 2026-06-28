import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";

type AssetType = "image" | "video";
type SaveAssetOptions = { userId?: string; diagnostics?: { requestId?: string; fileName?: string; fileSize?: number } };

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const ASSET_UPLOAD_TEMP_ROOT = join(process.cwd(), ".runtime", "asset-upload-temp");
const execFileAsync = promisify(execFile);

function isJpegMime(mimeType?: string | null) {
  return /^image\/jpe?g(?:;|$)/i.test(mimeType ?? "");
}

function jpegNeedsReencode(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return true;

  let offset = 2;
  while (offset + 3 < buffer.length) {
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= buffer.length) return true;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return true;

    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (length < 8) return true;
      const componentCount = buffer[offset + 7];
      if (componentCount !== 3) return true;
      const factors = [0, 1, 2].map((index) => buffer[offset + 8 + index * 3 + 1]);
      return !(factors[0] === 0x22 && factors[1] === 0x11 && factors[2] === 0x11);
    }

    offset += length;
  }

  return true;
}

export type ImageDimensions = {
  width: number;
  height: number;
};

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function getAssetFolder(type: AssetType) {
  return type === "image" ? "images" : "videos";
}

function getSafeUserSegment(userId?: string) {
  const safeUserId = userId?.trim().replace(/[^A-Za-z0-9_-]/g, "_");
  return safeUserId ? join("users", safeUserId) : "";
}

function getGeneratedFolder(folder: string, options: SaveAssetOptions = {}) {
  const userSegment = getSafeUserSegment(options.userId);
  return userSegment ? join(userSegment, folder) : folder;
}

function getExtensionFromMime(mimeType?: string | null) {
  if (!mimeType) return undefined;
  return mimeExtensions[mimeType.split(";")[0].trim().toLowerCase()];
}

function getExtensionFromUrl(url: string) {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);/i);
    return getExtensionFromMime(match?.[1]);
  }

  try {
    const pathname = new URL(url).pathname;
    const extension = extname(pathname).replace(/^\./, "").toLowerCase();
    return extension || undefined;
  } catch {
    return undefined;
  }
}

function parseDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:")) return undefined;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return undefined;

  const header = dataUrl.slice(5, commaIndex);
  if (!/;base64(?:;|$)/i.test(header)) return undefined;

  return {
    mimeType: header.split(";")[0],
    base64: dataUrl.slice(commaIndex + 1),
  };
}

function createPublicAssetPath(type: AssetType, extension: string, options: SaveAssetOptions = {}) {
  const folder = getGeneratedFolder(getAssetFolder(type), options);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const publicFolder = folder.replace(/\\/g, "/");

  return {
    directory: join(GENERATED_ROOT, folder),
    filePath: join(GENERATED_ROOT, folder, filename),
    publicUrl: `/generated/${publicFolder}/${filename}`,
  };
}

async function writeGeneratedImageAsJpeg(buffer: Buffer, filePath: string, diagnostics?: SaveAssetOptions["diagnostics"] & { userId?: string; mimeType?: string; forceReencode?: boolean; stage?: string }) {
  const startedAt = Date.now();
  if (!ffmpegPath) {
    await writeFile(filePath, buffer);
    void appendUploadDiagnosticsLog({ event: "upload-image-ffmpeg-missing-raw-write", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, durationMs: Date.now() - startedAt, extra: { stage: diagnostics?.stage, filePath } });
    return;
  }

  const tempInputPath = `${filePath}.${randomUUID()}.input`;
  await writeFile(tempInputPath, buffer);
  try {
    void appendUploadDiagnosticsLog({ event: "upload-image-reencode-start", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, extra: { stage: diagnostics?.stage } });
    await execFileAsync(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      tempInputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      filePath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    void appendUploadDiagnosticsLog({ event: "upload-image-reencode-success", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, durationMs: Date.now() - startedAt, extra: { stage: diagnostics?.stage, filePath } });
  } catch (error) {
    void appendUploadDiagnosticsLog({ event: "upload-image-reencode-failed", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, durationMs: Date.now() - startedAt, error, extra: { stage: diagnostics?.stage, filePath } });
    throw error;
  } finally {
    await unlink(tempInputPath).catch(() => undefined);
  }
}

function getCurlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toHeaderRecord(headers?: HeadersInit) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function toCurlHeaderArgs(headers?: HeadersInit) {
  return Object.entries(toHeaderRecord(headers)).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
}

export async function saveDataUrlAsset(dataUrl: string, type: AssetType, options: SaveAssetOptions = {}) {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const extension = type === "image" ? "jpg" : getExtensionFromMime(parsed.mimeType) ?? "mp4";
  const asset = createPublicAssetPath(type, extension, options);
  const buffer = Buffer.from(parsed.base64, "base64");

  await mkdir(asset.directory, { recursive: true });
  if (type === "image") {
    await writeGeneratedImageAsJpeg(buffer, asset.filePath, { ...options.diagnostics, userId: options.userId, mimeType: parsed.mimeType, fileSize: buffer.length, stage: "save-generated-asset" });
  } else {
    await writeFile(asset.filePath, buffer);
  }

  return asset.publicUrl;
}

export async function saveUploadedImageAsset(dataUrl: string, folder = "upload_image", options: SaveAssetOptions = {}) {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const buffer = Buffer.from(parsed.base64, "base64");
  return saveUploadedImageBufferAsset(buffer, parsed.mimeType, folder, options);
}

export async function saveUploadedImageBufferAsset(buffer: Buffer, mimeType = "image/jpeg", folder = "upload_image", options: SaveAssetOptions = {}) {
  const extension = "jpg";
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const generatedFolder = getGeneratedFolder(folder, options);
  const publicFolder = generatedFolder.replace(/\\/g, "/");
  const directory = join(GENERATED_ROOT, generatedFolder);
  const filePath = join(directory, `${hash}.${extension}`);

  await mkdir(directory, { recursive: true });

  if (!existsSync(filePath)) await writeGeneratedImageAsJpeg(buffer, filePath, { ...options.diagnostics, userId: options.userId, mimeType, fileSize: buffer.length, stage: `save-uploaded-image-${folder}` });

  return `/generated/${publicFolder}/${hash}.${extension}`;
}

export async function saveTemporaryUploadedImageBuffer(buffer: Buffer, mimeType = "image/jpeg", options: SaveAssetOptions & { forceReencode?: boolean } = {}) {
  const startedAt = Date.now();
  const userSegment = getSafeUserSegment(options.userId) || "anonymous";
  const token = `${Date.now()}-${randomUUID()}`;
  const directory = join(ASSET_UPLOAD_TEMP_ROOT, userSegment);
  const filePath = join(directory, `${token}.jpg`);
  await mkdir(directory, { recursive: true });
  if (options.forceReencode || !isJpegMime(mimeType)) {
    await writeGeneratedImageAsJpeg(buffer, filePath, { ...options.diagnostics, userId: options.userId, mimeType, fileSize: buffer.length, forceReencode: options.forceReencode, stage: "temporary-upload" });
  } else {
    if (jpegNeedsReencode(buffer)) {
      void appendUploadDiagnosticsLog({ event: "temporary-upload-jpeg-needs-reencode", requestId: options.diagnostics?.requestId, userId: options.userId, fileName: options.diagnostics?.fileName, mimeType, fileSize: options.diagnostics?.fileSize ?? buffer.length, forceReencode: options.forceReencode, durationMs: Date.now() - startedAt, extra: { token } });
      throw new Error("图片编码需要转码，请点击重试。");
    }
    await writeFile(filePath, buffer);
  }
  void appendUploadDiagnosticsLog({ event: "temporary-upload-buffer-saved", requestId: options.diagnostics?.requestId, userId: options.userId, fileName: options.diagnostics?.fileName, mimeType, fileSize: options.diagnostics?.fileSize ?? buffer.length, forceReencode: options.forceReencode, token, durationMs: Date.now() - startedAt, extra: { directory } });
  return { token };
}

export async function commitTemporaryUploadedImage(token: string, options: SaveAssetOptions = {}) {
  const startedAt = Date.now();
  const userSegment = getSafeUserSegment(options.userId) || "anonymous";
  const safeToken = token.trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeToken) throw new Error("上传文件不存在");

  const tempPath = join(ASSET_UPLOAD_TEMP_ROOT, userSegment, `${safeToken}.jpg`);
  if (!existsSync(tempPath)) throw new Error("上传文件不存在或已过期");

  const buffer = readFileSync(tempPath);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const generatedFolder = getGeneratedFolder("upload_image", options);
  const publicFolder = generatedFolder.replace(/\\/g, "/");
  const directory = join(GENERATED_ROOT, generatedFolder);
  const filePath = join(directory, `${hash}.jpg`);
  await mkdir(directory, { recursive: true });
  if (!existsSync(filePath)) await rename(tempPath, filePath);
  else await unlink(tempPath).catch(() => undefined);
  void appendUploadDiagnosticsLog({ event: "temporary-upload-committed", requestId: options.diagnostics?.requestId, userId: options.userId, token: safeToken, durationMs: Date.now() - startedAt, extra: { url: `/generated/${publicFolder}/${hash}.jpg`, deduped: existsSync(filePath) } });
  return `/generated/${publicFolder}/${hash}.jpg`;
}

export async function deleteTemporaryUploadedImage(token: string, options: SaveAssetOptions = {}) {
  const userSegment = getSafeUserSegment(options.userId) || "anonymous";
  const safeToken = token.trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeToken) return false;
  const tempPath = join(ASSET_UPLOAD_TEMP_ROOT, userSegment, `${safeToken}.jpg`);
  await unlink(tempPath).catch(() => undefined);
  return true;
}

export async function saveUserAvatarAsset(dataUrl: string) {
  return saveUploadedImageAsset(dataUrl, "user_avatar");
}

function getSafeFileBaseName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "file";
}

export async function saveUploadedFileAsset(dataUrl: string, originalName = "file", options: SaveAssetOptions = {}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("文件数据格式不正确，无法保存到本地。请稍后再试。");

  const buffer = Buffer.from(parsed.base64, "base64");
  const extension = getExtensionFromUrl(originalName) ?? getExtensionFromMime(parsed.mimeType) ?? "bin";
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const baseName = getSafeFileBaseName(originalName.replace(/\.[^.]+$/, ""));
  const generatedFolder = getGeneratedFolder("files", options);
  const publicFolder = generatedFolder.replace(/\\/g, "/");
  const directory = join(GENERATED_ROOT, generatedFolder);
  const filename = `${hash}-${baseName}.${extension}`;
  const filePath = join(directory, filename);

  await mkdir(directory, { recursive: true });
  if (!existsSync(filePath)) await writeFile(filePath, buffer);
  return `/generated/${publicFolder}/${filename}`;
}

export async function saveRemoteAsset(url: string, type: AssetType, init?: RequestInit, options: SaveAssetOptions = {}) {
  const response = await fetch(url, { ...init, cache: "no-store" });

  if (!response.ok) {
    const extension = type === "image" ? "jpg" : getExtensionFromUrl(url) ?? "mp4";
    const asset = createPublicAssetPath(type, extension, options);

    await mkdir(asset.directory, { recursive: true });

    try {
      const { stdout } = await execFileAsync(getCurlCommand(), ["-fL", "-sS", ...toCurlHeaderArgs(init?.headers), url], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024 });
      const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
      if (type === "image") {
        await writeGeneratedImageAsJpeg(buffer, asset.filePath);
      } else {
        await writeFile(asset.filePath, buffer);
      }
      return asset.publicUrl;
    } catch {
      throw new Error(`保存${type === "image" ? "图片" : "视频"}失败：${response.status}`);
    }
  }

  const contentType = response.headers.get("content-type");
  const extension = type === "image" ? "jpg" : getExtensionFromMime(contentType) ?? getExtensionFromUrl(url) ?? "mp4";
  const asset = createPublicAssetPath(type, extension, options);
  const buffer = Buffer.from(await response.arrayBuffer());

  await mkdir(asset.directory, { recursive: true });
  if (type === "image") {
    await writeGeneratedImageAsJpeg(buffer, asset.filePath);
  } else {
    await writeFile(asset.filePath, buffer);
  }

  return asset.publicUrl;
}

export async function saveGeneratedAsset(source: string, type: AssetType, init?: RequestInit, options: SaveAssetOptions = {}) {
  if (source.startsWith("/generated/")) return source;
  if (source.startsWith("data:")) return saveDataUrlAsset(source, type, options);
  return saveRemoteAsset(source, type, init, options);
}

function getPngDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }

    offset += 2 + length;
  }

  return undefined;
}

function getWebpDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return undefined;

  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (format === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (format === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return undefined;
}

export function getImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions | undefined {
  return getPngDimensions(buffer) ?? getJpegDimensions(buffer) ?? getWebpDimensions(buffer);
}

export function getLocalImageDimensions(publicUrl: string): ImageDimensions | undefined {
  if (!publicUrl.startsWith("/generated/")) return undefined;

  const filePath = join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  if (!existsSync(filePath)) return undefined;

  return getImageDimensionsFromBuffer(readFileSync(filePath));
}

export async function createGeneratedImageThumbnail(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return undefined;
  if (!ffmpegPath) return undefined;

  const cleanPublicUrl = publicUrl.split("?")[0].split("#")[0];
  const sourcePath = join(process.cwd(), "public", cleanPublicUrl.replace(/^\//, ""));
  if (!existsSync(sourcePath)) return undefined;

  const userPathMatch = cleanPublicUrl.match(/^\/generated\/users\/([^/]+)\/(.+)$/);
  const generatedRelativePath = (userPathMatch ? userPathMatch[2] : cleanPublicUrl.replace(/^\/generated\//, "")).replace(/\.[^.\/\\]+$/, ".jpg");
  const thumbnailPublicUrl = userPathMatch ? `/generated/users/${userPathMatch[1]}/image-thumbnails/${generatedRelativePath.replace(/\\/g, "/")}` : `/generated/image-thumbnails/${generatedRelativePath.replace(/\\/g, "/")}`;
  const thumbnailPath = join(process.cwd(), "public", thumbnailPublicUrl.replace(/^\//, ""));

  if (existsSync(thumbnailPath)) return thumbnailPublicUrl;
  await mkdir(dirname(thumbnailPath), { recursive: true });
  await execFileAsync(ffmpegPath, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-vf",
    "scale=256:256:force_original_aspect_ratio=decrease",
    "-frames:v",
    "1",
    "-q:v",
    "5",
    thumbnailPath,
  ], { timeout: 60_000, maxBuffer: 1024 * 1024 });

  return thumbnailPublicUrl;
}

export async function deleteLocalGeneratedAsset(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return false;

  const normalized = publicUrl.replace(/^\/generated\//, "").replace(/\//g, "\\");
  const filePath = join(GENERATED_ROOT, normalized);

  if (!existsSync(filePath)) return false;

  await unlink(filePath);
  return true;
}
