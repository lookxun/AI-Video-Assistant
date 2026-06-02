import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserProfileFromUser, normalizeUserProfileInput, type UserProfilePayload } from "@/lib/user-profile";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  return Response.json({ user: getUserProfileFromUser(user) });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null) as UserProfilePayload | null;
  if (!body || typeof body !== "object") return jsonError("用户资料无效");

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: normalizeUserProfileInput(body),
  });

  return Response.json({ user: getUserProfileFromUser(updatedUser) });
}
