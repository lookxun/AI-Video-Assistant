import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const workspace = await prisma.userWorkspaceState.findUnique({
    where: { userId: user.id },
  });

  if (workspace?.state) {
    await migrateLegacyUserProfileFromWorkspace(user.id, workspace.state);
    const cleanState = stripUserProfileFromWorkspaceState(workspace.state);
    if (cleanState !== workspace.state) {
      await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: cleanState as Prisma.InputJsonValue } });
    }
    return Response.json({ state: cleanState });
  }

  return Response.json({ state: null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("工作区数据无效");

  await migrateLegacyUserProfileFromWorkspace(user.id, body);
  const cleanBody = stripUserProfileFromWorkspaceState(body);

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: cleanBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: cleanBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
