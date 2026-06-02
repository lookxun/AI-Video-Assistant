import { getCurrentUser, hashPassword, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (user.passwordHash) return jsonError("该账号已设置密码，请使用修改密码");
  if (password.length < 8) return jsonError("密码至少需要8位");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  return Response.json({ ok: true });
}
