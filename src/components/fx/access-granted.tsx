"use client";

import { useEffect, useState } from "react";
import { ClassnetEmblem } from "@/components/brand/classnet-emblem";
import { DecryptText } from "./decrypt-text";

const SEEN_KEY = "classnet-access-granted";
const VISIBLE_MS = 2500;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the intro may replay, which is harmless.
  }
}

/** Full-screen "access granted" intro, played once per browser session. Never blocks input. */
export function AccessGranted() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || alreadySeen()) return;
    // Marked seen only once it actually shows, so a cancelled effect run cannot swallow it.
    const show = setTimeout(() => {
      markSeen();
      setVisible(true);
    }, 0);
    const hide = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="access-granted" aria-hidden="true">
      <ClassnetEmblem className="access-granted-emblem" />
      <p className="hud-label">Identity verified · Channel encrypted</p>
      <p className="access-granted-title">
        <DecryptText text="ACCESS GRANTED" duration={1100} />
      </p>
      <div className="access-granted-bar">
        <span />
      </div>
      <p className="hud-label">Clearance: classmate · Eyes only</p>
    </div>
  );
}
