import { useId } from "react";

const ACCENT = { stroke: "var(--accent)" };

/** CLASSNET mark: a hex shield around a targeting reticle. Decorative; pair it with a text name. */
export function ClassnetEmblem({ className }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--accent-2)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-3)" }} />
        </linearGradient>
      </defs>
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.6" />
      <circle className="emblem-ring" cx="16" cy="16" r="6.4" fill="none" style={ACCENT} strokeWidth="1.2" strokeDasharray="3.2 1.8" />
      <path d="M16 7v4M16 21v4M7 16h4M21 16h4" style={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.8" style={{ fill: "var(--accent)" }} />
    </svg>
  );
}
