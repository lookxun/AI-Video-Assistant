export function normalizeAdminMediaUrl(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/generated/")) return parsed.pathname;
    return url;
  } catch {
    // Relative URLs are handled below.
  }
  return url.split("?")[0].split("#")[0];
}

export function getAdminMediaSourceUrl(url: string) {
  const normalized = normalizeAdminMediaUrl(url);
  if (!/^https?:\/\//i.test(normalized)) return normalized;
  return `/admin/api/media-url?variant=original&url=${encodeURIComponent(url)}`;
}

export function getAdminMediaThumbnailUrl(url: string) {
  const normalized = normalizeAdminMediaUrl(url);
  if (/^https?:\/\//i.test(normalized)) return `/admin/api/media-url?variant=thumb&url=${encodeURIComponent(url)}`;
  if (!normalized.startsWith("/generated/")) return normalized;
  return `/api/media-thumbnail?url=${encodeURIComponent(normalized)}`;
}

export function fallbackAdminImageToOriginal(image: HTMLImageElement, originalUrl: string) {
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = normalizeAdminMediaUrl(originalUrl);
}
