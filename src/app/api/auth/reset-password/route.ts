import { getCurrentUser, hashPassword, hashVerificationCode, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^\d{6}$/.test(code)) return jsonError("请输入6位验证码");
  if (password.length < 8) return jsonError("密码至少需要8位");

  const record = await prisma.emailVerificationCode.findFirst({
    where: { email: user.email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return jsonError("验证码已过期，请重新获取");

  if (record.attempts >= 5) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return jsonError("验证码错误次数过多，请重新获取");
  }

  if (record.codeHash !== hashVerificationCode(user.email, code)) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return jsonError("验证码不正确");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
  ]);

  return Response.json({ ok: true });
}
