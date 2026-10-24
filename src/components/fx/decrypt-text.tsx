"use client";

import { useEffect, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$<>/";
const FRAME_MS = 45;

/**
 * Shows `text` resolving left to right out of random glyphs. Screen readers and tests
 * read the real text from a hidden copy; the animated copy is aria-hidden.
 */
export function DecryptText({ text, duration = 900 }: { text: string; duration?: number }) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      if (now - last >= FRAME_MS || progress === 1) {
        last = now;
        const resolved = Math.floor(progress * text.length);
        setShown(
          Array.from(text, (char, index) =>
            index < resolved || char === " " ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          ).join(""),
        );
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, duration]);

  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </>
  );
}
