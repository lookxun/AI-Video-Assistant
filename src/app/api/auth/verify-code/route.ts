import { createUserSession, generateUserId, hashVerificationCode, isValidEmail, jsonError, normalizeEmail } from "@/lib/auth";
import { getCreditSettings, grantCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!isValidEmail(email)) {
    return jsonError("请输入完整邮箱");
  }

  if (!/^\d{6}$/.test(code)) {
    return jsonError("请输入6位验证码");
  }

  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return jsonError("验证码已过期，请重新获取");
  }

  if (record.attempts >= 5) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return jsonError("验证码错误次数过多，请重新获取");
  }

  if (record.codeHash !== hashVerificationCode(email, code)) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return jsonError("验证码不正确");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.disabled) {
    return jsonError("用户名错误！请联系管理员！");
  }

  const user = existingUser
    ? await prisma.user.update({ where: { id: existingUser.id }, data: { lastLoginAt: new Date() } })
    : await prisma.user.create({ data: { id: await generateUserId(), email, nickname: email, credits: 0, lastLoginAt: new Date() } });

  if (!existingUser) {
    const creditSettings = await getCreditSettings();
    await grantCredits(user.id, creditSettings.signupCredits, "signup", { requestId: `signup:${user.id}`, label: "注册送积分", metadata: { source: "signup" } });
  }

  await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  await createUserSession(user.id);

  return Response.json({ user: { email: user.email, hasPassword: Boolean(user.passwordHash) } });
}
