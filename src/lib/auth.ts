import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { resolve4, resolve6, resolveMx } from "dns/promises";
import { promisify } from "util";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);

export const authCookieName = "flashmuse-session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const authSecret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";
const forceInsecureAuthCookie = process.env.FORCE_INSECURE_AUTH_COOKIE === "true";
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function generateUserId() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `ID_${randomInt(100000, 1000000)}`;
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return id;
  }

  throw new Error("无法生成唯一用户ID");
}

export async function canEmailDomainReceiveMail(email: string) {
  const domain = email.split("@")[1];
  if (!domain) return false;

  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    try {
      const addresses = await resolve4(domain);
      if (addresses.length > 0) return true;
    } catch {
      // Ignore and try IPv6 below.
    }

    try {
      const addresses = await resolve6(domain);
      return addresses.length > 0;
    } catch {
      return false;
    }
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function hashVerificationCode(email: string, code: string) {
  return createHash("sha256").update(`${authSecret}:email-code:${email}:${code}`).digest("hex");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(`${authSecret}:session:${token}`).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });
  });

  const cookieStore = await cookies();
  setAuthCookie(cookieStore, token, sessionMaxAgeSeconds);
}

function getCookieHeaderValues(rawCookieHeader: string, name: string) {
  return rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1))
    .filter((value) => value.length > 0);
}

function getAuthCookieCandidates(cookieStore: Awaited<ReturnType<typeof cookies>>, rawCookieHeader: string) {
  const values = cookieStore
    .getAll(authCookieName)
    .map((cookie) => cookie.value)
    .filter((value) => value.length > 0);

  return Array.from(new Set([...values, ...getCookieHeaderValues(rawCookieHeader, authCookieName)]));
}

function setAuthCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, token: string, maxAge: number) {
  if (authCookieDomain) {
    cookieStore.set(authCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
      path: "/",
      maxAge: 0,
    });
  }

  cookieStore.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/",
    maxAge,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}

async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/",
    maxAge: 0,
  });

  cookieStore.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/",
    maxAge: 0,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAuthCookieCandidates(cookieStore, rawCookieHeader);
  if (tokens.length === 0) return null;

  const tokenByHash = new Map(tokens.map((token) => [hashSessionToken(token), token]));
  const sessions = await prisma.session.findMany({
    where: { tokenHash: { in: Array.from(tokenByHash.keys()) } },
    include: { user: true },
  });
  const now = new Date();
  const session = sessions.find((item) => item.expiresAt > now && !item.user.disabled) ?? null;

  const expiredSessionIds = sessions.filter((item) => item.expiresAt <= now).map((item) => item.id);
  if (expiredSessionIds.length > 0) {
    await prisma.session.deleteMany({ where: { id: { in: expiredSessionIds } } }).catch(() => null);
  }

  if (!session) {
    await clearAuthCookie();
    return null;
  }

  await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => null);
  const token = tokenByHash.get(session.tokenHash);
  if (authCookieDomain && token) setAuthCookie(cookieStore, token, sessionMaxAgeSeconds);
  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAuthCookieCandidates(cookieStore, rawCookieHeader);

  if (tokens.length > 0) {
    await prisma.session.deleteMany({ where: { tokenHash: { in: tokens.map(hashSessionToken) } } }).catch(() => null);
  }

  await clearAuthCookie();
}
