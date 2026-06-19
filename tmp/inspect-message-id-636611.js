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
    let value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function size(value) { return Buffer.byteLength(JSON.stringify(value ?? null)); }

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  const row = await prisma.workspaceMessage.findFirst({
    where: { userId: "ID_636611", messageId: process.argv[2] || "05b32088-de56-4733-b567-440301eb0e23" },
    select: { messageJson: true },
  });
  const msg = row?.messageJson || {};
  console.log("total", size(msg));
  for (const key of Object.keys(msg).sort()) console.log(key, size(msg[key]), typeof msg[key]);
  console.log(JSON.stringify({
    images: msg.images,
    videoUrl: msg.videoUrl,
    videos: msg.videos,
    videoPostersKeys: Object.keys(msg.videoPosters || {}).slice(0, 10),
    imageDimensionsKeys: Object.keys(msg.imageDimensions || {}).slice(0, 10),
  }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exit(1); });
