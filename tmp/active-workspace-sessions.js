const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL=") && item.includes("postgres"));
if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.session.findMany({
    where: { activeWorkspaceSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    select: {
      userId: true,
      lastSeenAt: true,
      activeWorkspaceSeenAt: true,
      user: { select: { email: true, lastLoginIp: true, lastLoginLocation: true, lastLoginAt: true } },
    },
    orderBy: { activeWorkspaceSeenAt: "desc" },
  });
  console.log(JSON.stringify(rows.map((row) => ({
    userId: row.userId,
    email: row.user.email,
    lastLoginIp: row.user.lastLoginIp,
    lastLoginLocation: row.user.lastLoginLocation,
    lastSeenAt: row.lastSeenAt,
    activeWorkspaceSeenAt: row.activeWorkspaceSeenAt,
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
