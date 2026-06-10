import { getCurrentSession, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeInstanceId(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const instanceId = normalizeInstanceId((body as { instanceId?: unknown }).instanceId);
  const claim = (body as { claim?: unknown }).claim === true;

  if (!instanceId) return jsonError("页面实例无效", 400);

  const session = await getCurrentSession();
  if (!session) return Response.json({ active: false }, { status: 401 });

  if (claim) {
    await prisma.session.update({
      where: { id: session.id },
      data: { activeWorkspaceInstanceId: instanceId, activeWorkspaceSeenAt: new Date(), lastSeenAt: new Date() },
    });
    return Response.json({ active: true });
  }

  const active = session.activeWorkspaceInstanceId === instanceId;
  if (active) {
    await prisma.session.update({ where: { id: session.id }, data: { activeWorkspaceSeenAt: new Date(), lastSeenAt: new Date() } }).catch(() => null);
  }

  return Response.json({ active });
}
