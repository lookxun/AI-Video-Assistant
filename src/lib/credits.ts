import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreditKind = "text" | "image" | "video";
export type CreditGrantKind = "signup" | "admin_adjust" | "recharge" | "activity";

export type UsageLike = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
};

export type CreditChargeResult = {
  chargedCredits: number;
  expectedCredits: number;
  chargedCny: number;
  chargedUsd: number;
  balance?: number;
  skipped: boolean;
};

export type CreditContext = {
  conversationId?: string;
  conversationTitle?: string;
  requestId?: string;
  label?: string;
  model?: string;
  imageCount?: number;
  videoCount?: number;
  metadata?: Prisma.InputJsonValue;
};

const defaultSettings = {
  usdToCnyRate: 7.2,
  creditsPerCny: 10,
  signupCredits: 1500,
  chargeText: true,
  chargeImage: true,
  chargeVideo: true,
  chargePromptTool: true,
};

const MIN_USD_TO_CNY_RATE = 1;
const MAX_USD_TO_CNY_RATE = 20;
const VALID_CREDITS_PER_CNY = [10, 100, 1000, 10000] as const;

export async function getCreditSettings() {
  return prisma.creditSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", ...defaultSettings },
  });
}

export async function updateCreditSettings(input: Partial<typeof defaultSettings>) {
  const current = await prisma.creditSetting.findUnique({ where: { id: "default" } });
  const inputUsdToCnyRate = typeof input.usdToCnyRate === "number" && Number.isFinite(input.usdToCnyRate) ? input.usdToCnyRate : NaN;
  const inputCreditsPerCny = typeof input.creditsPerCny === "number" && Number.isFinite(input.creditsPerCny) ? Math.floor(input.creditsPerCny) : NaN;
  const nextCreditsPerCny = VALID_CREDITS_PER_CNY.includes(inputCreditsPerCny as (typeof VALID_CREDITS_PER_CNY)[number]) ? inputCreditsPerCny : current?.creditsPerCny ?? defaultSettings.creditsPerCny;
  const inputSignupCredits = typeof input.signupCredits === "number" && Number.isFinite(input.signupCredits) ? Math.floor(input.signupCredits) : NaN;
  const maxSignupCredits = nextCreditsPerCny * 200;
  const fallbackSignupCredits = current && current.signupCredits <= maxSignupCredits ? current.signupCredits : Math.min(defaultSettings.signupCredits, maxSignupCredits);
  const data = {
    usdToCnyRate: inputUsdToCnyRate >= MIN_USD_TO_CNY_RATE && inputUsdToCnyRate <= MAX_USD_TO_CNY_RATE ? inputUsdToCnyRate : current?.usdToCnyRate ?? defaultSettings.usdToCnyRate,
    creditsPerCny: nextCreditsPerCny,
    signupCredits: inputSignupCredits >= 0 && inputSignupCredits <= maxSignupCredits ? inputSignupCredits : fallbackSignupCredits,
    chargeText: typeof input.chargeText === "boolean" ? input.chargeText : current?.chargeText ?? defaultSettings.chargeText,
    chargeImage: typeof input.chargeImage === "boolean" ? input.chargeImage : current?.chargeImage ?? defaultSettings.chargeImage,
    chargeVideo: typeof input.chargeVideo === "boolean" ? input.chargeVideo : current?.chargeVideo ?? defaultSettings.chargeVideo,
    chargePromptTool: typeof input.chargePromptTool === "boolean" ? input.chargePromptTool : current?.chargePromptTool ?? defaultSettings.chargePromptTool,
  };

  return prisma.creditSetting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
}

function getMetadataRecord(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : undefined;
}

function isPromptToolCreditSource(value: unknown) {
  return value === "image_prompt_reverse" || value === "prompt_optimization";
}

function mergeCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

export function getChargeEnabled(settings: Awaited<ReturnType<typeof getCreditSettings>>, kind: CreditKind, metadata?: Prisma.InputJsonValue) {
  if (isPromptToolCreditSource(getMetadataRecord(metadata)?.creditSource)) return settings.chargePromptTool;
  if (kind === "image") return settings.chargeImage;
  if (kind === "video") return settings.chargeVideo;
  return settings.chargeText;
}

export async function assertUserCanUseCredits(user: { credits?: number | null } | null, kind: CreditKind, metadata?: Prisma.InputJsonValue) {
  if (!user) throw new Error("请先登录后再使用模型。");
  const settings = await getCreditSettings();
  if (getChargeEnabled(settings, kind, metadata) && (user.credits ?? 0) <= 0) throw new Error("积分不足，请充值后再使用模型。");
}

function cleanNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function chargeCredits(userId: string, kind: CreditKind, usage?: UsageLike, context: CreditContext = {}) {
  const settings = await getCreditSettings();
  const usd = Math.max(0, cleanNumber(usage?.usd));
  const cny = usd * settings.usdToCnyRate;
  const shouldCharge = getChargeEnabled(settings, kind, context.metadata);
  const expectedCredits = shouldCharge ? Math.max(0, Math.round(cny * settings.creditsPerCny)) : 0;
  const promptTokens = Math.max(0, Math.floor(cleanNumber(usage?.promptTokens)));
  const completionTokens = Math.max(0, Math.floor(cleanNumber(usage?.completionTokens)));
  const totalTokens = Math.max(0, Math.floor(cleanNumber(usage?.totalTokens) || promptTokens + completionTokens));

  if (context.requestId) {
    const existing = await prisma.creditLedger.findUnique({ where: { requestId_kind: { requestId: context.requestId, kind } } }).catch(() => null);
    if (existing) return { chargedCredits: 0, expectedCredits: 0, chargedCny: 0, chargedUsd: 0, balance: undefined, skipped: true } satisfies CreditChargeResult;
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!user) return { chargedCredits: 0, expectedCredits: 0, chargedCny: 0, chargedUsd: 0, balance: undefined, skipped: true } satisfies CreditChargeResult;

    const chargedCredits = Math.min(user.credits, expectedCredits);
    const nextCredits = Math.max(0, user.credits - chargedCredits);
    const chargedCny = settings.creditsPerCny > 0 ? chargedCredits / settings.creditsPerCny : 0;
    const chargedUsd = settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0;

    if (chargedCredits > 0) {
      await tx.user.update({ where: { id: userId }, data: { credits: nextCredits } });
    }

    await tx.creditLedger.create({
      data: {
        userId,
        conversationId: context.conversationId,
        conversationTitle: context.conversationTitle,
        requestId: context.requestId,
        direction: "consume",
        kind,
        label: context.label,
        model: context.model,
        credits: chargedCredits,
        promptTokens,
        completionTokens,
        totalTokens,
        usd,
        cny,
        imageCount: Math.max(0, Math.floor(context.imageCount ?? 0)),
        videoCount: Math.max(0, Math.floor(context.videoCount ?? 0)),
        metadata: mergeCreditMetadata(shouldCharge ? context.metadata : mergeCreditMetadata(context.metadata, { creditChargeDisabled: true }) as Prisma.InputJsonValue, {
          expectedCredits,
          chargedCredits,
          chargedCny,
          chargedUsd,
          usdToCnyRate: settings.usdToCnyRate,
          creditsPerCny: settings.creditsPerCny,
        }),
      },
    });

    return { chargedCredits, expectedCredits, chargedCny, chargedUsd, balance: nextCredits, skipped: false } satisfies CreditChargeResult;
  });
}

export async function recordCreditFailure(userId: string, kind: CreditKind, context: CreditContext = {}) {
  if (context.requestId) {
    const existing = await prisma.creditLedger.findUnique({ where: { requestId_kind: { requestId: context.requestId, kind } } }).catch(() => null);
    if (existing) return { skipped: true };
  }

  await prisma.creditLedger.create({
    data: {
      userId,
      conversationId: context.conversationId,
      conversationTitle: context.conversationTitle,
      requestId: context.requestId,
      direction: "consume",
      kind,
      label: context.label,
      model: context.model,
      credits: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      usd: 0,
      cny: 0,
      imageCount: Math.max(0, Math.floor(context.imageCount ?? 0)),
      videoCount: Math.max(0, Math.floor(context.videoCount ?? 0)),
      metadata: context.metadata,
    },
  });

  return { skipped: false };
}

export async function grantCredits(userId: string, credits: number, kind: CreditGrantKind, context: CreditContext = {}) {
  const grantedCredits = Math.max(0, Math.floor(cleanNumber(credits)));
  if (grantedCredits <= 0) return { grantedCredits: 0, balance: undefined, skipped: true };

  if (context.requestId) {
    const existing = await prisma.creditLedger.findUnique({ where: { requestId_kind: { requestId: context.requestId, kind } } }).catch(() => null);
    if (existing) return { grantedCredits: 0, balance: undefined, skipped: true };
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: grantedCredits } }, select: { credits: true } }).catch(() => null);
    if (!user) return { grantedCredits: 0, balance: undefined, skipped: true };

    await tx.creditLedger.create({
      data: {
        userId,
        conversationId: context.conversationId,
        conversationTitle: context.conversationTitle,
        requestId: context.requestId,
        direction: "increase",
        kind,
        label: context.label,
        model: context.model,
        credits: grantedCredits,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        usd: 0,
        cny: 0,
        imageCount: 0,
        videoCount: 0,
        metadata: context.metadata,
      },
    });

    return { grantedCredits, balance: user.credits, skipped: false };
  });
}
