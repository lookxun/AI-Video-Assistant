import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits } from "@/lib/credits";
import { generateOpenRouterImage } from "@/lib/openrouter";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { getExpectedImageDimensions } from "@/lib/models";
import { isAgentImageModelEnabled, isAssetImageModelEnabled, isConversationImageModelEnabled } from "@/lib/system-settings";
import { validateReferenceImageCount } from "@/lib/upload-rules";
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

function pickImageDimensions(dimensions: Record<string, { width: number; height: number }> | undefined, urls: string[]) {
  if (!dimensions) return dimensions;
  return Object.fromEntries(urls.map((url) => [url, dimensions[url]]).filter((item): item is [string, { width: number; height: number }] => Boolean(item[1])));
}

function isSameImageDimensions(a: { width: number; height: number } | undefined, b: { width: number; height: number } | undefined) {
  return Boolean(a && b && a.width === b.width && a.height === b.height);
}

function pickRequestedImages(images: string[], dimensions: Record<string, { width: number; height: number }> | undefined, requestedCount: number, model: string | undefined, settings: { ratio?: string; resolution?: string } | undefined) {
  const expected = getExpectedImageDimensions(model, settings?.resolution, settings?.ratio);
  if (!expected.width || !expected.height || !dimensions) return images.slice(0, requestedCount);
  const matched = images.filter((url) => isSameImageDimensions(dimensions[url], expected));
  return (matched.length > 0 ? matched : images).slice(0, requestedCount);
}

function isAssetImageCreditSource(source: string | undefined) {
  return source === "character_image_generation" || source === "scene_image_generation" || source === "shot_image_generation";
}

function isAgentImageCreditSource(source: string | undefined) {
  return source === "agent_image_generation";
}

function isImageModelEnabledForSource(model: string, source: string | undefined) {
  if (isAssetImageCreditSource(source)) return isAssetImageModelEnabled(model);
  if (isAgentImageCreditSource(source)) return isAgentImageModelEnabled(model);
  return isConversationImageModelEnabled(model);
}

function getBytePlusProviderKey(modelId: string | undefined, source: string | undefined) {
  if (!modelId?.startsWith("byteplus:")) return undefined;
  const prefix = isAssetImageCreditSource(source) ? "asset-image" : isAgentImageCreditSource(source) ? "agent-image" : "conversation-image";
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
    if (body.model && !isImageModelEnabledForSource(body.model, creditSource)) return NextResponse.json({ error: "连接不到模型，请联系管理员！" }, { status: 400 });
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : [];
    const referenceLimitError = validateReferenceImageCount({ mode: isAssetImageCreditSource(creditSource) ? "asset-image" : "image", modelId: body.model, transportMode: "local-base64" }, referenceImages.length);
    if (referenceLimitError) return NextResponse.json({ error: referenceLimitError }, { status: 400 });

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "image", body.metadata);

    const requestedImageCount = getRequestedImageCount(body.count);
    console.log("[image-generation] api request start", {
      requestId: body.requestId,
      model: body.model,
      bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource),
      settings: body.settings,
      requestedImageCount,
      referenceCount: referenceImages.length,
      creditSource,
    });
    const result = await generateOpenRouterImage(prompt, referenceImages, {
      model: body.model,
      bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource),
      settings: body.settings,
      count: body.count,
      candidateMode: body.candidateMode,
      requestId: body.requestId,
    });
    const providerReturnedImageCount = result.images.length;
    const deliveredImages = pickRequestedImages(result.images, result.imageDimensions, requestedImageCount, body.model, body.settings);
    if (deliveredImages.length === 0) {
      const codedError = await createCodedApiError(new Error("图片平台没有返回图片，且没有返回可用原因。"), GENERIC_MEDIA_ERROR_MESSAGE, "image-generation empty delivery");
      return NextResponse.json(codedError, { status: 502 });
    }
    const billableImageCount = deliveredImages.length;
    const deliveredImageDimensions = pickImageDimensions(result.imageDimensions, deliveredImages);
    const credit = user ? await chargeCredits(user.id, "image", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId, label: "图片生成", model: body.model, imageCount: billableImageCount, metadata: mergeImageCreditMetadata(body.metadata, { requestedImageCount, returnedImageCount: deliveredImages.length, providerReturnedImageCount, billableImageCount, mediaUrls: deliveredImages, allMediaUrls: deliveredImages, extraMediaUrls: [], delivered: deliveredImages.length > 0 }) }) : undefined;
    return NextResponse.json({ ...result, images: deliveredImages, imageDimensions: deliveredImageDimensions, requestedImageCount, returnedImageCount: deliveredImages.length, providerReturnedImageCount, billableImageCount, credit });
  } catch (error) {
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "image-generation request failed");
    return NextResponse.json(codedError, { status: 500 });
  }
}
