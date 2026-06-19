const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
  if (key && !(key in process.env)) process.env[key] = value;
}

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const userId = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length) || "ID_636611";

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function normalizeUrl(value) { return typeof value === "string" ? value.trim().split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/i, "") : ""; }
function toPublicPath(value) { return normalizeUrl(value); }
function publicExists(publicUrl) {
  if (!publicUrl?.startsWith("/generated/")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", publicUrl.replace(/^\//, "")));
}
function imageThumbnailFor(localUrl) {
  const clean = toPublicPath(localUrl);
  if (!clean.startsWith("/generated/")) return "";
  const userMatch = clean.match(/^\/generated\/users\/([^/]+)\/(.+)$/);
  const relative = (userMatch ? userMatch[2] : clean.replace(/^\/generated\//, "")).replace(/\.[^.\/\\]+$/, ".jpg");
  return userMatch ? `/generated/users/${userMatch[1]}/image-thumbnails/${relative}` : `/generated/image-thumbnails/${relative}`;
}

function loadJobs() {
  const file = ".runtime/media-save-jobs.json";
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.jobs) ? parsed.jobs : [];
}

async function main() {
  try {
    const [mediaRows, messageRows] = await Promise.all([
      prisma.mediaAsset.findMany({ where: { userId, archivedAt: null }, orderBy: { firstSeenAt: "desc" } }),
      prisma.workspaceMessage.findMany({ where: { userId }, select: { messageJson: true } }),
    ]);
    const jobs = loadJobs().filter((job) => !job.userId || job.userId === userId);
    const jobByLocal = new Map();
    const jobByRemote = new Map();
    for (const job of jobs) {
      const local = normalizeUrl(job.localUrl);
      const remote = normalizeUrl(job.remoteUrl);
      if (local) jobByLocal.set(local, job);
      if (remote) jobByRemote.set(remote, job);
    }
    const posterByVideo = new Map();
    for (const row of messageRows) {
      const message = row.messageJson;
      if (!isRecord(message) || !isRecord(message.videoPosters)) continue;
      for (const [videoUrl, posterUrl] of Object.entries(message.videoPosters)) {
        if (typeof posterUrl === "string") posterByVideo.set(normalizeUrl(videoUrl), posterUrl);
      }
    }

    const plans = [];
    for (const row of mediaRows) {
      const url = normalizeUrl(row.url);
      const job = jobByLocal.get(url) || jobByRemote.get(url);
      const patch = {};
      if (row.mediaType === "image" && !row.thumbnailUrl) {
        const jobThumb = normalizeUrl(job?.thumbnailUrl);
        const derived = imageThumbnailFor(row.url);
        if (jobThumb && publicExists(jobThumb)) patch.thumbnailUrl = jobThumb;
        else if (derived && publicExists(derived)) patch.thumbnailUrl = derived;
      }
      if (row.mediaType === "video" && !row.posterUrl) {
        const jobPoster = normalizeUrl(job?.posterUrl);
        const messagePoster = normalizeUrl(posterByVideo.get(url));
        if (jobPoster && publicExists(jobPoster)) patch.posterUrl = jobPoster;
        else if (messagePoster && publicExists(messagePoster)) patch.posterUrl = messagePoster;
        else if (jobPoster) patch.posterUrl = jobPoster;
        else if (messagePoster) patch.posterUrl = messagePoster;
      }
      if (Object.keys(patch).length > 0) plans.push({ row, patch });
    }
    if (!DRY_RUN) {
      for (const plan of plans) await prisma.mediaAsset.update({ where: { id: plan.row.id }, data: plan.patch });
    }
    const stats = {
      dryRun: DRY_RUN,
      userId,
      visibleMedia: mediaRows.length,
      imageMissingBefore: mediaRows.filter((row) => row.mediaType === "image" && !row.thumbnailUrl).length,
      videoMissingBefore: mediaRows.filter((row) => row.mediaType === "video" && !row.posterUrl).length,
      updates: plans.length,
      thumbnailUpdates: plans.filter((plan) => plan.patch.thumbnailUrl).length,
      posterUpdates: plans.filter((plan) => plan.patch.posterUrl).length,
      sample: plans.slice(0, 20).map((plan) => ({ id: plan.row.id, type: plan.row.mediaType, url: plan.row.url, patch: plan.patch })),
    };
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
