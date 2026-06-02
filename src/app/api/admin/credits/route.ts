import { NextResponse } from "next/server";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { isAdminEmail } from "@/lib/admin";
import { getCreditSettings, updateCreditSettings } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ settings: await getCreditSettings() });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const settings = await updateCreditSettings({
    usdToCnyRate: Number(body.usdToCnyRate),
    creditsPerCny: Number(body.creditsPerCny),
    signupCredits: Number(body.signupCredits),
    chargeText: Boolean(body.chargeText),
    chargeImage: Boolean(body.chargeImage),
    chargeVideo: Boolean(body.chargeVideo),
    chargePromptTool: Boolean(body.chargePromptTool),
  });

  return NextResponse.json({ settings });
}
