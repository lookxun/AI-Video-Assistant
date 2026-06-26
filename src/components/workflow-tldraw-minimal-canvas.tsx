"use client";

import { useCallback, useState } from "react";
import { Tldraw, type Editor } from "tldraw";

export function WorkflowTldrawMinimalCanvas() {
  const [mounted, setMounted] = useState(false);
  const [shapeCount, setShapeCount] = useState(0);

  const handleMount = useCallback((editor: Editor) => {
    setMounted(true);
    setShapeCount(editor.getCurrentPageShapes().length);
  }, []);

  return (
    <div className="relative h-full min-h-full w-full overflow-hidden bg-[#f3f3f3]">
      <Tldraw onMount={handleMount} />
      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-xl border border-[#e5e5e5] bg-white/90 px-4 py-3 text-left text-xs leading-5 text-[#333333] shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="font-semibold text-[#111111]">工作流 tldraw 最小接入测试</div>
        <div>mounted: {mounted ? "yes" : "no"}</div>
        <div>shapes: {shapeCount}</div>
        <div>不接节点 / 不接生成 / 不接 autosave</div>
      </div>
    </div>
  );
}
