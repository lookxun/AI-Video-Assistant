import { hashVerificationCode, isValidEmail, jsonError, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!isValidEmail(email)) return jsonError("请输入完整邮箱");
  if (!/^\d{6}$/.test(code)) return jsonError("请输入6位验证码");

  const record = await prisma.emailVerificationCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return jsonError("验证码已过期，请重新获取");

  if (record.attempts >= 5) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return jsonError("验证码错误次数过多，请重新获取");
  }

  if (record.codeHash !== hashVerificationCode(email, code)) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return jsonError("验证码不正确");
  }

  return Response.json({ ok: true });
}
