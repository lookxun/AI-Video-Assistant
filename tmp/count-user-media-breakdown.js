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
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  const userId = process.argv[2] || "ID_636611";
  try {
    const [mediaByType, mediaBySource, stateByCategory, workspace] = await Promise.all([
      prisma.mediaAsset.groupBy({ by: ["mediaType"], where: { userId }, _count: { _all: true } }),
      prisma.mediaAsset.groupBy({ by: ["mediaType", "sourceKind"], where: { userId }, _count: { _all: true } }),
      prisma.userAssetState.groupBy({ by: ["currentCategory", "deletedAt"], where: { userId }, _count: { _all: true } }),
      prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } }),
    ]);
    const state = workspace?.state && typeof workspace.state === "object" ? workspace.state : {};
    const oldAssets = Array.isArray(state.assets) ? state.assets : [];
    const oldAssetImageCount = oldAssets.filter((asset) => asset && typeof asset === "object" && typeof asset.url === "string" && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(asset.url)).length;
    const oldAssetVideoCount = oldAssets.filter((asset) => asset && typeof asset === "object" && typeof asset.url === "string" && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(asset.url)).length;
    console.log(JSON.stringify({
      userId,
      mediaByType: Object.fromEntries(mediaByType.map((row) => [row.mediaType, row._count._all])),
      mediaBySource: mediaBySource.map((row) => ({ mediaType: row.mediaType, sourceKind: row.sourceKind, count: row._count._all })).sort((a, b) => `${a.mediaType}:${a.sourceKind}`.localeCompare(`${b.mediaType}:${b.sourceKind}`)),
      userAssetStateByCategory: stateByCategory.map((row) => ({ category: row.currentCategory, deleted: Boolean(row.deletedAt), count: row._count._all })).sort((a, b) => `${a.deleted}:${a.category}`.localeCompare(`${b.deleted}:${b.category}`)),
      legacyWorkspaceAssets: { total: oldAssets.length, image: oldAssetImageCount, video: oldAssetVideoCount },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
