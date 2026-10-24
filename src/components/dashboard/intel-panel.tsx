"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DecryptText } from "@/components/fx/decrypt-text";
import { HudRadar } from "@/components/fx/hud/hud-radar";
import { usePointerTilt } from "@/components/fx/use-pointer-tilt";
import { barcodeBars, initials, machineReadableZone, subjectCode } from "@/features/people/dossier-codes";
import type { DirectoryPerson } from "@/features/people/people-queries";
import type { RadarBlip } from "@/features/people/telemetry";
import { ageOn, formatDate, formatPhone } from "@/lib/format";

/** Barcode and passport-style lines at the foot of the ID card, generated from the record. */
function MachineReadableZone({ person }: { person: DirectoryPerson }) {
  const lines = machineReadableZone(person);
  const bars = barcodeBars(lines.join(""));
  const last = bars[bars.length - 1];

  return (
    <div className="dossier-mrz" aria-hidden="true">
      <svg className="dossier-barcode" viewBox={`0 0 ${last.x + last.width} 10`} preserveAspectRatio="none">
        {bars.map((bar) => (
          <rect key={bar.x} x={bar.x} width={bar.width} height="10" />
        ))}
      </svg>
      <p>{lines[0]}</p>
      <p>{lines[1]}</p>
      <span className="stamp stamp-sm">Classified</span>
    </div>
  );
}

type CopyState = "idle" | "copied" | "failed";

/** Copies the number with a short confirmation; the label itself is the feedback. */
function CopyNumber({ phone }: { phone: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const reset = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(reset);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      className="btn dossier-action"
      data-state={state}
      onClick={copy}
      aria-label={state === "idle" ? `Copy number ${phone}` : undefined}
      aria-live="polite"
    >
      {state === "copied" ? "Copied ✓" : state === "failed" ? "Failed" : "Copy"}
    </button>
  );
}

function Dossier({ person }: { person: DirectoryPerson }) {
  const tiltRef = usePointerTilt<HTMLDivElement>(8);

  return (
    <div ref={tiltRef} className="dossier tilt" data-testid="dossier">
      <header className="dossier-id">
        <div className="dossier-monogram" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <path className="dossier-monogram-hex" d="M50 4 90 27v46L50 96 10 73V27Z" />
            <circle className="dossier-monogram-ring" cx="50" cy="50" r="34" />
          </svg>
          <span>{initials(person.full_name)}</span>
        </div>
        <div className="dossier-id-text">
          <p className="hud-label">
            Subject <span className="dossier-code">{subjectCode(person.id)}</span> · Classmate
          </p>
          <h3 className="dossier-name grad-text">
            <DecryptText text={person.full_name} />
          </h3>
        </div>
      </header>
      <dl className="dossier-fields">
        <div>
          <dt className="hud-label">Born</dt>
          <dd>
            {formatDate(person.date_of_birth)} <span className="dossier-age">({ageOn(person.date_of_birth)} yrs)</span>
          </dd>
        </div>
        <div>
          <dt className="hud-label">Mobile</dt>
          <dd>
            <a href={`tel:${person.mobile_phone}`} className="dossier-phone">
              {formatPhone(person.mobile_phone)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="hud-label">Address</dt>
          <dd>{person.address}</dd>
        </div>
        <div>
          <dt className="hud-label">Signal</dt>
          <dd>
            {person.latitude === null ? (
              <span className="badge badge-warn">no fix</span>
            ) : (
              <span className="badge badge-ok">
                {person.latitude.toFixed(4)}, {person.longitude?.toFixed(4)}
              </span>
            )}
          </dd>
        </div>
      </dl>
      <div className="dossier-actions">
        <a href={`tel:${person.mobile_phone}`} className="btn btn-primary dossier-action" aria-label={`Call ${person.full_name}`}>
          Call
        </a>
        <CopyNumber phone={formatPhone(person.mobile_phone)} />
        {person.latitude !== null && person.longitude !== null ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${person.latitude},${person.longitude}`}
            className="btn dossier-action"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Directions to ${person.full_name} in Google Maps (opens in a new tab)`}
          >
            Map ↗
          </a>
        ) : null}
      </div>
      <MachineReadableZone person={person} />
      <p className="dossier-request hud-label">
        Details wrong? <Link href={`/people/${person.id}/request-change`}>Request change →</Link>
      </p>
    </div>
  );
}

export function IntelPanel({
  person,
  blips,
  onClose,
}: {
  person: DirectoryPerson | null;
  blips: RadarBlip[];
  onClose?: () => void;
}) {
  return (
    <section className="intel-panel panel-frame" aria-labelledby="intel-title" aria-live="polite">
      <header className="panel-header">
        <h2 id="intel-title" className="hud-label">
          Target dossier
        </h2>
        {onClose ? (
          <button type="button" className="btn panel-close" onClick={onClose} aria-label="Close dossier">
            ×
          </button>
        ) : null}
      </header>

      {person ? (
        // Keyed by person so the stamp, decryption and redaction reveal replay for each target.
        <Dossier key={person.id} person={person} />
      ) : (
        <div className="dossier-empty">
          <HudRadar blips={blips} />
          <p className="awaiting grad-text">AWAITING TARGET</p>
          <p className="hud-label">Click a pin or pick a name from the roster to lock on.</p>
        </div>
      )}
    </section>
  );
}
