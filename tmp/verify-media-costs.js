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

function round(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  const userId = process.argv[2] || "ID_636611";
  try {
    const [mediaRows, ledgers, states] = await Promise.all([
      prisma.mediaAsset.findMany({ where: { userId }, select: { id: true, mediaType: true, chargedUsd: true, chargedCny: true, chargedCredits: true, promptTokens: true, completionTokens: true, totalTokens: true, creditLedgerId: true, costSource: true } }),
      prisma.creditLedger.findMany({ where: { userId, direction: "consume" }, select: { id: true, direction: true, kind: true, credits: true, usd: true, cny: true, promptTokens: true, completionTokens: true, totalTokens: true, metadata: true } }),
      prisma.userAssetState.groupBy({ by: ["currentCategory"], where: { userId }, _count: { _all: true } }),
    ]);
    const costMedia = mediaRows.filter((row) => row.creditLedgerId && (row.chargedUsd || row.chargedCny || row.chargedCredits || row.totalTokens));
    const mediaLedgers = ledgers.filter(isMediaCostLedger);
    const textLedgers = ledgers.filter((ledger) => isTextOnlyCreditSource(getCreditSource(ledger.metadata)) || ledger.kind === "text");
    const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    console.log(JSON.stringify({
      userId,
      mediaAssets: mediaRows.length,
      costMediaAssets: costMedia.length,
      categories: Object.fromEntries(states.map((row) => [row.currentCategory, row._count._all])),
      mediaCostSums: {
        usd: round(sum(costMedia, "chargedUsd")),
        cny: round(sum(costMedia, "chargedCny")),
        credits: round(sum(costMedia, "chargedCredits")),
        promptTokens: round(sum(costMedia, "promptTokens")),
        completionTokens: round(sum(costMedia, "completionTokens")),
        totalTokens: round(sum(costMedia, "totalTokens")),
      },
      mediaLedgerSums: {
        rows: mediaLedgers.length,
        usd: round(sum(mediaLedgers, "usd")),
        cny: round(sum(mediaLedgers, "cny")),
        credits: round(sum(mediaLedgers, "credits")),
        promptTokens: round(sum(mediaLedgers, "promptTokens")),
        completionTokens: round(sum(mediaLedgers, "completionTokens")),
        totalTokens: round(sum(mediaLedgers, "totalTokens")),
      },
      textOnlyLedgerSums: {
        rows: textLedgers.length,
        usd: round(sum(textLedgers, "usd")),
        cny: round(sum(textLedgers, "cny")),
        credits: round(sum(textLedgers, "credits")),
        promptTokens: round(sum(textLedgers, "promptTokens")),
        completionTokens: round(sum(textLedgers, "completionTokens")),
        totalTokens: round(sum(textLedgers, "totalTokens")),
      },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
