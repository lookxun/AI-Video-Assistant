import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type UploadRuleFeedbackEntry = {
  source: "chat" | "agent-plan" | "image" | "video";
  mode?: string;
  model?: string;
  requestId?: string;
  conversationId?: string;
  conversationTitle?: string;
  error?: unknown;
  imageCount?: number;
  documentCount?: number;
  videoCount?: number;
  audioCount?: number;
  referenceImageCount?: number;
  hasDocumentText?: boolean;
  settings?: unknown;
};

const LOG_PATH = join(process.cwd(), ".runtime", "upload-rule-feedback-log.jsonl");

function cleanText(value: unknown, maxLength = 1000) {
  if (value === undefined || value === null) return undefined;
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: cleanText(error.message),
      stackHead: cleanText(error.stack, 1200),
    };
  }

  return { message: cleanText(error) };
}

export function summarizeMessageUploads(messages: Array<{ content?: string; images?: string[] }> | undefined) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const imageCount = safeMessages.reduce((total, message) => total + (Array.isArray(message.images) ? message.images.length : 0), 0);
  const documentCount = safeMessages.reduce((total, message) => total + (/已读取文档内容如下|文档内容|上传文件内容/.test(message.content ?? "") ? 1 : 0), 0);

  return {
    imageCount,
    documentCount,
    hasDocumentText: documentCount > 0,
  };
}

export async function appendUploadRuleFeedbackLog(entry: UploadRuleFeedbackEntry) {
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(
      LOG_PATH,
      `${JSON.stringify({
        time: new Date().toISOString(),
        source: entry.source,
        mode: entry.mode,
        model: entry.model,
        requestId: entry.requestId,
        conversationId: entry.conversationId,
        conversationTitle: cleanText(entry.conversationTitle, 200),
        uploadSummary: {
          imageCount: entry.imageCount ?? 0,
          documentCount: entry.documentCount ?? 0,
          videoCount: entry.videoCount ?? 0,
          audioCount: entry.audioCount ?? 0,
          referenceImageCount: entry.referenceImageCount ?? 0,
          hasDocumentText: Boolean(entry.hasDocumentText),
        },
        settings: entry.settings,
        error: getErrorDetails(entry.error),
      })}\n`,
      "utf8",
    );
  } catch {
    // Calibration logging must never block user requests.
  }
}
