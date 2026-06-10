import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits } from "@/lib/credits";
import { planAgentTask } from "@/lib/openrouter";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { createCodedApiError } from "@/lib/error-code";
import { appendGeneralTaskLog } from "@/lib/general-task-log";
import { appendUploadRuleFeedbackLog, summarizeMessageUploads } from "@/lib/upload-rule-feedback-log";

function withChargedUsage<T extends { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; usd?: number } }>(result: T, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return result;
  return { ...result, usage: { ...(result.usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny } };
}

export async function POST(request: Request) {
  let body: {
    model?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
    conversationId?: string;
    conversationTitle?: string;
    requestId?: string;
    mode?: "agent" | "general";
  } | undefined;

  try {
    body = (await request.json()) as {
      model?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
      conversationId?: string;
      conversationTitle?: string;
      requestId?: string;
      mode?: "agent" | "general";
    };

    const model = body.model || DEFAULT_CHAT_MODEL;

    if (!isModelName(model) || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (body.mode === "general" && !user?.generalModeEnabled) {
      return NextResponse.json({ error: "通用模式未开通" }, { status: 403 });
    }
    await assertUserCanUseCredits(user, "text");

    const result = await planAgentTask({ model, messages: body.messages, mode: body.mode === "general" ? "general" : "agent" });
    if (body.mode === "general") {
      const latestUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
      void appendGeneralTaskLog({
        userId: user?.id,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        requestId: body.requestId,
        model,
        taskText: latestUserMessage?.content,
        intent: result.intent,
        needsClarification: result.needsClarification,
        hasImages: Boolean(latestUserMessage?.images?.length),
      });
    }
    const credit = user ? await chargeCredits(user.id, "text", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ? `${body.requestId}:plan` : undefined, label: "Agent 规划", model }) : undefined;

    return NextResponse.json({ ...withChargedUsage(result, credit), credit });
  } catch (error) {
    const uploadSummary = summarizeMessageUploads(body?.messages);
    if (uploadSummary.imageCount > 0 || uploadSummary.documentCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "agent-plan",
        mode: body?.mode ?? "agent",
        model: body?.model ?? DEFAULT_CHAT_MODEL,
        requestId: body?.requestId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        ...uploadSummary,
      });
    }
    const codedError = await createCodedApiError(error, "Agent 规划失败，请稍后再试。", `agent-plan request failed mode=${body?.mode ?? "agent"} model=${body?.model ?? DEFAULT_CHAT_MODEL} requestId=${body?.requestId ?? ""}`);
    return NextResponse.json(codedError, { status: 500 });
  }
}
