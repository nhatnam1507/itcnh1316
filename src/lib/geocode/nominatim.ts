import "server-only";
import { getServerEnv } from "@/lib/env";

export type Coordinates = { lat: number; lng: number };

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 5000;
// Nominatim's usage policy allows at most one request per second.
const MIN_INTERVAL_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Parses a `format=jsonv2` search response; returns null on no usable result. */
export function parseNominatimResponse(body: unknown): Coordinates | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const first = body[0] as { lat?: unknown; lon?: unknown };
  const lat = Number.parseFloat(String(first?.lat));
  const lng = Number.parseFloat(String(first?.lon));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Geocodes one address. Never throws: a miss or an outage returns null and the admin pins by hand. */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address.trim();
  if (query.length < 5) return null;

  try {
    const env = getServerEnv();
    const url = new URL(SEARCH_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", env.GEOCODE_COUNTRY_CODES);
    url.searchParams.set("q", query);

    return await throttled(async () => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": `classmate-directory/1.0 (${env.NOMINATIM_CONTACT_EMAIL})`,
          "Accept-Language": "vi,en",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) return null;
      return parseNominatimResponse(await response.json());
    });
  } catch {
    return null;
  }
}
