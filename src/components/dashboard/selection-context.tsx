"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type FlyRequest = { id: string; nonce: number };

type SelectionState = {
  /** The person shown in the intel panel (hovered or tapped pin, or clicked roster entry). */
  activeId: string | null;
  /** The roster entry under the pointer or keyboard focus; its pin is highlighted. */
  highlightId: string | null;
  /** Latest request to fly the map to a person. */
  flyRequest: FlyRequest | null;
  /** The person the map is locked onto (picked from the roster or clicked); hovering never locks. */
  lockedId: string | null;
  setActiveId: (id: string | null) => void;
  setHighlightId: (id: string | null) => void;
  /** Shows the person, locks the map onto them and flies there. */
  selectAndFly: (id: string) => void;
  releaseLock: () => void;
};

const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [flyRequest, setFlyRequest] = useState<FlyRequest | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);

  const selectAndFly = useCallback((id: string) => {
    setActiveId(id);
    setLockedId(id);
    setFlyRequest((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1 }));
  }, []);

  const releaseLock = useCallback(() => setLockedId(null), []);

  const value = useMemo(
    () => ({ activeId, highlightId, flyRequest, lockedId, setActiveId, setHighlightId, selectAndFly, releaseLock }),
    [activeId, highlightId, flyRequest, lockedId, selectAndFly, releaseLock],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionState {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("useSelection must be used inside SelectionProvider");
  return context;
}
