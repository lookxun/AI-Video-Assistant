import { canEmailDomainReceiveMail, hashVerificationCode, isValidEmail, jsonError, normalizeEmail } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { isSmtpConfigured, sendLoginCodeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) return jsonError("请输入完整邮箱");
  if (!isAdminEmail(email)) return jsonError("该邮箱不在后台管理员白名单中", 403);
  if (!(await canEmailDomainReceiveMail(email))) return jsonError("邮箱或域名不存在，请检查后重新输入");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailVerificationCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.emailVerificationCode.create({ data: { email, codeHash: hashVerificationCode(email, code), expiresAt } });

  if (isSmtpConfigured()) {
    try {
      await sendLoginCodeEmail(email, code);
    } catch (error) {
      console.error("[admin-auth] 验证码邮件发送失败：", error);
      return jsonError("验证码邮件发送失败，请稍后重试", 500);
    }
  } else {
    console.log(`[admin-auth] ${email} 的后台登录验证码：${code}，10 分钟内有效`);
  }

  return Response.json({ ok: true });
}
