import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";

export const runtime = "nodejs";

const legacyMediaUrlReplacements = new Map([
  ["/generated/videos/1780454968504-21fb484e-7894-45cb-b730-63c475ee71f2.mp4", "/generated/videos/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.mp4"],
]);

function replaceLegacyMediaUrls(value: unknown): unknown {
  if (typeof value === "string") return legacyMediaUrlReplacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map(replaceLegacyMediaUrls);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [legacyMediaUrlReplacements.get(key) ?? key, replaceLegacyMediaUrls(item)]));
  return value;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const workspace = await prisma.userWorkspaceState.findUnique({
    where: { userId: user.id },
  });

  if (workspace?.state) {
    await migrateLegacyUserProfileFromWorkspace(user.id, workspace.state);
    const cleanState = replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(workspace.state));
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
  const cleanBody = replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(body));

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: cleanBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: cleanBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
