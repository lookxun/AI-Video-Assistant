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

async function timedFetch(label, url) {
  const started = Date.now();
  const response = await fetch(url, { headers: { cookie: `flashmuse-session=${token}` } });
  const text = await response.text();
  console.log(`${label}: ${response.status} ${Date.now() - started}ms ${Buffer.byteLength(text)} bytes`);
}

async function main() {
  await prisma.session.create({ data: { userId: "ID_636611", tokenHash, expiresAt: new Date(Date.now() + 600000) } });
  try {
    for (const filter of ["character_image", "scene_image", "shot_image", "shot_video", "conversation_images", "conversation_uploads", "conversation_videos", "trash"]) {
      await timedFetch(filter, `http://127.0.0.1:3000/api/workspace-state?assetsOnly=1&assetFilter=${filter}&assetOffset=0&assetLimit=60`);
    }
  } finally {
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
