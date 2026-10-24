"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ClassnetEmblem } from "@/components/brand/classnet-emblem";
import { AccessGranted } from "@/components/fx/access-granted";
import { DecryptText } from "@/components/fx/decrypt-text";
import { MissionClock } from "@/components/fx/mission-clock";
import type { DirectoryPerson } from "@/features/people/people-queries";
import type { Telemetry } from "@/features/people/telemetry";
import { IntelPanel } from "./intel-panel";
import { RosterPanel } from "./roster-panel";
import { TelemetryPanel } from "./telemetry-panel";
import { SelectionProvider, useSelection } from "./selection-context";

const DirectoryMap = dynamic(() => import("./directory-map"), {
  ssr: false,
  loading: () => <div className="directory-map directory-map-loading">ACQUIRING SATELLITE FEED…</div>,
});

/** Counter style for the header readouts: `6` → `06`. */
const readout = (count: number) => String(count).padStart(2, "0");

/** The locked classmate lives in the URL (`?p=<id>`), so a reload or a shared link reopens them. */
const PERSON_PARAM = "p";
const NARROW = "(max-width: 767px)";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

type ConsoleProps = { people: DirectoryPerson[]; telemetry: Telemetry; currentMonth: number };

function Console({ people, telemetry, currentMonth }: ConsoleProps) {
  const { activeId, lockedId, selectAndFly, releaseLock } = useSelection();
  const [rosterOpen, setRosterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const urlRestored = useRef(false);
  // On narrow screens the dossier is a drawer that opens for each newly selected person.
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const active = people.find((person) => person.id === activeId) ?? null;
  const dossierOpen = active !== null && dismissedId !== active.id;
  const fixed = people.filter((person) => person.latitude !== null).length;

  // Restore the classmate from the URL once, then keep the URL in step with the lock.
  useEffect(() => {
    if (!urlRestored.current) {
      urlRestored.current = true;
      const id = new URLSearchParams(window.location.search).get(PERSON_PARAM);
      if (id && people.some((person) => person.id === id)) selectAndFly(id);
      return;
    }
    const url = new URL(window.location.href);
    if (lockedId) url.searchParams.set(PERSON_PARAM, lockedId);
    else url.searchParams.delete(PERSON_PARAM);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [lockedId, people, selectAndFly]);

  // Keyboard: "/" or Ctrl/Cmd+K jumps to the roster search; Escape closes the open drawer,
  // otherwise releases the lock.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const search = event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");
      if (search && (event.key !== "/" || !isTyping(event.target))) {
        event.preventDefault();
        setRosterOpen(true);
        // The drawer becomes focusable once it is shown.
        requestAnimationFrame(() => searchRef.current?.focus());
      } else if (event.key === "Escape") {
        if (rosterOpen) setRosterOpen(false);
        else if (dossierOpen && window.matchMedia(NARROW).matches) setDismissedId(activeId);
        else if (lockedId) releaseLock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rosterOpen, dossierOpen, activeId, lockedId, releaseLock]);

  return (
    <div className="console">
      <p className="classified-banner" aria-hidden="true">
        Top secret // Eyes only // Classnet
      </p>
      <header className="console-header">
        <ClassnetEmblem className="console-emblem" />
        <h1 className="console-title grad-text">
          <DecryptText text="CLASSNET // SURVEILLANCE CONSOLE" duration={1400} />
        </h1>
        <dl className="console-stats">
          <div>
            <dt>Targets</dt>
            <dd>{readout(people.length)}</dd>
          </div>
          <div>
            <dt>Fixed</dt>
            <dd>{readout(fixed)}</dd>
          </div>
        </dl>
        <p className="console-live hud-label" aria-hidden="true">
          <span className="rec-dot" />
          Live · <MissionClock />
        </p>
        <nav className="console-nav" aria-label="Console">
          <button
            type="button"
            className="btn roster-toggle"
            aria-expanded={rosterOpen}
            aria-controls="roster-drawer"
            onClick={() => setRosterOpen((open) => !open)}
          >
            Roster
          </button>
          <Link href="/admin" className="hud-label">
            Admin
          </Link>
        </nav>
      </header>

      <div className="console-body">
        <aside className="console-intel" data-open={dossierOpen ? "true" : undefined}>
          <IntelPanel person={active} blips={telemetry.blips} onClose={() => setDismissedId(active?.id ?? null)} />
        </aside>
        <div className="console-map">
          <DirectoryMap people={people} />
          <div className="map-hud" aria-hidden="true">
            <span className="map-hud-corner map-hud-corner-tl" />
            <span className="map-hud-corner map-hud-corner-tr" />
            <span className="map-hud-corner map-hud-corner-bl" />
            <span className="map-hud-corner map-hud-corner-br" />
            <span className="map-hud-label">Sat-7 · Live feed · Encrypted</span>
          </div>
        </div>
        <aside id="roster-drawer" className="console-roster" data-open={rosterOpen ? "true" : undefined}>
          <RosterPanel
            people={people}
            searchRef={searchRef}
            onSelect={() => setRosterOpen(false)}
            onClose={() => setRosterOpen(false)}
          />
          <TelemetryPanel telemetry={telemetry} currentMonth={currentMonth} />
        </aside>
      </div>
      <AccessGranted />
      <div className="fx-crt" aria-hidden="true" />
    </div>
  );
}

export function DashboardShell(props: ConsoleProps) {
  return (
    <SelectionProvider>
      <Console {...props} />
    </SelectionProvider>
  );
}
