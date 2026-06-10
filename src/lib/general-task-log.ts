import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type GeneralTaskLogEntry = {
  userId?: string;
  conversationId?: string;
  conversationTitle?: string;
  requestId?: string;
  model?: string;
  taskText?: string;
  intent?: string;
  needsClarification?: boolean;
  hasImages?: boolean;
};

const GENERAL_TASK_LOG_PATH = join(process.cwd(), ".runtime", "general-task-log.jsonl");

function cleanLogText(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function appendGeneralTaskLog(entry: GeneralTaskLogEntry) {
  try {
    await mkdir(dirname(GENERAL_TASK_LOG_PATH), { recursive: true });
    await appendFile(
      GENERAL_TASK_LOG_PATH,
      `${JSON.stringify({
        time: new Date().toISOString(),
        userId: entry.userId,
        conversationId: entry.conversationId,
        conversationTitle: cleanLogText(entry.conversationTitle),
        requestId: entry.requestId,
        model: entry.model,
        taskText: cleanLogText(entry.taskText),
        intent: entry.intent,
        needsClarification: entry.needsClarification,
        hasImages: entry.hasImages,
      })}\n`,
      "utf8",
    );
  } catch {
    // Logging must never block user requests.
  }
}
