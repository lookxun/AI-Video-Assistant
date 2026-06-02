import { isValidEmail, jsonError, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    return jsonError("请输入完整邮箱");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, disabled: true },
  });

  if (user?.disabled) {
    return jsonError("用户名错误！请联系管理员！");
  }

  return Response.json({
    exists: Boolean(user),
    hasPassword: Boolean(user?.passwordHash),
  });
}
