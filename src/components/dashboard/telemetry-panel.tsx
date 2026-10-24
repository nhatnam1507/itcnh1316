import { MonthBars } from "@/components/fx/hud/month-bars";
import { RingGauge } from "@/components/fx/hud/ring-gauge";
import type { Telemetry } from "@/features/people/telemetry";

export function TelemetryPanel({ telemetry, currentMonth }: { telemetry: Telemetry; currentMonth: number }) {
  const { total, fixed, nextBirthday, birthsByMonth } = telemetry;
  const coverage = total > 0 ? Math.round((fixed / total) * 100) : 0;

  return (
    <section className="telemetry-panel panel-frame" aria-labelledby="telemetry-title">
      <header className="panel-header">
        <h2 id="telemetry-title" className="hud-label">
          Telemetry
        </h2>
      </header>
      <div className="telemetry-gauges">
        <RingGauge value={fixed} max={total} readout={`${coverage}%`} label="Signal fix" caption={`${fixed} of ${total} pinned`} />
        {nextBirthday ? (
          <RingGauge
            value={365 - nextBirthday.days}
            max={365}
            readout={nextBirthday.days === 0 ? "Today" : `T-${nextBirthday.days}`}
            label="Next birthday"
            caption={nextBirthday.name}
          />
        ) : null}
      </div>
      <MonthBars counts={birthsByMonth} currentMonth={currentMonth} />
    </section>
  );
}
