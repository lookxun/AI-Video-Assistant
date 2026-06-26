"use client";

import dynamic from "next/dynamic";

const MinimalTldraw = dynamic(
  () => import("./tldraw-test-inner").then((mod) => mod.TldrawTestInner),
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center text-sm text-[#777777]">正在加载 tldraw...</div>,
  },
);

export function TldrawTestClient() {
  return <MinimalTldraw />;
}
