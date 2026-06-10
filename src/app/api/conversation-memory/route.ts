import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits } from "@/lib/credits";
import { createCodedApiError } from "@/lib/error-code";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { sendToOpenRouter } from "@/lib/openrouter";

export const runtime = "nodejs";

function cleanSummaryInput(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

export async function POST(request: Request) {
  let body: {
    model?: string;
    previousSummary?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    conversationId?: string;
    conversationTitle?: string;
    requestId?: string;
  } | undefined;

  try {
    body = (await request.json()) as typeof body;
    const model = body?.model || DEFAULT_CHAT_MODEL;
    if (!isModelName(model) || !Array.isArray(body?.messages)) return NextResponse.json({ error: "参数不完整" }, { status: 400 });

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "text");

    const historyText = body.messages
      .slice(-80)
      .map((message, index) => `${index + 1}. ${message.role === "assistant" ? "AI" : "用户"}：${cleanSummaryInput(message.content)}`)
      .join("\n");
    const previousSummary = cleanSummaryInput(body.previousSummary ?? "");
    const prompt = [
      "请更新当前历史对话的长期工作记忆摘要。摘要给后续模型使用，不是给用户看的回复。",
      "保留：用户长期偏好、当前任务目标、已确认设定、已生成的重要内容、用户纠正/否定过的点、未完成事项、重要资产引用、用户授权你自行决定的偏好。",
      "不要保留：寒暄、重复话、过期链接、base64、无关细节。",
      "摘要控制在 1500-3000 tokens 左右，使用中文短段和列表。",
      previousSummary ? `旧摘要：\n${previousSummary}` : "旧摘要：无",
      `新增对话：\n${historyText}`,
    ].join("\n\n");

    const result = await sendToOpenRouter({
      model,
      mode: "chat",
      messages: [{ role: "user", content: prompt }],
    });
    const credit = user ? await chargeCredits(user.id, "text", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ? `${body.requestId}:memory` : undefined, label: "长期记忆摘要", model }) : undefined;

    return NextResponse.json({ summary: result.content.trim(), usage: result.usage, credit });
  } catch (error) {
    const codedError = await createCodedApiError(error, "长期记忆摘要失败，请稍后再试。", `conversation-memory failed model=${body?.model ?? DEFAULT_CHAT_MODEL} requestId=${body?.requestId ?? ""}`);
    return NextResponse.json(codedError, { status: 500 });
  }
}
