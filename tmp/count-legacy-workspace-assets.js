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

async function main() {
  const userId = process.argv[2] || "ID_636611";
  const workspace = await prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } });
  const assets = Array.isArray(workspace?.state?.assets) ? workspace.state.assets : [];
  const counts = {};
  for (const asset of assets) {
    const key = `${asset?.librarySource || ""}:${asset?.type || ""}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  console.log(JSON.stringify({
    userId,
    total: assets.length,
    counts,
    first20: assets.slice(0, 20).map((asset) => ({ name: asset.name, type: asset.type, librarySource: asset.librarySource, url: asset.url })),
  }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
