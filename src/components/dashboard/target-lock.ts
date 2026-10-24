/** Geometry for the target-lock effects drawn on the map around the active pin. */

const EARTH_RADIUS_M = 6_371_008.8;
const RING_STEPS = 96;

/** Range rings around a locked target, in metres. */
export const RANGE_RINGS_M = [150, 400, 900] as const;

export const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** A circle of `radius` metres around `[lng, lat]`, as a closed ring of coordinates. */
export function circleRing([lng, lat]: [number, number], radius: number, steps = RING_STEPS): [number, number][] {
  const angular = radius / EARTH_RADIUS_M;
  const latRad = (lat * Math.PI) / 180;
  const ring: [number, number][] = [];
  for (let step = 0; step <= steps; step++) {
    const bearing = (step / steps) * 2 * Math.PI;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angular) + Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );
    const pointLng =
      (lng * Math.PI) / 180 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(pointLat),
      );
    ring.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }
  return ring;
}

/** The range rings as polygons, each scaled by `growth` (0–1) while they spread out. */
export function rangeRings(
  center: [number, number],
  growth = 1,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, { radius: number }> {
  return {
    type: "FeatureCollection",
    features: RANGE_RINGS_M.map((radius) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [circleRing(center, Math.max(1, radius * growth))] },
      properties: { radius },
    })),
  };
}

/** Radius of the scan grid around a locked target, in metres. */
export const SCAN_RADIUS_M = 900;
const METRES_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180;

/** The point `east` and `north` metres away from `[lng, lat]` (flat approximation, fine within a few km). */
export function offsetMetres([lng, lat]: [number, number], east: number, north: number): [number, number] {
  const latRad = (lat * Math.PI) / 180;
  return [lng + east / (METRES_PER_DEGREE * Math.cos(latRad)), lat + north / METRES_PER_DEGREE];
}

/** A square grid of `spacing` metres, clipped to a circle of `radius` metres around the target. */
export function scanGrid(
  center: [number, number],
  radius = SCAN_RADIUS_M,
  spacing = 75,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (let offset = -radius + spacing; offset < radius; offset += spacing) {
    const half = Math.sqrt(radius ** 2 - offset ** 2);
    for (const coordinates of [
      [offsetMetres(center, -half, offset), offsetMetres(center, half, offset)],
      [offsetMetres(center, offset, -half), offsetMetres(center, offset, half)],
    ]) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Footprint of the light beam that rises from a locked target. */
export function beacon(center: [number, number], radius = 14): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [circleRing(center, radius, 24)] }, properties: {} }],
  };
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
