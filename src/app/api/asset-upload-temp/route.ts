import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { commitTemporaryUploadedImage, deleteTemporaryUploadedImage, saveTemporaryUploadedImageBuffer } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";
import { getBearerToken, verifyUploadToken } from "@/lib/upload-token";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";

const allowedUploadOrigins = new Set([
  "http://101.37.129.164",
  "http://101.47.19.109",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.UPLOAD_CORS_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowOrigin = allowedUploadOrigins.has(origin) ? origin : "";
  const headers: Record<string, string> = allowOrigin ? {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  } : {};
  return headers;
}

async function getUploadUserId(request: Request) {
  const tokenUser = verifyUploadToken(getBearerToken(request.headers.get("authorization")));
  if (tokenUser?.userId) return tokenUser.userId;
  const user = await getCurrentUser();
  return user?.id;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let userId: string | undefined;
  let fileName: string | undefined;
  let mimeType: string | undefined;
  let fileSize: number | undefined;
  let forceReencode = false;
  try {
    userId = await getUploadUserId(request);
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-start", requestId, userId, extra: { origin: request.headers.get("origin"), contentLength: request.headers.get("content-length"), contentType: request.headers.get("content-type"), userAgent: request.headers.get("user-agent") } });
    if (!userId) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-unauthorized", requestId, status: 401, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
    }
    const formData = await request.formData();
    const file = formData.get("image");
    forceReencode = formData.get("forceReencode") === "1";
    if (!(file instanceof File)) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-missing-file", requestId, userId, forceReencode, status: 400, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "缺少图片" }, { status: 400, headers });
    }
    fileName = file.name;
    mimeType = file.type || "image/jpeg";
    fileSize = file.size;
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-file-received", requestId, userId, fileName, mimeType, fileSize, forceReencode, durationMs: Date.now() - startedAt });
    const result = await saveTemporaryUploadedImageBuffer(Buffer.from(await file.arrayBuffer()), mimeType, { userId, forceReencode, diagnostics: { requestId, fileName, fileSize } });
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-success", requestId, userId, fileName, mimeType, fileSize, forceReencode, token: result.token, status: 200, durationMs: Date.now() - startedAt });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const message = toUserErrorMessage(error, "图片上传失败，请稍后再试。");
    console.error("[upload] asset-upload-temp post failed", { requestId, userId, fileName, mimeType, fileSize, forceReencode, error });
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-failed", requestId, userId, fileName, mimeType, fileSize, forceReencode, status: 500, durationMs: Date.now() - startedAt, error, extra: { userMessage: message } });
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}

export async function PATCH(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let userId: string | undefined;
  let token: string | undefined;
  try {
    userId = await getUploadUserId(request);
    if (!userId) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-unauthorized", requestId, status: 401, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
    }
    const body = (await request.json()) as { token?: string };
    token = body.token;
    if (!token) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-missing-token", requestId, userId, status: 400, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "缺少上传文件" }, { status: 400, headers });
    }
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-start", requestId, userId, token });
    const url = await commitTemporaryUploadedImage(token, { userId, diagnostics: { requestId } });
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-success", requestId, userId, token, status: 200, durationMs: Date.now() - startedAt, extra: { url } });
    return NextResponse.json({ url }, { headers });
  } catch (error) {
    const message = toUserErrorMessage(error, "图片保存失败，请稍后再试。");
    console.error("[upload] asset-upload-temp patch failed", { requestId, userId, token, error });
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-failed", requestId, userId, token, status: 500, durationMs: Date.now() - startedAt, error, extra: { userMessage: message } });
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}

export async function DELETE(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({ ok: true }, { headers });
    const body = (await request.json().catch(() => ({}))) as { tokens?: string[] };
    await Promise.all((body.tokens ?? []).map((token) => deleteTemporaryUploadedImage(token, { userId })));
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-delete-success", requestId, userId, status: 200, durationMs: Date.now() - startedAt, extra: { tokenCount: body.tokens?.length ?? 0 } });
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-delete-failed-ignored", requestId, status: 200, durationMs: Date.now() - startedAt });
    return NextResponse.json({ ok: true }, { headers });
  }
}
