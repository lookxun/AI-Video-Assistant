"use client";

import { useEffect } from "react";

let bodyScrollLockCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverscrollBehavior = "";

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    if (bodyScrollLockCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
    }

    bodyScrollLockCount += 1;

    return () => {
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior;
      }
    };
  }, [locked]);
}
