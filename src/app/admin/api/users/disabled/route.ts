import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const disabled = Boolean(body.disabled);

  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

  const user = await prisma.user.update({ where: { id: userId }, data: { disabled }, select: { id: true, disabled: true } }).catch(() => null);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  if (disabled) {
    await prisma.session.deleteMany({ where: { userId } }).catch(() => null);
  }

  return NextResponse.json({ user });
}
