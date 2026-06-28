import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

type UploadDiagnosticEntry = {
  event: string;
  requestId?: string;
  userId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  forceReencode?: boolean;
  token?: string;
  status?: number | string;
  durationMs?: number;
  error?: unknown;
  extra?: Record<string, unknown>;
};

const LOG_PATH = join(process.cwd(), ".runtime", "upload-diagnostics-log.jsonl");

function cleanText(value: unknown, maxLength = 1000) {
  if (value === undefined || value === null) return undefined;
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getErrorDetails(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: cleanText(error.message),
      stackHead: cleanText(error.stack, 1200),
    };
  }
  return { message: cleanText(error) };
}

function safeExtra(value: Record<string, unknown> | undefined) {
  if (!value) return undefined;
  return Object.fromEntries(
    Object.entries(value).slice(0, 50).map(([key, item]) => {
      if (/authorization|cookie|token|password|secret/i.test(key)) return [key, "[REDACTED]"];
      if (typeof item === "string") return [key, cleanText(item, 1200)];
      return [key, item];
    }),
  );
}

export async function appendUploadDiagnosticsLog(entry: UploadDiagnosticEntry) {
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(
      LOG_PATH,
      `${JSON.stringify({
        time: new Date().toISOString(),
        event: entry.event,
        requestId: cleanText(entry.requestId, 160),
        userId: cleanText(entry.userId, 120),
        fileName: cleanText(entry.fileName, 240),
        mimeType: cleanText(entry.mimeType, 120),
        fileSize: entry.fileSize,
        forceReencode: entry.forceReencode,
        token: cleanText(entry.token, 120),
        status: entry.status,
        durationMs: entry.durationMs,
        error: getErrorDetails(entry.error),
        extra: safeExtra(entry.extra),
      })}\n`,
      "utf8",
    );
  } catch {
    // Upload diagnostics must never block user uploads.
  }
}
