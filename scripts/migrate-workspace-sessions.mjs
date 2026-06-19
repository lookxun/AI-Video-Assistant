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

function sessionSummary(session) {
  const { messages: _messages, usageSummary: _usageSummary, memorySummary: _memorySummary, messagesLoaded: _messagesLoaded, ...summary } = session;
  return summary;
}

function stateWithoutSessions(state) {
  const { sessions: _sessions, ...rest } = state;
  return rest;
}

async function migrateWorkspace(workspace) {
  const state = workspace.state;
  if (!isRecord(state) || !Array.isArray(state.sessions) || state.sessions.length === 0) {
    return { migrated: false, sessionCount: 0 };
  }

  const sessions = state.sessions.filter((session) => isRecord(session) && typeof session.id === "string" && session.id);
  if (dryRun) return { migrated: true, sessionCount: sessions.length };

  for (let index = 0; index < sessions.length; index += 25) {
    const chunk = sessions.slice(index, index + 25);
    await prisma.$transaction(
      chunk.map((session) => {
        const sessionId = session.id;
        const data = {
          title: typeof session.title === "string" && session.title.trim() ? session.title.trim() : "新对话",
          updatedAt: toDate(session.updatedAt),
          messagesJson: Array.isArray(session.messages) ? session.messages : [],
          summaryJson: sessionSummary(session),
          usageSummary: isRecord(session.usageSummary) ? session.usageSummary : undefined,
          memorySummary: isRecord(session.memorySummary) ? session.memorySummary : undefined,
        };

        return prisma.workspaceSession.upsert({
          where: { userId_sessionId: { userId: workspace.userId, sessionId } },
          create: { userId: workspace.userId, sessionId, ...data },
          update: data,
        });
      }),
    );
  }

  await prisma.userWorkspaceState.update({
    where: { userId: workspace.userId },
    data: { state: stateWithoutSessions(state) },
  });

  return { migrated: true, sessionCount: sessions.length };
}

async function main() {
  let cursor;
  let scanned = 0;
  let migratedUsers = 0;
  let migratedSessions = 0;

  console.log(`Migrating workspace sessions${dryRun ? " (dry run)" : ""}...`);

  while (true) {
    const workspaces = await prisma.userWorkspaceState.findMany({
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, userId: true, state: true },
    });

    if (workspaces.length === 0) break;
    cursor = workspaces[workspaces.length - 1].id;

    for (const workspace of workspaces) {
      scanned += 1;
      const result = await migrateWorkspace(workspace);
      if (result.migrated) {
        migratedUsers += 1;
        migratedSessions += result.sessionCount;
        console.log(`${dryRun ? "Would migrate" : "Migrated"} user ${workspace.userId}: ${result.sessionCount} sessions`);
      }
    }
  }

  console.log(`Done. Scanned users: ${scanned}. ${dryRun ? "Would migrate" : "Migrated"} users: ${migratedUsers}. Sessions: ${migratedSessions}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
