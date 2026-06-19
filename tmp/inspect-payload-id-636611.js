const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function size(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null));
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  const userId = process.argv[2] || "ID_636611";
  try {
    const workspace = await prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } });
    const state = workspace?.state && typeof workspace.state === "object" ? workspace.state : {};
    console.log("workspace total", size(state));
    for (const key of Object.keys(state).sort()) console.log("state", key, size(state[key]));
    const activeSessionId = typeof state.activeSessionId === "string" ? state.activeSessionId : "";
    const rows = await prisma.workspaceMessage.findMany({ where: { userId, sessionId: activeSessionId }, orderBy: { createdAt: "desc" }, take: 51, select: { messageId: true, role: true, content: true, messageJson: true, createdAt: true } });
    console.log("active messages", activeSessionId, rows.length, "total", size(rows.map((row) => row.messageJson)));
    rows.map((row) => ({ id: row.messageId, role: row.role, contentLength: row.content?.length ?? 0, jsonBytes: size(row.messageJson) }))
      .sort((a, b) => b.jsonBytes - a.jsonBytes)
      .slice(0, 20)
      .forEach((row) => console.log("message", row));
    const sessions = await prisma.workspaceSession.findMany({ where: { userId, deletedAt: null }, orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }], take: 12, select: { sessionId: true, title: true, summaryJson: true, usageSummary: true, memorySummary: true } });
    console.log("session summaries total", size(sessions));
    sessions.forEach((session) => console.log("session", session.sessionId, session.title, "summary", size(session.summaryJson), "usage", size(session.usageSummary), "memory", size(session.memorySummary)));
    const assets = await prisma.userAssetState.findMany({ where: { userId }, include: { mediaAsset: true } });
    console.log("assets include all", assets.length, size(assets));
    assets.map((item) => ({ id: item.id, category: item.currentCategory, url: item.mediaAsset.url, bytes: size(item), promptBytes: size(item.mediaAsset.sourcePrompt), previewBytes: size(item.mediaAsset.previewMeta), legacyBytes: size(item.legacyAssetJson) }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 20)
      .forEach((item) => console.log("asset", item));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
