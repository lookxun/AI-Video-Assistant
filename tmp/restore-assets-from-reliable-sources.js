const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const envText = fs.readFileSync(".env.local", "utf8");
const databaseUrlLine = envText.split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
if (databaseUrlLine) process.env.DATABASE_URL = databaseUrlLine.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");

const prisma = new PrismaClient();

function isRecord(value) { return value && typeof value === "object" && !Array.isArray(value); }
function keyOf(asset) {
  if (!isRecord(asset)) return "";
  if (typeof asset.url === "string" && asset.url) return asset.url.split("?")[0].split("#")[0];
  if (typeof asset.id === "string" && asset.id) return `id:${asset.id}`;
  return "";
}
function add(map, asset) {
  if (!isRecord(asset)) return;
  const key = keyOf(asset);
  if (!key || map.has(key)) return;
  const { _source, ...clean } = asset;
  map.set(key, clean);
}

async function main() {
  const email = process.argv[2] || "12424740@qq.com";
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, workspace: { select: { state: true } } } });
  if (!user || !isRecord(user.workspace?.state)) throw new Error("workspace not found");

  const currentState = user.workspace.state;
  const map = new Map();
  (Array.isArray(currentState.assets) ? currentState.assets : []).forEach((asset) => add(map, asset));

  const backupRows = JSON.parse(fs.readFileSync(".runtime/migration-backups/2026-06-06T18-48-45-483Z-user-workspaces.json", "utf8"));
  const backup = backupRows.find((row) => row.userId === user.id);
  (Array.isArray(backup?.state?.assets) ? backup.state.assets : []).forEach((asset) => add(map, asset));

  const messages = await prisma.workspaceMessage.findMany({ where: { userId: user.id }, select: { sessionId: true, messageId: true, messageJson: true, createdAt: true } });
  for (const row of messages) {
    const message = row.messageJson;
    if (!isRecord(message)) continue;
    for (const ref of Array.isArray(message.imageReferences) ? message.imageReferences : []) {
      if (!isRecord(ref) || typeof ref.url !== "string") continue;
      add(map, {
        id: typeof ref.id === "string" ? ref.id : `restored_ref_${map.size + 1}`,
        type: typeof ref.type === "string" ? ref.type : "other",
        name: typeof ref.name === "string" ? ref.name : typeof ref.systemName === "string" ? ref.systemName : "参考图",
        systemName: typeof ref.systemName === "string" ? ref.systemName : undefined,
        userName: typeof ref.userName === "string" ? ref.userName : undefined,
        url: ref.url,
        librarySource: "asset_generation",
        sourcePrompt: typeof ref.sourcePrompt === "string" ? ref.sourcePrompt : "",
        sessionId: row.sessionId,
        messageId: row.messageId,
        createdAt: row.createdAt.getTime(),
      });
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
      add(map, {
        id: `restored_ledger_${map.size + 1}`,
        type,
        name: typeof meta.assetName === "string" ? meta.assetName : typeof meta.systemName === "string" ? meta.systemName : type === "character_image" ? "角色图片" : type === "scene_image" ? "场景图片" : "资产图片",
        systemName: typeof meta.systemName === "string" ? meta.systemName : undefined,
        url,
        librarySource: "asset_generation",
        sourcePrompt: typeof meta.originalPrompt === "string" ? meta.originalPrompt : "",
        sessionId: ledger.conversationId || undefined,
        createdAt: ledger.createdAt.getTime(),
      });
    }
  }

  const restoredAssets = Array.from(map.values()).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  const backupDir = ".runtime/migration-backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${user.id}-before-reliable-asset-restore.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ userId: user.id, email: user.email, state: currentState }, null, 2));

  await prisma.userWorkspaceState.update({
    where: { userId: user.id },
    data: { state: { ...currentState, assets: restoredAssets } },
  });

  console.log(JSON.stringify({ userId: user.id, before: Array.isArray(currentState.assets) ? currentState.assets.length : 0, after: restoredAssets.length, backupPath }, null, 2));
}

main().finally(() => prisma.$disconnect());
