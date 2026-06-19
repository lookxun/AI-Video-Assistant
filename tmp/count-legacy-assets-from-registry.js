const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL=") && item.includes("postgres"));
if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
const prisma = new PrismaClient();

function category(type) { return ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash"].includes(type) ? type : "other"; }
function isAssetCategory(type) { return ["character_image", "scene_image", "shot_image", "shot_video"].includes(type); }

async function main() {
  const email = process.argv[2] || "12424740@qq.com";
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const rows = await prisma.userAssetState.findMany({ where: { userId: user.id }, include: { mediaAsset: true } });
  const assets = rows.map((item) => {
    const type = category(item.deletedAt ? "trash" : item.currentCategory);
    return { type, librarySource: isAssetCategory(type) ? "asset_generation" : "conversation", url: item.mediaAsset.url };
  });
  console.log(JSON.stringify({
    total: assets.length,
    assetGeneration: assets.filter((a) => a.type !== "trash" && a.librarySource === "asset_generation").length,
    character_image: assets.filter((a) => a.type === "character_image" && a.librarySource === "asset_generation").length,
    scene_image: assets.filter((a) => a.type === "scene_image" && a.librarySource === "asset_generation").length,
    shot_image: assets.filter((a) => a.type === "shot_image" && a.librarySource === "asset_generation").length,
    conversation: assets.filter((a) => a.type !== "trash" && a.librarySource !== "asset_generation").length,
  }, null, 2));
}
main().finally(() => prisma.$disconnect());
