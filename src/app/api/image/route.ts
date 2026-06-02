import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits } from "@/lib/credits";
import { generateOpenRouterImage } from "@/lib/openrouter";
import { createCodedApiError } from "@/lib/error-code";
import { isAssetImageModelEnabled, isConversationImageModelEnabled } from "@/lib/system-settings";
import type { Prisma } from "@prisma/client";

function getRequestedImageCount(value: unknown) {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 1;
  return Math.min(4, Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)));
}

function mergeImageCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

function getCreditSource(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof (metadata as Record<string, unknown>).creditSource === "string" ? (metadata as Record<string, string>).creditSource : undefined;
}

function isAssetImageCreditSource(source: string | undefined) {
  return source === "character_image_generation" || source === "scene_image_generation" || source === "shot_image_generation";
}

function getBytePlusProviderKey(modelId: string | undefined, source: string | undefined) {
  if (!modelId?.startsWith("byteplus:")) return undefined;
  const prefix = isAssetImageCreditSource(source) ? "asset-image" : "conversation-image";
  if (modelId.endsWith("seedream-4-5")) return `${prefix}.seedream-4-5`;
  if (modelId.endsWith("seedream-5-0")) return `${prefix}.seedream-5-0`;
  return undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string; model?: string; referenceImages?: string[]; settings?: { ratio?: string; resolution?: string }; count?: number; candidateMode?: "all" | "best"; conversationId?: string; conversationTitle?: string; requestId?: string; metadata?: Prisma.InputJsonValue };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
    }
    const creditSource = getCreditSource(body.metadata);
    if (body.model && !(isAssetImageCreditSource(creditSource) ? isAssetImageModelEnabled(body.model) : isConversationImageModelEnabled(body.model))) return NextResponse.json({ error: "连接不到模型，请联系管理员！" }, { status: 400 });

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "image", body.metadata);

    const requestedImageCount = getRequestedImageCount(body.count);
    console.log("[image-generation] api request start", {
      requestId: body.requestId,
      model: body.model,
      bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource),
      settings: body.settings,
      requestedImageCount,
      referenceCount: Array.isArray(body.referenceImages) ? body.referenceImages.length : 0,
      creditSource,
    });
    const result = await generateOpenRouterImage(prompt, Array.isArray(body.referenceImages) ? body.referenceImages : [], {
      model: body.model,
      bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource),
      settings: body.settings,
      count: body.count,
      candidateMode: body.candidateMode,
    });
    const billableImageCount = Math.min(result.images.length, requestedImageCount);
    const billableMediaUrls = result.images.slice(0, Math.max(1, billableImageCount));
    const extraMediaUrls = result.images.slice(billableImageCount);
    const credit = user ? await chargeCredits(user.id, "image", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId, label: "图片生成", model: body.model, imageCount: billableImageCount, metadata: mergeImageCreditMetadata(body.metadata, { requestedImageCount, returnedImageCount: result.images.length, billableImageCount, mediaUrls: billableMediaUrls, allMediaUrls: result.images, extraMediaUrls, delivered: result.images.length > 0 }) }) : undefined;
    return NextResponse.json({ ...result, requestedImageCount, returnedImageCount: result.images.length, billableImageCount, credit });
  } catch (error) {
    const codedError = await createCodedApiError(error, "图片生成失败，请稍后再试。", "image-generation request failed");
    return NextResponse.json(codedError, { status: 500 });
  }
}
