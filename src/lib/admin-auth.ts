import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth";

export const adminCookieName = "flashmuse-admin-session";
const adminSessionMaxAgeSeconds = 60 * 60 * 8;
const authSecret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";
const forceInsecureAuthCookie = process.env.FORCE_INSECURE_AUTH_COOKIE === "true";
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

function signAdminPayload(payload: string) {
  return createHmac("sha256", `${authSecret}:admin-session`).update(payload).digest("base64url");
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookieHeaderValues(rawCookieHeader: string, name: string) {
  return rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1))
    .filter((value) => value.length > 0);
}

function getAdminCookieCandidates(cookieStore: Awaited<ReturnType<typeof cookies>>, rawCookieHeader: string) {
  const values = cookieStore
    .getAll(adminCookieName)
    .map((cookie) => cookie.value)
    .filter((value) => value.length > 0);

  return Array.from(new Set([...values, ...getCookieHeaderValues(rawCookieHeader, adminCookieName)]));
}

function setAdminCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, token: string, maxAge: number) {
  if (authCookieDomain) {
    cookieStore.set(adminCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
      path: "/admin",
      maxAge: 0,
    });
  }

  cookieStore.set(adminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/admin",
    maxAge,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}

function readValidAdminEmail(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqualText(signature, signAdminPayload(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown; expiresAt?: unknown };
    const email = normalizeEmail(parsed.email);
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;

    if (!email || expiresAt <= Date.now() || !isAdminEmail(email)) return null;
    return email;
  } catch {
    return null;
  }
}

export async function createAdminSession(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = Date.now() + adminSessionMaxAgeSeconds * 1000;
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail, expiresAt })).toString("base64url");
  const token = `${payload}.${signAdminPayload(payload)}`;
  const cookieStore = await cookies();

  setAdminCookie(cookieStore, token, adminSessionMaxAgeSeconds);
}

export async function getCurrentAdminEmail() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAdminCookieCandidates(cookieStore, rawCookieHeader);
  if (tokens.length === 0) return null;

  for (const token of tokens) {
    const email = readValidAdminEmail(token);
    if (email) return email;
  }

  return null;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/admin",
    maxAge: 0,
  });

  cookieStore.set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/admin",
    maxAge: 0,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}
