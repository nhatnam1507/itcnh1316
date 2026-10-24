import type { CSSProperties } from "react";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Bar chart of birthdays per month, styled as a HUD level meter. */
export function MonthBars({ counts, currentMonth }: { counts: number[]; currentMonth: number }) {
  const peak = Math.max(1, ...counts);
  const summary = counts.map((count, index) => `${MONTH_NAMES[index]} ${count}`).join(", ");

  return (
    <figure className="month-bars">
      <figcaption className="hud-label">Birthdays by month</figcaption>
      <div className="month-bars-chart" role="img" aria-label={`Birthdays by month: ${summary}`}>
        {counts.map((count, index) => (
          <div
            key={index}
            className="month-bars-column"
            data-current={index === currentMonth ? "true" : undefined}
            style={{ "--level": count / peak, "--i": index } as CSSProperties}
          >
            <span className="month-bars-bar" />
            <span className="month-bars-month" aria-hidden="true">
              {MONTHS[index]}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}
