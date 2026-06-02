import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getAdminSystemSettings, updateAdminSystemSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ settings: getAdminSystemSettings() });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const openRouterApiKey = typeof body.openRouterApiKey === "string" ? body.openRouterApiKey.trim() : "";
  const openRouterApiKeyEnabled = Boolean(body.openRouterApiKeyEnabled);
  const bytePlusApiKey = typeof body.bytePlusApiKey === "string" ? body.bytePlusApiKey.trim() : "";
  const bytePlusApiKeyEnabled = Boolean(body.bytePlusApiKeyEnabled);
  const bytePlusUnlockLimits = Boolean(body.bytePlusUnlockLimits);
  const bytePlusRegion = body.bytePlusRegion === "eu-west-1" ? "eu-west-1" : "ap-southeast-1";
  const modelProviderPreferences = body.modelProviderPreferences && typeof body.modelProviderPreferences === "object" && !Array.isArray(body.modelProviderPreferences) ? body.modelProviderPreferences as Record<string, "openrouter" | "byteplus"> : {};
  const bytePlusModelSelections = body.bytePlusModelSelections && typeof body.bytePlusModelSelections === "object" && !Array.isArray(body.bytePlusModelSelections) ? body.bytePlusModelSelections as Record<string, string> : {};
  if (openRouterApiKeyEnabled && !openRouterApiKey) return NextResponse.json({ error: "请输入 OpenRouter API Key" }, { status: 400 });
  if (bytePlusApiKeyEnabled && !bytePlusApiKey) return NextResponse.json({ error: "请输入 BytePlus API Key" }, { status: 400 });

  const settings = await updateAdminSystemSettings({ openRouterApiKey, openRouterApiKeyEnabled, bytePlusApiKey, bytePlusApiKeyEnabled, bytePlusUnlockLimits, bytePlusRegion, modelProviderPreferences, bytePlusModelSelections });
  return NextResponse.json({ settings });
}
