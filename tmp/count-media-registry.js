const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL=") && item.includes("postgres"));
if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "12424740@qq.com";
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const total = await prisma.userAssetState.count({ where: { userId: user.id } });
  const rows = await prisma.userAssetState.groupBy({ by: ["currentCategory"], where: { userId: user.id }, _count: { _all: true } });
  console.log(JSON.stringify({ userId: user.id, total, rows }, null, 2));
}

main().finally(() => prisma.$disconnect());
