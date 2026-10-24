import type { CSSProperties } from "react";

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Circular HUD gauge. The readout and label are real text; the rings are decoration. */
export function RingGauge({
  value,
  max,
  readout,
  label,
  caption,
}: {
  value: number;
  max: number;
  readout: string;
  label: string;
  caption?: string;
}) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <figure className="ring-gauge">
      <div className="ring-gauge-dial">
        <svg viewBox="0 0 88 88" aria-hidden="true">
          <circle className="ring-gauge-ticks" cx="44" cy="44" r="42" />
          <circle className="ring-gauge-track" cx="44" cy="44" r={RADIUS} />
          <circle
            className="ring-gauge-value"
            cx="44"
            cy="44"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ "--gauge-empty": CIRCUMFERENCE } as CSSProperties}
            transform="rotate(-90 44 44)"
          />
          <circle className="ring-gauge-inner" cx="44" cy="44" r="27" />
        </svg>
        <strong className="ring-gauge-readout">{readout}</strong>
      </div>
      <figcaption>
        <span className="hud-label">{label}</span>
        {caption ? <span className="ring-gauge-caption">{caption}</span> : null}
      </figcaption>
    </figure>
  );
}
