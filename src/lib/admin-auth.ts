import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth";

export const adminCookieName = "flashmuse-admin-session";
const adminSessionMaxAgeSeconds = 60 * 60 * 8;
const authSecret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";

function signAdminPayload(payload: string) {
  return createHmac("sha256", `${authSecret}:admin-session`).update(payload).digest("base64url");
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function createAdminSession(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = Date.now() + adminSessionMaxAgeSeconds * 1000;
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail, expiresAt })).toString("base64url");
  const token = `${payload}.${signAdminPayload(payload)}`;
  const cookieStore = await cookies();

  cookieStore.set(adminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: adminSessionMaxAgeSeconds,
  });
}

export async function getCurrentAdminEmail() {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminCookieName)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqualText(signature, signAdminPayload(payload))) {
    cookieStore.delete(adminCookieName);
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown; expiresAt?: unknown };
    const email = normalizeEmail(parsed.email);
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;

    if (!email || expiresAt <= Date.now() || !isAdminEmail(email)) {
      cookieStore.delete(adminCookieName);
      return null;
    }

    return email;
  } catch {
    cookieStore.delete(adminCookieName);
    return null;
  }
}

export async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0,
  });
}
