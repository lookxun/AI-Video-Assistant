const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const envText = fs.readFileSync(".env.local", "utf8");
const databaseUrlLine = envText.split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
if (databaseUrlLine) {
  process.env.DATABASE_URL = databaseUrlLine.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "12424740@qq.com";
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      workspace: { select: { state: true } },
    },
  });
  if (!user) {
    console.log(JSON.stringify({ error: "user not found", email }));
    return;
  }

  const state = user.workspace?.state && typeof user.workspace.state === "object" ? user.workspace.state : {};
  const sessions = await prisma.workspaceSession.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
    select: { sessionId: true, title: true, updatedAt: true },
    take: 30,
  });
  const page = await prisma.workspaceSession.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
    skip: 10,
    take: 7,
    select: { sessionId: true, title: true, updatedAt: true },
  });

  console.log(JSON.stringify({
    userId: user.id,
    email: user.email,
    activeSessionId: typeof state.activeSessionId === "string" ? state.activeSessionId : "",
    workspaceStateBytes: Buffer.byteLength(JSON.stringify(state)),
    assets: Array.isArray(state.assets) ? state.assets.length : null,
    stateKeys: Object.keys(state).sort(),
    first30: sessions.map((session, index) => ({ index, ...session })),
    pageOffset10: page.map((session, index) => ({ index: index + 10, ...session })),
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
