---
title: "Phase 5: Dashboard and Change Requests"
status: todo
priority: P1
effort: 8h
dependencies: [3]
---

# Phase 5: Dashboard and Change Requests

## Overview

Build the main "surveillance console" dashboard:
- A full-screen neon map with a pin for each classmate.
- A left intel panel that shows the hovered or tapped classmate.
- A right roster panel listing every classmate.
- A change-request form that visitors who know the passcode can submit.

## Key Insights

- The server component fetches the directory after `requireClassAccess()` and passes plain data to the client map. The browser never contacts Supabase; it only fetches map tiles from OpenFreeMap.
- Rendering pins as a GeoJSON circle layer, rather than one DOM marker per person, keeps hover detection cheap and makes a neon glow easy (a blurred circle under the solid pin).
- Touch devices have no hover, so a tap selects the pin, and the left panel becomes a bottom drawer on narrow screens.
- People without coordinates still appear in the roster, marked "no fix", so no classmate is hidden.

## Requirements

- [x] `src/app/page.tsx` (server component):
  - Calls `requireClassAccess()` and `listPeopleForDirectory()`.
  - Renders the layout: `IntelPanel` on the left, `DirectoryMap` in the center, `RosterPanel` on the right.
- [x] `DirectoryMap` (client component, loaded with `next/dynamic` and `ssr: false`):
  - Uses the neon style from phase 4 and fits bounds to all pins on load.
  - Mouse hover over a pin sets `activePersonId`; a tap or click does the same on touch screens.
  - The cursor changes on hover, and the active pin pulses. The pulse is turned off when the system's reduce-motion setting is on.
- [x] `IntelPanel` (left) shows the active person's name, date of birth with age, mobile phone (a `tel:` link), and address.
  - Styled as a "target dossier" with a glitch effect on change.
  - Shows a placeholder ("AWAITING TARGET") when nobody is active.
  - Has a "Request change" link to `/people/[id]/request-change`.
- [x] `RosterPanel` (right) lists every person, sorted by name.
  - Hovering or focusing an entry highlights that person's pin, and clicking it flies the map to the pin and selects the person.
  - Shows a "no fix" badge for people without coordinates.
- [x] Shared selection state lives in a small client context. No external state library.
- [x] `/people/[id]/request-change`:
  - Shows the current values and the change form: optional proposed fields plus a note.
  - The server action calls `submitChangeRequest()`.
  - On success it shows a "transmission queued for review" confirmation. On a rate limit or validation error it shows inline errors.
- [x] Theme and usability:
  - Monospace HUD labels, scanline overlay, neon borders, and a corner bracket frame.
  - Body text contrast of at least 4.5:1.
  - Everything works by keyboard: roster entries are focusable buttons.
  - On screens under 768px, the panels become drawers.

## Related Code Files

Create:
- `src/app/page.tsx`
- `src/components/dashboard/selection-context.tsx`
- `src/components/dashboard/directory-map.tsx`
- `src/components/dashboard/intel-panel.tsx`
- `src/components/dashboard/roster-panel.tsx`
- `src/components/dashboard/dashboard-shell.tsx` (the layout and responsive drawers)
- `src/app/people/[id]/request-change/page.tsx`, `src/app/people/[id]/request-change/actions.ts`
- `src/components/change-requests/change-request-form.tsx`

Modify:
- `src/app/globals.css` (dashboard and HUD styles)

## Implementation Steps

1. Build the selection context and the dashboard shell layout, including the responsive drawers.
2. Build `DirectoryMap`:
   - A GeoJSON source built from the people with coordinates.
   - A glow layer and a pin layer.
   - `mouseenter`, `mouseleave`, and `click` handlers that update the selection.
   - A feature-state highlight for the active pin.
3. Build `IntelPanel` and `RosterPanel`, wired to the selection context.
4. Build the change-request page, form, and action, with a success state.
5. Check the reduced-motion behavior and keyboard navigation by hand.

## Todo

- [x] Build the selection context and dashboard shell.
- [x] Build the DirectoryMap with pins, glow, and hover/tap selection.
- [x] Build the IntelPanel left dossier.
- [x] Build the RosterPanel right list, synced with the pins.
- [x] Build the change-request page and form.
- [x] Check responsive drawers, reduced motion, and keyboard access.

## Success Criteria

- With the seeded data, every person with coordinates shows a pin. Hovering a pin updates the left panel within one frame, and the right panel lists every seeded person.
- On a 390px-wide viewport, tapping a pin opens the dossier drawer.
- A change request submitted from the form appears in `/admin/requests` as pending, and the person record is unchanged until approval.
- The browser network log shows requests only to the app's own origin and `tiles.openfreemap.org`.

## Risk Assessment

- **A large class could crowd the map.** The expected size is about 50 people, so clustering isn't needed. Revisit only if pins overlap badly.
- **Glitch and scanline effects can hurt readability.** They are applied only to decorative layers and headings, never to the phone and address values.

## Security Considerations

- Classmate data reaches the client only inside the response for a request that passed the passcode check.
- The change-request action checks access and the rate limit again on the server, whatever the UI state is.
