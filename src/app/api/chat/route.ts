import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, recordCreditFailure } from "@/lib/credits";
import { toUserErrorMessage } from "@/lib/error-message";
import { sendToOpenRouter } from "@/lib/openrouter";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { createCodedApiError } from "@/lib/error-code";
import type { Prisma } from "@prisma/client";
import { appendUploadRuleFeedbackLog, summarizeMessageUploads } from "@/lib/upload-rule-feedback-log";

function mergeChatCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

function getCreditSource(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).creditSource : undefined;
}

function isPromptToolCreditSource(value: unknown) {
  return value === "image_prompt_reverse" || value === "prompt_optimization";
}

function shouldRecordPromptToolFailure(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? Boolean((metadata as Record<string, unknown>).recordFailure) : false;
}

function withChargedUsage<T extends { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; usd?: number } }>(result: T, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return result;
  return { ...result, usage: { ...(result.usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny } };
}

export async function POST(request: Request) {
  let body: {
    model?: string;
    mode?: "agent" | "general" | "chat" | "image" | "video";
    messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
    settings?: {
      ratio?: string;
      resolution?: string;
      style?: string;
      duration?: string;
    };
    originalPrompt?: string;
    conversationId?: string;
    conversationTitle?: string;
    requestId?: string;
    metadata?: Prisma.InputJsonValue;
  } | undefined;
  let model = DEFAULT_CHAT_MODEL;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    body = (await request.json()) as {
      model?: string;
      mode?: "agent" | "general" | "chat" | "image" | "video";
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
      settings?: {
        ratio?: string;
        resolution?: string;
        style?: string;
        duration?: string;
      };
      originalPrompt?: string;
      conversationId?: string;
      conversationTitle?: string;
      requestId?: string;
      metadata?: Prisma.InputJsonValue;
    };

    model = body.model || DEFAULT_CHAT_MODEL;

    if ((model !== "openai/gpt-5.5" && !isModelName(model)) || !body.mode || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (body.mode !== "agent" && body.mode !== "general" && body.mode !== "chat" && body.mode !== "image" && body.mode !== "video") {
      return NextResponse.json({ error: "对话模式不正确" }, { status: 400 });
    }

    user = await getCurrentUser();
    if (body.mode === "general" && !user?.generalModeEnabled) {
      return NextResponse.json({ error: "通用模式未开通" }, { status: 403 });
    }
    await assertUserCanUseCredits(user, "text", body.metadata);

    const result = await sendToOpenRouter({
      model,
      mode: body.mode,
      messages: body.messages,
      settings: body.settings,
      originalPrompt: body.originalPrompt,
    });
    if (isPromptToolCreditSource(getCreditSource(body.metadata)) && !result.content.trim()) {
      throw new Error("服务器繁忙，请稍候再试！");
    }
    const credit = user ? await chargeCredits(user.id, "text", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ? `${body.requestId}:chat` : undefined, label: body.mode === "agent" ? "Agent 回复" : body.mode === "general" ? "通用回复" : "提示词整理", model, metadata: mergeChatCreditMetadata(body.metadata, { outputPrompt: result.content ?? "" }) }) : undefined;

    return NextResponse.json({ ...withChargedUsage(result, credit), credit });
  } catch (error) {
    const uploadSummary = summarizeMessageUploads(body?.messages);
    if (uploadSummary.imageCount > 0 || uploadSummary.documentCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "chat",
        mode: body?.mode,
        model,
        requestId: body?.requestId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        ...uploadSummary,
      });
    }
    if (user?.id && body && isPromptToolCreditSource(getCreditSource(body.metadata)) && shouldRecordPromptToolFailure(body.metadata)) {
      await recordCreditFailure(user.id, "text", {
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        requestId: body.requestId ? `${body.requestId}:chat` : undefined,
        label: body.mode === "agent" ? "Agent 回复" : body.mode === "general" ? "通用回复" : "提示词整理",
        model,
        metadata: mergeChatCreditMetadata(body.metadata, { status: "failed", failureReason: toUserErrorMessage(error, "服务器繁忙，请稍候再试！") }),
      }).catch(() => undefined);
    }
    const codedError = await createCodedApiError(error, "对话请求失败，请稍后再试。", `chat request failed mode=${body?.mode ?? "unknown"} model=${model} requestId=${body?.requestId ?? ""}`);
    return NextResponse.json(codedError, { status: 500 });
  }
}
