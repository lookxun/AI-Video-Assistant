"use client";

import { useCallback, useState } from "react";
import { Tldraw, type Editor } from "tldraw";

export function TldrawTestInner() {
  const [mounted, setMounted] = useState(false);
  const [shapeCount, setShapeCount] = useState(0);
  const [camera, setCamera] = useState("-");

  const handleMount = useCallback((editor: Editor) => {
    setMounted(true);
    setShapeCount(editor.getCurrentPageShapes().length);
    const update = () => {
      const nextCamera = editor.getCamera();
      setCamera(`${Math.round(nextCamera.x)}, ${Math.round(nextCamera.y)}, ${Math.round(nextCamera.z * 100)}%`);
      setShapeCount(editor.getCurrentPageShapes().length);
    };
    update();
    const unlisten = editor.store.listen(update);
    return () => unlisten();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f3f3f3]">
      <Tldraw onMount={handleMount} />
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-[#e5e5e5] bg-white/90 px-4 py-3 text-left text-xs leading-5 text-[#333333] shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="font-semibold text-[#111111]">tldraw 独立测试页</div>
        <div>mounted: {mounted ? "yes" : "no"}</div>
        <div>shapes: {shapeCount}</div>
        <div>camera: {camera}</div>
      </div>
    </div>
  );
}
