const TICKS = Array.from({ length: 72 }, (_, index) => index * 5);

function point(angle: number, radius: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [50 + Math.sin(radians) * radius, 50 - Math.cos(radians) * radius];
}

/**
 * Decorative instruments around the unlock globe: a targeting reticle and a lock dial.
 * The unlock screen is shown before the passcode, so these carry no class data.
 */
export function UnlockHud() {
  return (
    <div className="unlock-hud" aria-hidden="true">
      <svg className="globe-reticle" viewBox="0 0 100 100">
        <g className="globe-reticle-ticks">
          {TICKS.map((angle) => {
            const [x1, y1] = point(angle, angle % 45 === 0 ? 45.5 : 47);
            const [x2, y2] = point(angle, 48.5);
            return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <circle className="globe-reticle-arcs" cx="50" cy="50" r="43" />
        <circle className="globe-reticle-arcs globe-reticle-arcs-reverse" cx="50" cy="50" r="41" />
        <path className="globe-reticle-brackets" d="M50 0.5v4M50 95.5v4M0.5 50h4M95.5 50h4" />
      </svg>

      <div className="lock-dial">
        <svg viewBox="0 0 100 100">
          <circle className="lock-dial-outer" cx="50" cy="50" r="46" />
          <circle className="lock-dial-mid" cx="50" cy="50" r="38" />
          <circle className="lock-dial-inner" cx="50" cy="50" r="30" />
          <path className="lock-dial-shackle" d="M40 47v-7a10 10 0 0 1 20 0v7" />
          <rect className="lock-dial-body" x="35" y="47" width="30" height="20" rx="3" />
          <circle className="lock-dial-key" cx="50" cy="56" r="2.6" />
        </svg>
        <p className="hud-label">
          Channel encrypted
          <span className="chevrons">
            <span>›</span>
            <span>›</span>
            <span>›</span>
          </span>
        </p>
      </div>
    </div>
  );
}
