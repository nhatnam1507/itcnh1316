"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

const utcTime = () => new Date().toISOString().slice(11, 19);
const placeholder = () => "--:--:--";

/** Live UTC clock for the console header; the server renders a placeholder. */
export function MissionClock() {
  const time = useSyncExternalStore(subscribe, utcTime, placeholder);
  return <span className="mission-clock">{time} UTC</span>;
}
