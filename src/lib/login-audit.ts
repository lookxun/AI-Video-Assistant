type IpWhoIsResponse = {
  success?: boolean;
  country?: string;
  region?: string;
  city?: string;
};

type IpApiResponse = {
  status?: string;
  country?: string;
  regionName?: string;
  city?: string;
};

function cleanHeaderIp(value: string) {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  if (!trimmed || trimmed.toLowerCase() === "unknown") return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) return trimmed.replace(/:\d+$/, "");
  return trimmed.replace(/^\[|\]$/g, "");
}

function isPrivateIp(ip: string) {
  if (!ip) return true;
  const lower = ip.toLowerCase();
  if (lower === "localhost" || lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;

  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function getClientIpFromHeaders(headers: Headers) {
  const candidates = [
    ...(headers.get("x-forwarded-for") ?? "").split(","),
    headers.get("x-real-ip") ?? "",
    headers.get("cf-connecting-ip") ?? "",
    headers.get("x-client-ip") ?? "",
    headers.get("fastly-client-ip") ?? "",
  ].map(cleanHeaderIp).filter(Boolean);

  return candidates.find((ip) => !isPrivateIp(ip)) ?? candidates[0] ?? "";
}

async function resolveIpLocation(ip: string) {
  if (!ip || isPrivateIp(ip)) return ip ? "内网 / 本地" : "未知";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?lang=zh-CN`, { signal: controller.signal, cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as IpWhoIsResponse;
    if (response.ok && data.success !== false) {
      const isChina = data.country?.trim() === "中国";
      const parts = (isChina ? [data.region, data.city] : [data.country, data.city]).map((part) => part?.trim()).filter(Boolean);
      if (parts.length > 0) return Array.from(new Set(parts)).join(" ");
    }
  } catch {
    // Try fallback below.
  } finally {
    clearTimeout(timer);
  }

  const fallbackController = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackController.abort(), 5000);
  try {
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,country,regionName,city`, { signal: fallbackController.signal, cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as IpApiResponse;
    if (response.ok && data.status === "success") {
      const isChina = data.country?.trim() === "中国";
      const parts = (isChina ? [data.regionName, data.city] : [data.country, data.city]).map((part) => part?.trim()).filter(Boolean);
      if (parts.length > 0) return Array.from(new Set(parts)).join(" ");
    }
  } catch {
    // Ignore lookup errors.
  } finally {
    clearTimeout(fallbackTimer);
  }

  return "未知";
}

export async function getLoginAuditData(request: Request) {
  const ip = getClientIpFromHeaders(request.headers).slice(0, 80);
  const userAgent = (request.headers.get("user-agent") ?? "").trim().slice(0, 500);

  return {
    lastLoginAt: new Date(),
    lastLoginIp: ip || null,
    lastLoginLocation: await resolveIpLocation(ip),
    lastLoginUserAgent: userAgent || null,
  };
}
