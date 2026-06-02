import { existsSync, readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

type AssetType = "image" | "video";

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const execFileAsync = promisify(execFile);

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
};

function getAssetFolder(type: AssetType) {
  return type === "image" ? "images" : "videos";
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

function createPublicAssetPath(type: AssetType, extension: string) {
  const folder = getAssetFolder(type);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;

  return {
    directory: join(GENERATED_ROOT, folder),
    filePath: join(GENERATED_ROOT, folder, filename),
    publicUrl: `/generated/${folder}/${filename}`,
  };
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

export async function saveDataUrlAsset(dataUrl: string, type: AssetType) {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const extension = getExtensionFromMime(parsed.mimeType) ?? (type === "image" ? "png" : "mp4");
  const asset = createPublicAssetPath(type, extension);

  await mkdir(asset.directory, { recursive: true });
  await writeFile(asset.filePath, Buffer.from(parsed.base64, "base64"));

  return asset.publicUrl;
}

export async function saveUploadedImageAsset(dataUrl: string, folder = "upload_image") {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const buffer = Buffer.from(parsed.base64, "base64");
  const extension = getExtensionFromMime(parsed.mimeType) ?? "png";
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const directory = join(GENERATED_ROOT, folder);
  const filePath = join(directory, `${hash}.${extension}`);

  await mkdir(directory, { recursive: true });

  if (!existsSync(filePath)) {
    await writeFile(filePath, buffer);
  }

  return `/generated/${folder}/${hash}.${extension}`;
}

export async function saveUserAvatarAsset(dataUrl: string) {
  return saveUploadedImageAsset(dataUrl, "user_avatar");
}

export async function saveRemoteAsset(url: string, type: AssetType, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });

  if (!response.ok) {
    const extension = getExtensionFromUrl(url) ?? (type === "image" ? "png" : "mp4");
    const asset = createPublicAssetPath(type, extension);

    await mkdir(asset.directory, { recursive: true });

    try {
      const { stdout } = await execFileAsync(getCurlCommand(), ["-fL", "-sS", ...toCurlHeaderArgs(init?.headers), url], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024 });
      await writeFile(asset.filePath, Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
      return asset.publicUrl;
    } catch {
      throw new Error(`保存${type === "image" ? "图片" : "视频"}失败：${response.status}`);
    }
  }

  const contentType = response.headers.get("content-type");
  const extension = getExtensionFromMime(contentType) ?? getExtensionFromUrl(url) ?? (type === "image" ? "png" : "mp4");
  const asset = createPublicAssetPath(type, extension);
  const buffer = Buffer.from(await response.arrayBuffer());

  await mkdir(asset.directory, { recursive: true });
  await writeFile(asset.filePath, buffer);

  return asset.publicUrl;
}

export async function saveGeneratedAsset(source: string, type: AssetType, init?: RequestInit) {
  if (source.startsWith("/generated/")) return source;
  if (source.startsWith("data:")) return saveDataUrlAsset(source, type);
  return saveRemoteAsset(source, type, init);
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

export async function deleteLocalGeneratedAsset(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return false;

  const normalized = publicUrl.replace(/^\/generated\//, "").replace(/\//g, "\\");
  const filePath = join(GENERATED_ROOT, normalized);

  if (!existsSync(filePath)) return false;

  await unlink(filePath);
  return true;
}
