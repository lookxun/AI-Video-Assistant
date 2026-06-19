const fs = require("fs");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function hashSessionToken(token) {
  const secret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";
  return crypto.createHash("sha256").update(`${secret}:session:${token}`).digest("hex");
}

async function timed(label, fn) {
  const started = Date.now();
  const result = await fn();
  const ms = Date.now() - started;
  console.log(`${label}: ${ms}ms`);
  return result;
}

async function timedFetch(label, url, token) {
  const started = Date.now();
  const response = await fetch(url, { headers: { cookie: `flashmuse-session=${token}` } });
  const text = await response.text();
  const ms = Date.now() - started;
  console.log(`${label}: ${response.status} ${ms}ms ${Buffer.byteLength(text)} bytes`);
  return { response, text };
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  const userId = process.argv[2] || "ID_636611";
  const token = `perf-${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = hashSessionToken(token);

  try {
    const user = await timed("user.findUnique", () => prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }));
    console.log("user", user);
    if (!user) throw new Error(`User not found: ${userId}`);

    const workspace = await timed("workspace shell state", () => prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } }));
    const state = workspace && workspace.state && typeof workspace.state === "object" ? workspace.state : {};
    const activeSessionId = typeof state.activeSessionId === "string" ? state.activeSessionId : "";
    console.log("activeSessionId", activeSessionId);

    await timed("session rows 12", () => prisma.workspaceSession.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
      take: 12,
      select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
    }));
    await timed("active messages 51", () => prisma.workspaceMessage.findMany({
      where: { userId, sessionId: activeSessionId },
      orderBy: { createdAt: "desc" },
      take: 51,
      select: { messageJson: true, createdAt: true },
    }));
    await timed("asset count", () => prisma.userAssetState.count({ where: { userId } }));
    await timed("asset group counts", () => prisma.userAssetState.groupBy({ by: ["currentCategory"], where: { userId, deletedAt: null }, _count: { _all: true } }));
    await timed("asset rows select all current endpoint", () => prisma.userAssetState.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true, currentName: true, currentCategory: true, previousCategory: true, deletedAt: true, purgeAt: true,
        bytePlusAssetId: true, bytePlusAssetGroupId: true, bytePlusAssetStatus: true, bytePlusAssetError: true, bytePlusAssetUpdatedAt: true,
        mediaAsset: { select: { id: true, url: true, posterUrl: true, sourceKind: true, sourcePrompt: true, promptSource: true, reversePrompt: true, previewMeta: true, conversationId: true, messageId: true, createdAt: true, firstSeenAt: true, systemName: true, initialName: true, legacyLibrarySource: true } },
      },
    }));
    await timed("asset rows selected category 60", () => prisma.userAssetState.findMany({
      where: { userId, currentCategory: "shot_video", deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 60,
      select: { id: true, currentName: true, currentCategory: true, previousCategory: true, deletedAt: true, purgeAt: true, mediaAsset: { select: { id: true, url: true, posterUrl: true, sourceKind: true, sourcePrompt: true, promptSource: true, reversePrompt: true, previewMeta: true, conversationId: true, messageId: true, createdAt: true, firstSeenAt: true, systemName: true, initialName: true, legacyLibrarySource: true } } },
    }));

    await prisma.session.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    await timedFetch("API chat panel", "http://127.0.0.1:3000/api/workspace-state?summary=1&panel=chat", token);
    await timedFetch("API assetsOnly", "http://127.0.0.1:3000/api/workspace-state?assetsOnly=1", token);
  } finally {
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
