import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBytePlusAsset, getBytePlusAsset } from "@/lib/byteplus-assets";

export const runtime = "nodejs";

function toPublicAssetUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/generated/")) {
    const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "https://main.venusface.com").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as { url?: unknown; name?: unknown };
    const url = toPublicAssetUrl(body.url);
    if (!url) return NextResponse.json({ error: "素材地址无效" }, { status: 400 });

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const result = await createBytePlusAsset({ url, name, assetType: "Image", moderationStrategy: "Skip" });

    return NextResponse.json({ id: result.id, groupId: result.groupId, status: "Processing" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交素材审核失败";
    console.error("[byteplus-assets] create failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });

    const asset = await getBytePlusAsset(id);
    return NextResponse.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询素材状态失败";
    console.error("[byteplus-assets] get failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
