import { createAdminSession } from "@/lib/admin-auth";
import { isAdminEmail } from "@/lib/admin";
import { isValidEmail, jsonError, normalizeEmail, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!isValidEmail(email)) return jsonError("请输入完整邮箱");
  if (!isAdminEmail(email)) return jsonError("该邮箱不在后台管理员白名单中", 403);
  if (!password) return jsonError("请输入密码");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return jsonError("该邮箱还没有设置密码，请使用验证码登录");
  if (!(await verifyPassword(password, user.passwordHash))) return jsonError("密码不正确");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createAdminSession(email);

  return Response.json({ ok: true });
}
