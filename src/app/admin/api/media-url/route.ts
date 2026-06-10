import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";

type MediaSaveJob = {
  remoteUrl?: string;
  localUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
};

const JOBS_PATH = join(process.cwd(), ".runtime", "media-save-jobs.json");

function normalizeGeneratedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/generated/")) return parsed.pathname;
  } catch {
    if (url.startsWith("/generated/")) return url.split("?")[0].split("#")[0];
  }
  return undefined;
}

async function readMediaJobs() {
  try {
    const parsed = JSON.parse(await readFile(JOBS_PATH, "utf8")) as MediaSaveJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function redirectTo(url: string) {
  return new NextResponse(null, { status: 307, headers: { Location: url } });
}

export async function GET(request: Request) {
  const adminEmail = await getCurrentAdminEmail();
  if (!adminEmail || getAdminEmails().length === 0 || !isAdminEmail(adminEmail)) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const url = new URL(request.url).searchParams.get("url") ?? "";
  const variant = new URL(request.url).searchParams.get("variant") ?? "thumb";
  const generatedUrl = normalizeGeneratedUrl(url);
  if (generatedUrl) return redirectTo(generatedUrl);
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "无效媒体地址" }, { status: 400 });

  const jobs = await readMediaJobs();
  const normalizedRemoteUrl = url.split("#")[0];
  const job = jobs.find((item) => item.remoteUrl === url || item.remoteUrl?.split("#")[0] === normalizedRemoteUrl || item.remoteUrl?.split("?")[0] === url.split("?")[0]);
  const localUrl = variant === "original"
    ? normalizeGeneratedUrl(job?.localUrl ?? "") ?? normalizeGeneratedUrl(job?.posterUrl ?? "") ?? normalizeGeneratedUrl(job?.thumbnailUrl ?? "")
    : normalizeGeneratedUrl(job?.thumbnailUrl ?? "") ?? normalizeGeneratedUrl(job?.posterUrl ?? "") ?? normalizeGeneratedUrl(job?.localUrl ?? "");
  return redirectTo(localUrl || url);
}
