import type { DirectoryPerson } from "./people-queries";

const DAY_MS = 86_400_000;

export type RadarBlip = {
  id: string;
  /** Degrees clockwise from north, as seen from the class centroid. */
  angle: number;
  /** 0 = centroid, 1 = the classmate farthest from it. */
  distance: number;
};

/** Real class figures for the console's HUD instruments. Nothing here is invented. */
export type Telemetry = {
  total: number;
  fixed: number;
  birthsByMonth: number[];
  nextBirthday: { id: string; name: string; days: number } | null;
  blips: RadarBlip[];
};

/** Days from `today` (UTC date) to the next occurrence of an ISO birth date; 0 means today. */
export function daysUntilBirthday(isoDate: string, today: Date): number {
  const [, month, day] = isoDate.split("-").map(Number);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  // Date.UTC rolls 29 February over to 1 March in non-leap years.
  let next = Date.UTC(today.getUTCFullYear(), month - 1, day);
  if (next < start) next = Date.UTC(today.getUTCFullYear() + 1, month - 1, day);
  return Math.round((next - start) / DAY_MS);
}

function radarBlips(people: DirectoryPerson[]): RadarBlip[] {
  const pinned = people.filter((person) => person.latitude !== null && person.longitude !== null);
  if (pinned.length === 0) return [];
  const centerLat = pinned.reduce((sum, person) => sum + (person.latitude as number), 0) / pinned.length;
  const centerLng = pinned.reduce((sum, person) => sum + (person.longitude as number), 0) / pinned.length;
  const shrink = Math.cos((centerLat * Math.PI) / 180);
  const offsets = pinned.map((person) => {
    const east = ((person.longitude as number) - centerLng) * shrink;
    const north = (person.latitude as number) - centerLat;
    return { id: person.id, east, north, length: Math.hypot(east, north) };
  });
  const farthest = Math.max(...offsets.map((offset) => offset.length));
  return offsets.map(({ id, east, north, length }) => ({
    id,
    angle: ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360,
    // Keep blips off the exact center so they stay visible.
    distance: farthest === 0 ? 0.15 : 0.15 + 0.8 * (length / farthest),
  }));
}

export function computeTelemetry(people: DirectoryPerson[], today: Date): Telemetry {
  const birthsByMonth = Array.from({ length: 12 }, () => 0);
  for (const person of people) birthsByMonth[Number(person.date_of_birth.slice(5, 7)) - 1] += 1;

  let nextBirthday: Telemetry["nextBirthday"] = null;
  for (const person of people) {
    const days = daysUntilBirthday(person.date_of_birth, today);
    if (!nextBirthday || days < nextBirthday.days) nextBirthday = { id: person.id, name: person.full_name, days };
  }

  return {
    total: people.length,
    fixed: people.filter((person) => person.latitude !== null).length,
    birthsByMonth,
    nextBirthday,
    blips: radarBlips(people),
  };
}
