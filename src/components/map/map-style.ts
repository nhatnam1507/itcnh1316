import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

export const OPENFREEMAP_DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export const NEON = {
  background: "#050608",
  // Land is the style's background. From orbit it is a glowing HUD silhouette; it darkens
  // to graphite as the camera comes down so streets and pins stay readable.
  landHud: "#1fb5a8",
  landMid: "#0d302c",
  land: "#0a0d11",
  sea: "#04070a",
  coast: "#3fe0d0",
  water: "#0a1420",
  waterway: "#122638",
  building: "#0d1116",
  buildingOutline: "#171c24",
  roadMinor: "#12161c",
  roadMajor: "#1b222c",
  roadMotorway: "#283341",
  roadCasing: "#050608",
  rail: "#1a1f27",
  boundary: "#3a4555",
  label: "#8b95a4",
  labelMajor: "#e8edf2",
  labelHalo: "#050608",
  buildingLow: "#18212b",
  buildingHigh: "#2f8f78",
  horizon: "#0d3a30",
  pin: "#5aa9ff",
  pinHighlight: "#b18cff",
  pinActive: "#2ef2b0",
} as const;

type Paint = Record<string, unknown>;

/** Hidden below `zoom`, fully shown from it: keeps the orbital view a clean silhouette. */
const visibleFrom = (zoom: number) => ["step", ["zoom"], 0, zoom, 1];

function paintFor(layer: LayerSpecification): Paint | null {
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
  const id = layer.id;

  switch (layer.type) {
    case "background":
      return {
        "background-color": ["interpolate", ["linear"], ["zoom"], 2, NEON.landHud, 5.5, NEON.landMid, 9, NEON.land],
      };
    case "fill":
      if (sourceLayer === "water") {
        return { "fill-color": ["interpolate", ["linear"], ["zoom"], 4, NEON.sea, 9, NEON.water] };
      }
      if (sourceLayer === "building") return { "fill-color": NEON.building, "fill-outline-color": NEON.buildingOutline };
      if (sourceLayer === "landcover" || sourceLayer === "landuse" || sourceLayer === "park") {
        return { "fill-color": NEON.land, "fill-opacity": visibleFrom(8) };
      }
      return null;
    case "line":
      if (sourceLayer === "waterway") return { "line-color": NEON.waterway, "line-opacity": visibleFrom(7) };
      if (sourceLayer === "boundary") {
        return { "line-color": ["interpolate", ["linear"], ["zoom"], 3, NEON.landMid, 6, NEON.boundary] };
      }
      if (sourceLayer !== "transportation") return null;
      if (id.includes("casing")) return { "line-color": NEON.roadCasing, "line-opacity": visibleFrom(6) };
      if (id.startsWith("railway")) return { "line-color": NEON.rail, "line-opacity": visibleFrom(6) };
      if (id.includes("motorway")) return { "line-color": NEON.roadMotorway, "line-opacity": visibleFrom(6) };
      if (id.includes("major")) return { "line-color": NEON.roadMajor, "line-opacity": visibleFrom(6) };
      return { "line-color": NEON.roadMinor, "line-opacity": visibleFrom(6) };
    case "symbol": {
      const layout = layer.layout as Record<string, unknown> | undefined;
      if (!layout?.["text-field"]) return null;
      const major = id.startsWith("place_city") || id.startsWith("place_country") || id === "place_state";
      return {
        "text-color": major ? NEON.labelMajor : NEON.label,
        "text-halo-color": NEON.labelHalo,
        "text-halo-width": 1.2,
        "text-opacity": visibleFrom(4.5),
      };
    }
    default:
      return null;
  }
}

/** A blurred glow plus a crisp line along every water edge: the HUD map's bright coastline. */
function coastlineLayers(source: string): LayerSpecification[] {
  return [
    {
      id: "hud-coast-glow",
      type: "line",
      source,
      "source-layer": "water",
      maxzoom: 12,
      paint: { "line-color": NEON.coast, "line-width": 7, "line-blur": 6, "line-opacity": 0.35 },
    },
    {
      id: "hud-coast",
      type: "line",
      source,
      "source-layer": "water",
      paint: {
        "line-color": NEON.coast,
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 1.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.95, 12, 0.35],
      },
    },
  ];
}

/**
 * Recolors the OpenFreeMap dark style with the neon palette. Layers are matched by type
 * and source layer, and anything unrecognized is left untouched, so upstream changes to
 * the style cannot break map load.
 */
export function applyNeonPalette(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer) => {
    const overrides = paintFor(layer);
    if (!overrides) return layer;
    const recolored = { ...layer, paint: { ...(layer.paint as Paint | undefined), ...overrides } } as LayerSpecification;
    return layer.type === "symbol" ? withLatinLabels(recolored) : recolored;
  });
  // Coastlines go right above the last water fill, so they sit under roads and labels.
  const lastWater = layers.findLastIndex((layer) => layer.type === "fill" && layer["source-layer"] === "water");
  if (lastWater >= 0) {
    const water = layers[lastWater] as Extract<LayerSpecification, { type: "fill" }>;
    layers.splice(lastWater + 1, 0, ...coastlineLayers(water.source));
  }
  return { ...style, layers };
}

/**
 * The style's fonts cover Latin scripts (including Vietnamese) but not Lao, Khmer or Han,
 * which would render as empty boxes. Prefer the Latin name where one exists.
 */
function withLatinLabels(layer: LayerSpecification): LayerSpecification {
  const layout = layer.layout as Record<string, unknown> | undefined;
  if (!layout?.["text-field"]) return layer;
  return {
    ...layer,
    layout: { ...layout, "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]] },
  } as LayerSpecification;
}

let cachedStyle: Promise<StyleSpecification> | undefined;

/** Fetches the upstream style once per page and recolors it. */
export function loadNeonStyle(): Promise<StyleSpecification> {
  cachedStyle ??= fetch(OPENFREEMAP_DARK_STYLE_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Map style request failed (${response.status})`);
      return response.json() as Promise<StyleSpecification>;
    })
    .then(applyNeonPalette)
    .catch((error) => {
      cachedStyle = undefined;
      throw error;
    });
  return cachedStyle;
}

/**
 * Globe projection with a faint atmosphere, so zooming out shows the planet in 3D. The
 * atmosphere fades out as the camera nears the ground.
 */
export function withOrbitalView(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    projection: { type: "globe" },
    sky: {
      "sky-color": NEON.background,
      "horizon-color": NEON.horizon,
      "fog-color": NEON.background,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.8,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 8, 0],
    },
  };
}

/** Vietnam, for maps with nothing to fit. */
export const DEFAULT_CENTER: [number, number] = [106.0, 16.2];
export const DEFAULT_ZOOM = 4.6;
