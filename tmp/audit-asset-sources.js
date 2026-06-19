const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const envText = fs.readFileSync(".env.local", "utf8");
const databaseUrlLine = envText.split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
if (databaseUrlLine) process.env.DATABASE_URL = databaseUrlLine.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");

const prisma = new PrismaClient();

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function getKey(asset) {
  if (!isRecord(asset)) return "";
  if (typeof asset.url === "string" && asset.url) return asset.url.split("?")[0].split("#")[0];
  if (typeof asset.id === "string" && asset.id) return `id:${asset.id}`;
  return "";
}

function addAsset(map, asset, source) {
  if (!isRecord(asset)) return;
  const key = getKey(asset);
  if (!key || map.has(key)) return;
  map.set(key, { ...asset, _source: source });
}

async function main() {
  const email = process.argv[2] || "12424740@qq.com";
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, workspace: { select: { state: true } } } });
  if (!user) throw new Error("user not found");
  const map = new Map();
  const currentState = isRecord(user.workspace?.state) ? user.workspace.state : {};
  (Array.isArray(currentState.assets) ? currentState.assets : []).forEach((asset) => addAsset(map, asset, "current"));

  const backupRows = JSON.parse(fs.readFileSync(".runtime/migration-backups/2026-06-06T18-48-45-483Z-user-workspaces.json", "utf8"));
  const backup = backupRows.find((row) => row.userId === user.id);
  (Array.isArray(backup?.state?.assets) ? backup.state.assets : []).forEach((asset) => addAsset(map, asset, "backup"));

  const messages = await prisma.workspaceMessage.findMany({ where: { userId: user.id }, select: { sessionId: true, messageId: true, messageJson: true, createdAt: true } });
  for (const row of messages) {
    const message = row.messageJson;
    if (!isRecord(message)) continue;
    const refs = Array.isArray(message.imageReferences) ? message.imageReferences : [];
    for (const ref of refs) {
      if (!isRecord(ref) || typeof ref.url !== "string") continue;
      addAsset(map, {
        id: typeof ref.id === "string" ? ref.id : `restored_${map.size + 1}`,
        type: typeof ref.type === "string" ? ref.type : "other",
        name: typeof ref.name === "string" ? ref.name : typeof ref.systemName === "string" ? ref.systemName : "参考图",
        systemName: typeof ref.systemName === "string" ? ref.systemName : undefined,
        url: ref.url,
        librarySource: "asset_generation",
        sourcePrompt: typeof ref.sourcePrompt === "string" ? ref.sourcePrompt : "",
        sessionId: row.sessionId,
        messageId: row.messageId,
        createdAt: row.createdAt.getTime(),
      }, "imageReferences");
    }
  }

  const ledgers = await prisma.creditLedger.findMany({ where: { userId: user.id, direction: "consume" }, select: { conversationId: true, metadata: true, createdAt: true } });
  for (const ledger of ledgers) {
    const meta = ledger.metadata;
    if (!isRecord(meta)) continue;
    const mediaUrls = Array.isArray(meta.mediaUrls) ? meta.mediaUrls : typeof meta.mediaUrl === "string" ? [meta.mediaUrl] : [];
    const creditSource = typeof meta.creditSource === "string" ? meta.creditSource : "";
    if (!creditSource.includes("asset") && !creditSource.includes("character") && !creditSource.includes("scene") && !creditSource.includes("shot")) continue;
    for (const url of mediaUrls) {
      if (typeof url !== "string") continue;
      const type = creditSource.includes("character") ? "character_image" : creditSource.includes("scene") ? "scene_image" : creditSource.includes("shot") ? "shot_image" : "other";
      addAsset(map, {
        id: `ledger_${map.size + 1}`,
        type,
        name: typeof meta.assetName === "string" ? meta.assetName : typeof meta.systemName === "string" ? meta.systemName : type === "character_image" ? "角色图片" : type === "scene_image" ? "场景图片" : "资产图片",
        systemName: typeof meta.systemName === "string" ? meta.systemName : undefined,
        url,
        librarySource: "asset_generation",
        sourcePrompt: typeof meta.originalPrompt === "string" ? meta.originalPrompt : "",
        sessionId: ledger.conversationId || undefined,
        createdAt: ledger.createdAt.getTime(),
      }, "creditLedger");
    }
  }

  const counts = {};
  for (const asset of map.values()) counts[asset._source] = (counts[asset._source] || 0) + 1;
  console.log(JSON.stringify({ current: Array.isArray(currentState.assets) ? currentState.assets.length : 0, merged: map.size, counts }, null, 2));
}

main().finally(() => prisma.$disconnect());
