import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const batchSizeArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
const batchSize = Math.max(1, Math.min(100, Number(batchSizeArg?.split("=")[1] ?? 20) || 20));

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDate(value) {
  const timestamp = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date();
}

function messageId(message) {
  return typeof message.id === "string" && message.id ? message.id : "";
}

async function migrateSession(session) {
  const messages = Array.isArray(session.messagesJson) ? session.messagesJson.filter((message) => isRecord(message) && messageId(message)) : [];
  if (messages.length === 0) return { migrated: false, messageCount: 0 };
  if (dryRun) return { migrated: true, messageCount: messages.length };

  for (let index = 0; index < messages.length; index += 50) {
    const chunk = messages.slice(index, index + 50);
    await prisma.$transaction(
      chunk.map((message) => {
        const id = messageId(message);
        const data = {
          role: typeof message.role === "string" ? message.role : "unknown",
          content: typeof message.content === "string" ? message.content : "",
          createdAt: toDate(message.createdAt),
          messageJson: message,
        };

        return prisma.workspaceMessage.upsert({
          where: { userId_sessionId_messageId: { userId: session.userId, sessionId: session.sessionId, messageId: id } },
          create: { userId: session.userId, sessionId: session.sessionId, messageId: id, ...data },
          update: data,
        });
      }),
    );
  }

  await prisma.workspaceSession.update({
    where: { userId_sessionId: { userId: session.userId, sessionId: session.sessionId } },
    data: { messagesJson: [] },
  });

  return { migrated: true, messageCount: messages.length };
}

async function main() {
  let cursor;
  let scanned = 0;
  let migratedSessions = 0;
  let migratedMessages = 0;

  console.log(`Migrating workspace messages${dryRun ? " (dry run)" : ""}...`);

  while (true) {
    const sessions = await prisma.workspaceSession.findMany({
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, userId: true, sessionId: true, messagesJson: true },
    });

    if (sessions.length === 0) break;
    cursor = sessions[sessions.length - 1].id;

    for (const session of sessions) {
      scanned += 1;
      const result = await migrateSession(session);
      if (result.migrated) {
        migratedSessions += 1;
        migratedMessages += result.messageCount;
        console.log(`${dryRun ? "Would migrate" : "Migrated"} session ${session.sessionId}: ${result.messageCount} messages`);
      }
    }
  }

  console.log(`Done. Scanned sessions: ${scanned}. ${dryRun ? "Would migrate" : "Migrated"} sessions: ${migratedSessions}. Messages: ${migratedMessages}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
