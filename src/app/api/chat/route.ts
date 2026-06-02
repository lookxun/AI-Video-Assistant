import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, recordCreditFailure } from "@/lib/credits";
import { toUserErrorMessage } from "@/lib/error-message";
import { sendToOpenRouter } from "@/lib/openrouter";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { createCodedApiError } from "@/lib/error-code";
import type { Prisma } from "@prisma/client";

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

export async function POST(request: Request) {
  let body: {
    model?: string;
    mode?: "agent" | "chat" | "image" | "video";
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
      mode?: "agent" | "chat" | "image" | "video";
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

    if (body.mode !== "agent" && body.mode !== "chat" && body.mode !== "image" && body.mode !== "video") {
      return NextResponse.json({ error: "对话模式不正确" }, { status: 400 });
    }

    user = await getCurrentUser();
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
    const credit = user ? await chargeCredits(user.id, "text", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ? `${body.requestId}:chat` : undefined, label: body.mode === "agent" ? "Agent 回复" : "提示词整理", model, metadata: mergeChatCreditMetadata(body.metadata, { outputPrompt: result.content ?? "" }) }) : undefined;

    return NextResponse.json({ ...result, credit });
  } catch (error) {
    if (user?.id && body && isPromptToolCreditSource(getCreditSource(body.metadata)) && shouldRecordPromptToolFailure(body.metadata)) {
      await recordCreditFailure(user.id, "text", {
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        requestId: body.requestId ? `${body.requestId}:chat` : undefined,
        label: body.mode === "agent" ? "Agent 回复" : "提示词整理",
        model,
        metadata: mergeChatCreditMetadata(body.metadata, { status: "failed", failureReason: toUserErrorMessage(error, "服务器繁忙，请稍候再试！") }),
      }).catch(() => undefined);
    }
    const codedError = await createCodedApiError(error, "对话请求失败，请稍后再试。", "chat request failed");
    return NextResponse.json(codedError, { status: 500 });
  }
}
