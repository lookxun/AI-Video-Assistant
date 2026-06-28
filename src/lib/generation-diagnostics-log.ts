import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

type GenerationDiagnosticReference = {
  index: number;
  kind: "asset" | "data" | "generated" | "remote" | "unknown";
  host?: string;
  pathTail?: string;
  length?: number;
  role?: string;
};

type GenerationDiagnosticEntry = {
  event: string;
  requestId?: string;
  conversationId?: string;
  conversationTitle?: string;
  userId?: string;
  mode?: string;
  provider?: string;
  model?: string;
  responseModel?: string;
  taskId?: string;
  status?: number | string;
  settings?: unknown;
  prompt?: string;
  promptLength?: number;
  references?: GenerationDiagnosticReference[];
  durationMs?: number;
  error?: unknown;
  upstream?: unknown;
  extra?: Record<string, unknown>;
};

const LOG_PATH = join(process.cwd(), ".runtime", "generation-diagnostics-log.jsonl");

function cleanText(value: unknown, maxLength = 1200) {
  if (value === undefined || value === null) return undefined;
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value);
  return text
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/sk-or-v1-[a-z0-9]+/gi, "sk-or-v1-[REDACTED]")
    .replace(/(api[_-]?key["'=:\s]+)[^\s"'}]+/gi, "$1[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function promptDigest(prompt: string | undefined) {
  if (!prompt) return undefined;
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
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

function safeValue(value: unknown, maxLength = 1200): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") return cleanText(value, maxLength);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, maxLength));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 60).map(([key, item]) => {
        if (/authorization|api[_-]?key|token|password|secret/i.test(key)) return [key, "[REDACTED]"];
        if (/url/i.test(key) && typeof item === "string") return [key, summarizeGeneratedReference(item, 0)];
        return [key, safeValue(item, maxLength)];
      }),
    );
  }
  return cleanText(value, maxLength);
}

export function summarizeGeneratedReference(url: string, index: number, role?: string): GenerationDiagnosticReference {
  if (!url) return { index, kind: "unknown", role };
  if (url.startsWith("asset://")) return { index, kind: "asset", pathTail: url.slice("asset://".length), role };
  if (url.startsWith("data:")) return { index, kind: "data", length: url.length, role };
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
  return { index, kind: "unknown", length: url.length, role };
}

export async function appendGenerationDiagnosticsLog(entry: GenerationDiagnosticEntry) {
  try {
    const prompt = entry.prompt;
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(
      LOG_PATH,
      `${JSON.stringify({
        time: new Date().toISOString(),
        event: entry.event,
        requestId: cleanText(entry.requestId, 160),
        conversationId: cleanText(entry.conversationId, 160),
        conversationTitle: cleanText(entry.conversationTitle, 240),
        userId: cleanText(entry.userId, 120),
        mode: entry.mode,
        provider: entry.provider,
        model: entry.model,
        responseModel: entry.responseModel,
        taskId: cleanText(entry.taskId, 180),
        status: entry.status,
        settings: safeValue(entry.settings),
        promptLength: entry.promptLength ?? prompt?.length,
        promptHash: promptDigest(prompt),
        promptPreview: cleanText(prompt, 500),
        references: entry.references,
        durationMs: entry.durationMs,
        error: getErrorDetails(entry.error),
        upstream: safeValue(entry.upstream, 1800),
        extra: safeValue(entry.extra, 1800),
      })}\n`,
      "utf8",
    );
  } catch {
    // Diagnostics must never block generation requests.
  }
}
