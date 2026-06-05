import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { toUserErrorMessage } from "@/lib/error-message";

const ERROR_COUNTER_PATH = join(process.cwd(), ".runtime", "error-code-counter.txt");
let errorCodeQueue: Promise<unknown> = Promise.resolve();

function sanitizeErrorForLog(value: unknown) {
  const raw = value instanceof Error ? `${value.stack ?? value.message}` : typeof value === "string" ? value : JSON.stringify(value);
  return raw
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/sk-or-v1-[a-z0-9]+/gi, "sk-or-v1-[REDACTED]");
}

async function allocateNextErrorCode() {
  await mkdir(dirname(ERROR_COUNTER_PATH), { recursive: true });
  const currentText = await readFile(ERROR_COUNTER_PATH, "utf8").catch(() => "0");
  const next = Math.max(0, Number.parseInt(currentText.trim(), 10) || 0) + 1;
  await writeFile(ERROR_COUNTER_PATH, String(next));
  return `B_${next}`;
}

function nextErrorCode() {
  const task = errorCodeQueue.then(() => allocateNextErrorCode());
  errorCodeQueue = task.catch(() => undefined);
  return task;
}

export async function createCodedApiError(error: unknown, fallback: string, scope: string) {
  const message = toUserErrorMessage(error, fallback);
  const errorCode = await nextErrorCode();
  console.error(`[${errorCode}] ${scope}`, sanitizeErrorForLog(error));
  return { error: `(${errorCode}) ${message}`, errorCode };
}
