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

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function normalizeUrl(value) { return typeof value === "string" ? value.trim().split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/i, "") : ""; }
function messageVideos(message) { return [...(Array.isArray(message.videos) ? message.videos : []), ...(typeof message.videoUrl === "string" ? [message.videoUrl] : [])].filter(Boolean); }
function messageImages(message) { return Array.isArray(message.images) ? message.images : Array.isArray(message.imageResultSlots) ? message.imageResultSlots.filter(isRecord).map((slot) => slot.url).filter(Boolean) : []; }

async function main() {
  const userId = process.argv[2] || "ID_636611";
  try {
    const rows = await prisma.mediaAsset.findMany({
      where: { userId, archivedAt: null },
      include: { userStates: { where: { hiddenAt: null } } },
      orderBy: [{ firstSeenAt: "desc" }],
    });
    const messages = await prisma.workspaceMessage.findMany({ where: { userId }, select: { sessionId: true, messageId: true, messageJson: true, createdAt: true } });
    const byUrl = new Map();
    for (const row of messages) {
      const message = row.messageJson;
      if (!isRecord(message)) continue;
      for (const url of [...messageImages(message), ...messageVideos(message)]) {
        const key = normalizeUrl(url);
        if (key) byUrl.set(key, { row, message });
      }
    }
    const gaps = rows.filter((row) => {
      if (row.userStates.length === 0) return false;
      return !row.sourcePrompt || !row.model || !row.ratio || !row.resolution || (!row.width && !row.height && !row.imageSize);
    });
    console.log(JSON.stringify({
      totalVisible: rows.filter((row) => row.userStates.length > 0).length,
      gaps: gaps.length,
      gapSamples: gaps.slice(0, 30).map((row) => {
        const match = byUrl.get(normalizeUrl(row.url));
        const message = match?.message;
        const meta = isRecord(message?.generationMeta) ? message.generationMeta : undefined;
        return {
          id: row.id,
          type: row.mediaType,
          name: row.userStates[0]?.currentName,
          category: row.userStates[0]?.currentCategory,
          url: row.url,
          current: { prompt: row.sourcePrompt?.slice(0, 40), model: row.model, ratio: row.ratio, resolution: row.resolution, imageSize: row.imageSize, videoDuration: row.videoDuration, width: row.width, height: row.height },
          messageMatch: Boolean(match),
          message: match ? { sessionId: match.row.sessionId, messageId: match.row.messageId, prompt: (message.imagePrompts?.[row.url] || message.videoPrompts?.[row.url] || meta?.originalPrompt || message.content || "").slice(0, 80), model: meta?.model, settings: meta?.settings, imageDim: message.imageDimensions?.[row.url], videoDim: message.videoDimensionsMap?.[row.url] || message.videoDimensions } : undefined,
        };
      }),
    }, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exit(1); });
