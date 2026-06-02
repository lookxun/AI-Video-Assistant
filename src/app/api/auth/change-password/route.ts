import { getCurrentUser, hashPassword, jsonError, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  if (!user.passwordHash) return jsonError("该账号还没有设置密码");

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) return jsonError("请输入当前密码");
  if (newPassword.length < 8) return jsonError("新密码至少需要8位");

  const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValidPassword) return jsonError("当前密码不正确");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return Response.json({ ok: true });
}
