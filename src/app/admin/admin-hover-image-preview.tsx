"use client";

import { useState, type ReactNode } from "react";
import { getAdminMediaSourceUrl } from "./admin-media-url";

type PreviewPosition = {
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
};

function getPreviewPosition(clientX: number, clientY: number): PreviewPosition {
  const margin = 16;
  const gap = 14;
  const maxWidth = Math.max(180, Math.min(720, window.innerWidth - margin * 2));
  const maxHeight = Math.max(180, Math.min(760, window.innerHeight - margin * 2));
  const left = clientX + gap + maxWidth > window.innerWidth - margin ? Math.max(margin, clientX - gap - maxWidth) : Math.min(window.innerWidth - margin - maxWidth, clientX + gap);
  const top = clientY + gap + maxHeight > window.innerHeight - margin ? Math.max(margin, clientY - gap - maxHeight) : Math.min(window.innerHeight - margin - maxHeight, clientY + gap);

  return { left, top, maxWidth, maxHeight };
}

export function AdminHoverImagePreview({ src, alt, wrapperClassName, children }: { src: string; alt: string; wrapperClassName?: string; children: ReactNode }) {
  const [position, setPosition] = useState<PreviewPosition | null>(null);
  const previewSrc = getAdminMediaSourceUrl(src);

  return (
    <span
      className={wrapperClassName ?? "inline-block"}
      onMouseEnter={(event) => setPosition(getPreviewPosition(event.clientX, event.clientY))}
      onMouseMove={(event) => setPosition(getPreviewPosition(event.clientX, event.clientY))}
      onMouseLeave={() => setPosition(null)}
    >
      {children}
      {position ? (
        <span className="pointer-events-none fixed z-[9999] flex items-center justify-center rounded-[10px] border border-white/70 bg-white p-1 shadow-[0_18px_60px_rgba(0,0,0,0.32)]" style={{ left: position.left, top: position.top, maxWidth: position.maxWidth, maxHeight: position.maxHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt={alt} className="block max-h-[calc(100vh-40px)] max-w-[calc(100vw-40px)] object-contain" style={{ maxWidth: position.maxWidth - 8, maxHeight: position.maxHeight - 8 }} />
        </span>
      ) : null}
    </span>
  );
}
