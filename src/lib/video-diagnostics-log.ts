import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

type VideoDiagnosticReference = {
  index: number;
  kind: "asset" | "generated" | "remote" | "unknown";
  host?: string;
  pathTail?: string;
  role?: string;
  status?: string;
  assetId?: string;
  error?: unknown;
};

type VideoDiagnosticEntry = {
  event: string;
  requestId?: string;
  conversationId?: string;
  conversationTitle?: string;
  model?: string;
  provider?: string;
  taskId?: string;
  referenceMode?: string;
  referenceCount?: number;
  assetReferenceCount?: number;
  settings?: unknown;
  promptLength?: number;
  references?: VideoDiagnosticReference[];
  autoReview?: unknown;
  error?: unknown;
  extra?: Record<string, unknown>;
};

const LOG_PATH = join(process.cwd(), ".runtime", "video-diagnostics-log.jsonl");

function cleanText(value: unknown, maxLength = 1000) {
  if (value === undefined || value === null) return undefined;
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
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

export function summarizeVideoReference(url: string, index: number, role?: string): VideoDiagnosticReference {
  if (!url) return { index, kind: "unknown", role };
  if (url.startsWith("asset://")) return { index, kind: "asset", assetId: url.slice("asset://".length), role };
  if (url.startsWith("/generated/")) {
    const parts = url.split("?")[0].split("/").filter(Boolean);
    return { index, kind: "generated", pathTail: parts.slice(-4).join("/"), role };
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      return { index, kind: "remote", host: parsed.hostname, pathTail: parts.slice(-3).join("/"), role };
    } catch {
      return { index, kind: "remote", role };
    }
  }
  return { index, kind: "unknown", role };
}

export async function appendVideoDiagnosticsLog(entry: VideoDiagnosticEntry) {
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(
      LOG_PATH,
      `${JSON.stringify({
        time: new Date().toISOString(),
        event: entry.event,
        requestId: cleanText(entry.requestId, 120),
        conversationId: cleanText(entry.conversationId, 120),
        conversationTitle: cleanText(entry.conversationTitle, 200),
        model: entry.model,
        provider: entry.provider,
        taskId: cleanText(entry.taskId, 160),
        referenceMode: entry.referenceMode,
        referenceCount: entry.referenceCount ?? entry.references?.length ?? 0,
        assetReferenceCount: entry.assetReferenceCount,
        settings: entry.settings,
        promptLength: entry.promptLength,
        references: entry.references?.map((reference) => ({ ...reference, error: getErrorDetails(reference.error) })),
        autoReview: entry.autoReview,
        error: getErrorDetails(entry.error),
        extra: entry.extra,
      })}\n`,
      "utf8",
    );
  } catch {
    // Diagnostics must never block generation requests.
  }
}
