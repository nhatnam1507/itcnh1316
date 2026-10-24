"use client";

import { useEffect, useRef } from "react";

/**
 * Full-screen 3D globe behind the unlock card. three.js and the land dots load as a
 * separate chunk after first paint; without WebGL the page simply shows no globe.
 */
export function HoloGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let dispose: (() => void) | undefined;

    Promise.all([import("./globe-scene"), import("./land-points.json")])
      .then(([{ mountGlobe }, land]) => {
        if (disposed) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        dispose = mountGlobe(container, land.default, { reducedMotion })?.dispose;
      })
      .catch(() => {
        // Decorative only: the unlock form works without the globe.
      });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  return <div ref={containerRef} className="holo-globe" aria-hidden="true" />;
}
