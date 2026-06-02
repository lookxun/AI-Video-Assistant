"use client";

import { useEffect } from "react";

const SCROLLBAR_ACTIVE_CLASS = "yinzao-scrollbar-active";
const SCROLLBAR_FADE_DELAY_MS = 2000;

export function GlobalScrollbarController() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const activeElements = new Set<Element>();

    const setActive = (element: Element) => {
      element.classList.add(SCROLLBAR_ACTIVE_CLASS);
      activeElements.add(element);

      const previousTimer = timers.get(element);
      if (previousTimer) window.clearTimeout(previousTimer);

      const nextTimer = window.setTimeout(() => {
        element.classList.remove(SCROLLBAR_ACTIVE_CLASS);
        activeElements.delete(element);
      }, SCROLLBAR_FADE_DELAY_MS);

      timers.set(element, nextTimer);
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      const element = target instanceof Element ? target : document.documentElement;
      setActive(element);
    };

    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      activeElements.forEach((element) => element.classList.remove(SCROLLBAR_ACTIVE_CLASS));
    };
  }, []);

  return null;
}
