import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = (await request.json().catch(() => null)) as { conversationId?: string; title?: string } | null;
  const conversationId = body?.conversationId?.trim();
  const title = body?.title?.trim();

  if (!conversationId || !title) return jsonError("参数不完整", 400);

  await prisma.creditLedger.updateMany({
    where: { userId: user.id, conversationId },
    data: { conversationTitle: title },
  });

  return Response.json({ ok: true });
}
