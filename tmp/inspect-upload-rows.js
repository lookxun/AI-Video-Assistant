const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.userAssetState.findMany({
    where: { userId: "ID_636611", hiddenAt: null, mediaAsset: { archivedAt: null, url: { contains: "/upload_image/" } } },
    select: { currentName: true, currentCategory: true, mediaAsset: { select: { url: true, sourceKind: true, promptSource: true, sourcePrompt: true } } },
  });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}
main().catch((error) => { console.error(error); process.exit(1); });
