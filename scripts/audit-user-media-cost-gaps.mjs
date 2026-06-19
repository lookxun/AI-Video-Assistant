import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getCreditSource(metadata) {
  return isRecord(metadata) && typeof metadata.creditSource === "string" ? metadata.creditSource : "";
}

function isTextOnlyCreditSource(source) {
  return source === "prompt_optimization" || source === "image_prompt_reverse" || source === "conversation_text" || source === "agent_plan" || source === "general_text";
}

function isMediaCostLedger(ledger) {
  return ledger.direction === "consume" && (ledger.kind === "image" || ledger.kind === "video") && !isTextOnlyCreditSource(getCreditSource(ledger.metadata));
}

function mediaUrlsFromMetadata(metadata) {
  if (!isRecord(metadata)) return [];
  if (Array.isArray(metadata.mediaUrls)) return metadata.mediaUrls.filter((url) => typeof url === "string" && url.trim());
  if (typeof metadata.mediaUrl === "string" && metadata.mediaUrl.trim()) return [metadata.mediaUrl];
  if (Array.isArray(metadata.urls)) return metadata.urls.filter((url) => typeof url === "string" && url.trim());
  return [];
}

function round(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

loadEnv();

const userId = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length) || process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/audit-user-media-cost-gaps.mjs --user=USER_ID");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const [mediaRows, ledgers] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { userId },
      select: { id: true, mediaType: true, url: true, archivedAt: true, creditLedgerId: true, chargedUsd: true, chargedCny: true, chargedCredits: true, totalTokens: true },
    }),
    prisma.creditLedger.findMany({
      where: { userId, direction: "consume" },
      select: { id: true, direction: true, kind: true, label: true, model: true, usd: true, cny: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, imageCount: true, videoCount: true, requestId: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mediaCostLedgers = ledgers.filter(isMediaCostLedger);
  const mediaByLedger = new Map();
  for (const row of mediaRows) {
    if (!row.creditLedgerId) continue;
    const list = mediaByLedger.get(row.creditLedgerId) || [];
    list.push(row);
    mediaByLedger.set(row.creditLedgerId, list);
  }

  const unmatched = [];
  const partial = [];
  for (const ledger of mediaCostLedgers) {
    const rows = mediaByLedger.get(ledger.id) || [];
    const urls = mediaUrlsFromMetadata(ledger.metadata);
    const expectedCount = Math.max(1, urls.length || Number(ledger.imageCount) || Number(ledger.videoCount) || 1);
    const actualCount = rows.length;
    if (actualCount === 0) {
      unmatched.push({ ledger, urls, expectedCount });
    } else if (actualCount < expectedCount) {
      partial.push({ ledger, urls, expectedCount, actualCount, mediaIds: rows.map((row) => row.id) });
    }
  }

  const costMedia = mediaRows.filter((row) => row.creditLedgerId && (row.chargedUsd || row.chargedCny || row.chargedCredits || row.totalTokens));
  console.log(JSON.stringify({
    userId,
    mediaAssets: mediaRows.length,
    mediaCostLedgers: mediaCostLedgers.length,
    representedLedgers: mediaByLedger.size,
    unmatchedLedgers: unmatched.length,
    partialLedgers: partial.length,
    mediaCostSums: {
      usd: round(sum(costMedia, "chargedUsd")),
      cny: round(sum(costMedia, "chargedCny")),
      credits: round(sum(costMedia, "chargedCredits")),
      totalTokens: round(sum(costMedia, "totalTokens")),
    },
    ledgerCostSums: {
      usd: round(sum(mediaCostLedgers, "usd")),
      cny: round(sum(mediaCostLedgers, "cny")),
      credits: round(sum(mediaCostLedgers, "credits")),
      totalTokens: round(sum(mediaCostLedgers, "totalTokens")),
    },
    unmatchedByReason: {
      noMediaUrls: unmatched.filter((item) => item.urls.length === 0).length,
      hasMediaUrls: unmatched.filter((item) => item.urls.length > 0).length,
    },
    unmatchedSamples: unmatched.slice(0, 25).map(({ ledger, urls, expectedCount }) => ({
      id: ledger.id,
      kind: ledger.kind,
      label: ledger.label,
      model: ledger.model,
      creditSource: getCreditSource(ledger.metadata),
      usd: ledger.usd,
      credits: ledger.credits,
      totalTokens: ledger.totalTokens,
      imageCount: ledger.imageCount,
      videoCount: ledger.videoCount,
      expectedCount,
      urlCount: urls.length,
      requestId: ledger.requestId,
      createdAt: ledger.createdAt,
      firstUrl: urls[0]?.slice(0, 160),
    })),
    partialSamples: partial.slice(0, 25).map(({ ledger, urls, expectedCount, actualCount, mediaIds }) => ({
      id: ledger.id,
      kind: ledger.kind,
      label: ledger.label,
      creditSource: getCreditSource(ledger.metadata),
      usd: ledger.usd,
      credits: ledger.credits,
      expectedCount,
      actualCount,
      urlCount: urls.length,
      mediaIds,
    })),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
