import { NextResponse } from "next/server";
import { saveUserAvatarAsset } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { image?: string };
    const image = body.image?.trim();

    if (!image) return NextResponse.json({ error: "缺少图片" }, { status: 400 });

    const url = await saveUserAvatarAsset(image);
    return NextResponse.json({ url });
  } catch (error) {
    const message = toUserErrorMessage(error, "头像上传失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
