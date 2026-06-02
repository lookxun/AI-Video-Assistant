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
  const delta = Number(body.delta);
  const amount = Number.isFinite(delta) ? Math.trunc(delta) : 0;

  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
  if (amount === 0) return NextResponse.json({ error: "调整积分不能为0" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!user) return null;

    const adjustedCredits = amount > 0 ? amount : -Math.min(user.credits, Math.abs(amount));
    if (adjustedCredits === 0) return { balance: user.credits, adjustedCredits: 0 };

    const updated = await tx.user.update({ where: { id: userId }, data: { credits: user.credits + adjustedCredits }, select: { credits: true } });
    await tx.creditLedger.create({
      data: {
        userId,
        direction: "increase",
        kind: "admin_adjust",
        label: "后台调积分",
        credits: adjustedCredits,
        metadata: { adminEmail: email, delta: amount, appliedDelta: adjustedCredits },
      },
    });
    return { balance: updated.credits, adjustedCredits };
  });

  if (!result) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  return NextResponse.json(result);
}
