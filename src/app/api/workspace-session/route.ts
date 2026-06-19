import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WORKSPACE_MESSAGE_LIMIT, getWorkspaceSessionMessages, workspaceSessionRowToPayload } from "@/lib/workspace-sessions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const params = new URL(request.url).searchParams;
  const sessionId = params.get("id")?.trim() ?? "";
  if (!sessionId) return jsonError("会话ID无效");
  const before = Number(params.get("before") ?? Number.NaN);
  const historyOnly = params.get("historyOnly") === "1";

  const storedSession = await prisma.workspaceSession.findFirst({
    where: { userId: user.id, sessionId, deletedAt: null },
    select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
  });
  if (storedSession) {
    const messagePage = await getWorkspaceSessionMessages(user.id, sessionId, Number.isFinite(before) ? before : undefined, DEFAULT_WORKSPACE_MESSAGE_LIMIT);
    if (historyOnly) return Response.json({ messages: messagePage.messages, messagesHasMore: messagePage.hasMore, messagesBeforeCursor: messagePage.nextBefore });
    return Response.json({ session: workspaceSessionRowToPayload(storedSession, true, messagePage.messages, messagePage) });
  }
  return Response.json({ session: null });
}
