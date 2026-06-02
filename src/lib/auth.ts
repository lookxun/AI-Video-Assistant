import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { resolve4, resolve6, resolveMx } from "dns/promises";
import { promisify } from "util";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);

export const authCookieName = "flashmuse-session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const authSecret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";

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

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    cookieStore.delete(authCookieName);
    return null;
  }

  if (session.user.disabled) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } }).catch(() => null);
    cookieStore.delete(authCookieName);
    return null;
  }

  await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => null);
  return session.user;
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;

  if (token) {
    await prisma.session.delete({ where: { tokenHash: hashSessionToken(token) } }).catch(() => null);
  }

  cookieStore.delete(authCookieName);
}
