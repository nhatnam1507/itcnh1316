import type { CSSProperties } from "react";
import type { RadarBlip } from "@/features/people/telemetry";

const SWEEP_SECONDS = 4;
const CENTER = 100;
const REACH = 88;
const TICKS = Array.from({ length: 36 }, (_, index) => index * 10);

/** Node and the browser can differ in the last digits of sin/cos; rounding keeps hydration in sync. */
const round = (value: number) => Math.round(value * 1000) / 1000;

function polar(angle: number, distance: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return { x: round(CENTER + Math.sin(radians) * distance), y: round(CENTER - Math.cos(radians) * distance) };
}

/**
 * Radar of the class: each blip is a pinned classmate at their real bearing from the class
 * centroid. A blip flares exactly as the sweep passes over it.
 */
export function HudRadar({ blips, activeId }: { blips: RadarBlip[]; activeId?: string | null }) {
  return (
    <svg className="hud-radar" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="hud-radar-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {[30, 59, REACH].map((radius) => (
        <circle key={radius} className="hud-radar-ring" cx={CENTER} cy={CENTER} r={radius} />
      ))}
      <path className="hud-radar-cross" d={`M${CENTER} 8V192M8 ${CENTER}H192`} />
      {TICKS.map((angle) => {
        const outer = polar(angle, 96);
        const inner = polar(angle, angle % 90 === 0 ? 88 : 92);
        return <line key={angle} className="hud-radar-tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
      })}
      <g className="hud-radar-sweep" style={{ "--sweep": `${SWEEP_SECONDS}s` } as CSSProperties}>
        {/* A 50° wedge trailing the leading edge, which points north at the start. */}
        <path d={`M${CENTER} ${CENTER}L${polar(-50, REACH).x} ${polar(-50, REACH).y}A${REACH} ${REACH} 0 0 1 ${CENTER} ${CENTER - REACH}Z`} fill="url(#hud-radar-sweep)" />
        <line className="hud-radar-edge" x1={CENTER} y1={CENTER} x2={CENTER} y2={CENTER - REACH} />
      </g>
      {blips.map((blip) => {
        const { x, y } = polar(blip.angle, blip.distance * REACH);
        return (
          <circle
            key={blip.id}
            className="hud-radar-blip"
            data-active={blip.id === activeId ? "true" : undefined}
            cx={x}
            cy={y}
            r={blip.id === activeId ? 4.5 : 3}
            style={{ animationDelay: `${(blip.angle / 360) * SWEEP_SECONDS - SWEEP_SECONDS}s` }}
          />
        );
      })}
      <circle className="hud-radar-core" cx={CENTER} cy={CENTER} r="2.5" />
    </svg>
  );
}
