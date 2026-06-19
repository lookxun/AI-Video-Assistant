const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
  if (key && !(key in process.env)) process.env[key] = value;
}

const prisma = new PrismaClient();

function deletedAsset(asset) {
  return asset && typeof asset === "object" && (asset.type === "trash" || Number(asset.deletedAt || 0) > 0 || Number(asset.purgeAt || 0) > 0);
}

async function main() {
  const userId = process.argv[2] || "ID_636611";
  try {
    const [workspace, states] = await Promise.all([
      prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } }),
      prisma.userAssetState.findMany({
        where: { userId, OR: [{ deletedAt: { not: null } }, { purgeAt: { not: null } }, { currentCategory: "trash" }, { previousCategory: "trash" }, { hiddenAt: { not: null } }] },
        include: { mediaAsset: { select: { id: true, url: true, archivedAt: true, archiveReason: true, duplicateOfMediaAssetId: true } } },
        orderBy: [{ updatedAt: "desc" }],
      }),
    ]);
    const legacyAssets = Array.isArray(workspace?.state?.assets) ? workspace.state.assets : [];
    const legacyDeleted = legacyAssets.filter(deletedAsset);
    console.log(JSON.stringify({
      userId,
      legacyDeletedCount: legacyDeleted.length,
      legacyDeleted: legacyDeleted.map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, previousType: asset.previousType, deletedAt: asset.deletedAt, purgeAt: asset.purgeAt, url: asset.url })).slice(0, 100),
      newStateRows: states.length,
      newStates: states.map((state) => ({ id: state.id, mediaAssetId: state.mediaAssetId, currentName: state.currentName, currentCategory: state.currentCategory, previousCategory: state.previousCategory, deletedAt: state.deletedAt, purgeAt: state.purgeAt, hiddenAt: state.hiddenAt, hiddenReason: state.hiddenReason, archivedAt: state.mediaAsset.archivedAt, archiveReason: state.mediaAsset.archiveReason, duplicateOfMediaAssetId: state.mediaAsset.duplicateOfMediaAssetId, url: state.mediaAsset.url })).slice(0, 120),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
