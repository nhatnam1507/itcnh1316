"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import type { DirectoryPerson } from "@/features/people/people-queries";
import { matchesSearch } from "@/lib/search";
import { useSelection } from "./selection-context";

/** Moves focus between roster entries with the arrow keys, Home and End. */
function moveFocus(event: KeyboardEvent<HTMLElement>, list: HTMLUListElement | null) {
  const entries = Array.from(list?.querySelectorAll<HTMLButtonElement>("[data-testid=roster-entry]") ?? []);
  if (entries.length === 0) return;
  const index = entries.indexOf(document.activeElement as HTMLButtonElement);
  const next = {
    ArrowDown: Math.min(entries.length - 1, index + 1),
    ArrowUp: index - 1,
    Home: 0,
    End: entries.length - 1,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  if (next < 0) {
    // Up from the first entry returns to the search field.
    list?.closest("section")?.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    return;
  }
  entries[next].focus();
}

export function RosterPanel({
  people,
  searchRef,
  onSelect,
  onClose,
}: {
  people: DirectoryPerson[];
  searchRef?: RefObject<HTMLInputElement | null>;
  onSelect?: () => void;
  onClose?: () => void;
}) {
  const { activeId, highlightId, setHighlightId, selectAndFly } = useSelection();
  const [query, setQuery] = useState("");
  const [list, setList] = useState<HTMLUListElement | null>(null);
  // Keep each classmate's roster number when filtering, so a number always means one person.
  const numbered = useMemo(() => people.map((person, index) => ({ person, number: index + 1 })), [people]);
  const matches = numbered.filter(({ person }) => matchesSearch(query, person.full_name, person.address));
  const filtering = query.trim() !== "";

  function select(id: string) {
    selectAndFly(id);
    onSelect?.();
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && matches.length > 0) {
      event.preventDefault();
      select(matches[0].person.id);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      list?.querySelector<HTMLButtonElement>("[data-testid=roster-entry]")?.focus();
    } else if (event.key === "Escape" && query) {
      // Clear the search first; a second Escape reaches the console (closes the drawer).
      event.stopPropagation();
      setQuery("");
    }
  }

  return (
    <section className="roster-panel panel-frame" aria-labelledby="roster-title">
      <header className="panel-header">
        <h2 id="roster-title" className="hud-label">
          Roster <span data-testid="roster-count">[{people.length}]</span>
        </h2>
        {onClose ? (
          <button type="button" className="btn panel-close" onClick={onClose} aria-label="Close roster">
            ×
          </button>
        ) : null}
      </header>
      <div className="roster-search">
        <input
          ref={searchRef}
          type="search"
          className="input"
          aria-label="Search classmates by name or address"
          aria-controls="roster-list"
          placeholder="Search name or address"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
        />
        <kbd className="roster-search-key" aria-hidden="true">
          /
        </kbd>
      </div>
      <p className="roster-search-status hud-label" role="status">
        {filtering ? `${matches.length} of ${people.length} · Enter locks the first match` : null}
      </p>
      <ul id="roster-list" ref={setList} className="roster-list" onKeyDown={(event) => moveFocus(event, list)}>
        {matches.map(({ person, number }, index) => (
          <li key={person.id} style={{ "--i": filtering ? 0 : index } as CSSProperties}>
            <button
              type="button"
              className="roster-entry"
              data-testid="roster-entry"
              aria-current={activeId === person.id ? "true" : undefined}
              data-highlighted={highlightId === person.id ? "true" : undefined}
              onMouseEnter={() => setHighlightId(person.id)}
              onMouseLeave={() => setHighlightId(null)}
              onFocus={() => setHighlightId(person.id)}
              onBlur={() => setHighlightId(null)}
              onClick={() => select(person.id)}
            >
              <span className="roster-index" aria-hidden="true">
                {String(number).padStart(2, "0")}
              </span>
              <span className="roster-name">{person.full_name}</span>
              {person.latitude === null ? (
                <span className="badge badge-warn">no fix</span>
              ) : (
                <span className="roster-signal" aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
        {people.length === 0 ? <li className="hud-label">No classmates on file yet.</li> : null}
        {people.length > 0 && matches.length === 0 ? (
          <li className="roster-empty">
            <p className="hud-label">No classmate matches “{query.trim()}”.</p>
            <button type="button" className="btn" onClick={() => setQuery("")}>
              Clear search
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
