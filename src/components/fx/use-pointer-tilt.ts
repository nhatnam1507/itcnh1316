"use client";

import { useEffect, useRef } from "react";

/**
 * Tilts the element toward the pointer in 3D and tracks the pointer for a sheen, through
 * the CSS variables --rx, --ry, --mx and --my (see `.tilt` in globals.css). Mouse and pen
 * only; touch screens and reduced motion keep the element flat.
 */
export function usePointerTilt<T extends HTMLElement>(maxDegrees = 6) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const flat = window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)").matches;
    if (flat) return;

    let frame = 0;
    const set = (rx: number, ry: number, mx: number, my: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--rx", `${rx}deg`);
        element.style.setProperty("--ry", `${ry}deg`);
        element.style.setProperty("--mx", `${mx}%`);
        element.style.setProperty("--my", `${my}%`);
      });
    };
    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      set((0.5 - y) * maxDegrees, (x - 0.5) * maxDegrees, x * 100, y * 100);
    };
    const onLeave = () => set(0, 0, 50, 0);

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [maxDegrees]);

  return ref;
}
