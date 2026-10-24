import { getVersion, getWorkerUrl, setWorkerUrl } from "maplibre-gl";

/** Served from public/maplibre by scripts/copy-maplibre-worker.mjs (runs before dev and build). */
const WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";

/** Call before creating any map, so MapLibre loads its worker from this origin. */
export function configureMaplibre(): void {
  const url = `${WORKER_PATH}?v=${getVersion()}`;
  if (getWorkerUrl() !== url) setWorkerUrl(url);
}
