import { NextResponse } from "next/server";
import { toUserErrorMessage } from "@/lib/error-message";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "缺少资源地址" }, { status: 400 });
    }

    // FlashMuse uses soft delete only. User deletion hides assets from the client,
    // but generated files must remain available for admin audit and recovery.
    return NextResponse.json({ success: true, deleted: false, url });
  } catch (error) {
    const message = toUserErrorMessage(error, "删除失败。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
