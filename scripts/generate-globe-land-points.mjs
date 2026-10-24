#!/usr/bin/env node
// Generates the dotted continents for the unlock screen's globe. It samples evenly spaced
// points on a sphere (Fibonacci lattice) and keeps those that fall on land in Natural
// Earth's public-domain 110m land polygons. Output is a flat [lat, lng, lat, lng, ...]
// array, so the app ships the dots with its own bundle and the browser fetches nothing.
// Run again only to change the density: node scripts/generate-globe-land-points.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson";
const SAMPLES = 18000;
const OUTPUT = join(process.cwd(), "src", "components", "fx", "holo-globe", "land-points.json");

/** Even-odd ray casting; rings are [lng, lat] pairs. */
function insideRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function onLand(lng, lat, polygons) {
  return polygons.some(([outer, ...holes]) => insideRing(lng, lat, outer) && !holes.some((hole) => insideRing(lng, lat, hole)));
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Natural Earth download failed (${response.status})`);
const land = await response.json();
const polygons = land.features.flatMap(({ geometry }) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates,
);

const golden = Math.PI * (3 - Math.sqrt(5));
const points = [];
for (let i = 0; i < SAMPLES; i++) {
  const y = 1 - (2 * (i + 0.5)) / SAMPLES;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lng = ((((i * golden * 180) / Math.PI) % 360) + 540) % 360 - 180;
  if (onLand(lng, lat, polygons)) points.push(Math.round(lat * 10) / 10, Math.round(lng * 10) / 10);
}

writeFileSync(OUTPUT, `${JSON.stringify(points)}\n`);
console.log(`Wrote ${points.length / 2} land points to ${OUTPUT}`);
