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
  const started = Date.now();
  const response = await fetch(`http://127.0.0.1:3000/api/workspace-state?assetsOnly=1&assetFilter=${filter}&assetOffset=0&assetLimit=5`, { headers: { cookie: `flashmuse-session=${token}` } });
  const text = await response.text();
  const data = JSON.parse(text);
  console.log(JSON.stringify({
    filter,
    status: response.status,
    ms: Date.now() - started,
    bytes: Buffer.byteLength(text),
    counts: data.state?.assetCounts,
    hasMore: data.state?.assetsHasMore,
    nextOffset: data.state?.assetsNextOffset,
    assets: (data.state?.assets || []).map((asset) => ({ name: asset.name, type: asset.type, librarySource: asset.librarySource, promptSource: asset.promptSource, sourcePrompt: asset.sourcePrompt?.slice(0, 32), previewMeta: asset.previewMeta, url: asset.url })),
  }, null, 2));
}

async function main() {
  await prisma.session.create({ data: { userId: "ID_636611", tokenHash, expiresAt: new Date(Date.now() + 600000) } });
  try {
    for (const filter of ["conversation_images", "conversation_videos"]) await inspect(filter);
  } finally {
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
