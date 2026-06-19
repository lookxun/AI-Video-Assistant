const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
  if (key && !(key in process.env)) process.env[key] = value;
}

function sum(rows, key) { return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0); }
function round(value) { return Math.round((Number(value) || 0) * 1000000) / 1000000; }

async function main() {
  const userId = process.argv[2] || "ID_636611";
  const prisma = new PrismaClient();
  try {
    const [visible, archived, states] = await Promise.all([
      prisma.mediaAsset.findMany({ where: { userId, archivedAt: null }, select: { id: true, mediaType: true, chargedUsd: true, chargedCny: true, chargedCredits: true, promptTokens: true, completionTokens: true, totalTokens: true } }),
      prisma.mediaAsset.count({ where: { userId, archivedAt: { not: null } } }),
      prisma.userAssetState.groupBy({ by: ["currentCategory"], where: { userId, hiddenAt: null, mediaAsset: { archivedAt: null } }, _count: { _all: true } }),
    ]);
    console.log(JSON.stringify({
      userId,
      visibleMedia: visible.length,
      archivedMedia: archived,
      visibleByType: visible.reduce((acc, row) => { acc[row.mediaType] = (acc[row.mediaType] || 0) + 1; return acc; }, {}),
      visibleCategories: Object.fromEntries(states.map((row) => [row.currentCategory, row._count._all])),
      visibleCostSums: {
        usd: round(sum(visible, "chargedUsd")),
        cny: round(sum(visible, "chargedCny")),
        credits: round(sum(visible, "chargedCredits")),
        promptTokens: round(sum(visible, "promptTokens")),
        completionTokens: round(sum(visible, "completionTokens")),
        totalTokens: round(sum(visible, "totalTokens")),
      },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
