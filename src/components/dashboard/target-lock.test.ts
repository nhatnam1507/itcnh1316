import { describe, expect, it } from "vitest";
import { circleRing, offsetMetres, RANGE_RINGS_M, rangeRings, scanGrid } from "./target-lock";

/** Haversine distance in metres. */
function distance([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(a));
}

const HANOI: [number, number] = [105.8524, 21.0287];

describe("target lock geometry", () => {
  it("puts every ring point at the requested distance and closes the ring", () => {
    const ring = circleRing(HANOI, 400, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    for (const point of ring) expect(distance(HANOI, point)).toBeCloseTo(400, 3);
  });

  it("builds one polygon per range ring, scaled while growing", () => {
    const full = rangeRings(HANOI);
    expect(full.features.map((feature) => feature.properties.radius)).toEqual([...RANGE_RINGS_M]);
    const half = rangeRings(HANOI, 0.5);
    const [lng, lat] = half.features[2].geometry.coordinates[0][0];
    expect(distance(HANOI, [lng, lat])).toBeCloseTo(RANGE_RINGS_M[2] / 2, 3);
  });

  it("offsets points by metres east and north", () => {
    expect(distance(HANOI, offsetMetres(HANOI, 300, 0))).toBeCloseTo(300, 0);
    expect(distance(HANOI, offsetMetres(HANOI, 0, -500))).toBeCloseTo(500, 0);
  });

  it("clips the scan grid to the scan circle", () => {
    const grid = scanGrid(HANOI, 300, 100);
    expect(grid.features).toHaveLength(10);
    for (const line of grid.features) {
      for (const [lng, lat] of line.geometry.coordinates) expect(distance(HANOI, [lng, lat])).toBeLessThan(301);
    }
  });
});
