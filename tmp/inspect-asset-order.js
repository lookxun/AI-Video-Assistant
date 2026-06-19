const fs = require("fs");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
  if (key && !(key in process.env)) process.env[key] = value;
}

const prisma = new PrismaClient();
const secret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";
const token = `perf-${crypto.randomBytes(24).toString("base64url")}`;
const tokenHash = crypto.createHash("sha256").update(`${secret}:session:${token}`).digest("hex");

async function inspect(filter) {
  const response = await fetch(`http://127.0.0.1:3000/api/workspace-state?assetsOnly=1&assetFilter=${filter}&assetOffset=0&assetLimit=8`, { headers: { cookie: `flashmuse-session=${token}` } });
  const data = await response.json();
  console.log(filter, (data.state?.assets || []).map((asset) => ({ name: asset.name, createdAt: asset.createdAt, date: new Date(asset.createdAt).toISOString(), url: asset.url })).slice(0, 8));
}

async function main() {
  await prisma.session.create({ data: { userId: "ID_636611", tokenHash, expiresAt: new Date(Date.now() + 600000) } });
  try {
    await inspect("conversation_images");
    await inspect("conversation_videos");
  } finally {
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
