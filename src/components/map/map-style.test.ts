import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { applyNeonPalette, NEON, withOrbitalView } from "./map-style";

const style: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#000" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#111" } },
    {
      id: "highway_motorway_inner",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      paint: { "line-color": "#222", "line-width": 3 },
    },
    {
      id: "place_city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      layout: { "text-field": "{name}" },
      paint: { "text-color": "#333" },
    },
    { id: "future_layer", type: "heatmap", source: "openmaptiles", "source-layer": "poi" },
  ],
};

describe("applyNeonPalette", () => {
  const result = applyNeonPalette(style);
  const layer = (id: string) => result.layers.find((candidate) => candidate.id === id)!;

  const paint = (id: string) => layer(id).paint as Record<string, unknown>;

  it("recolors known layers and keeps other paint properties", () => {
    expect(paint("water")["fill-color"]).toEqual(expect.arrayContaining([NEON.sea, NEON.water]));
    expect(paint("highway_motorway_inner")).toMatchObject({ "line-color": NEON.roadMotorway, "line-width": 3 });
  });

  it("draws land as a bright silhouette from orbit that darkens near the ground", () => {
    expect(paint("background")["background-color"]).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      NEON.landHud,
      5.5,
      NEON.landMid,
      9,
      NEON.land,
    ]);
  });

  it("hides roads and labels in the orbital view", () => {
    expect(paint("highway_motorway_inner")["line-opacity"]).toEqual(["step", ["zoom"], 0, 6, 1]);
    expect(paint("place_city")["text-opacity"]).toEqual(["step", ["zoom"], 0, 4.5, 1]);
  });

  it("adds glowing coastlines right above the water", () => {
    const ids = result.layers.map((candidate) => candidate.id);
    expect(ids.slice(ids.indexOf("water"), ids.indexOf("water") + 3)).toEqual(["water", "hud-coast-glow", "hud-coast"]);
    expect(layer("hud-coast")).toMatchObject({ type: "line", source: "openmaptiles", "source-layer": "water" });
  });

  it("keeps the active-pin color for the active pin only", () => {
    const colors = result.layers.flatMap((candidate) => Object.values(candidate.paint ?? {}));
    expect(colors).not.toContain(NEON.pinActive);
  });

  it("prefers Latin labels so unsupported scripts do not render as boxes", () => {
    expect(layer("place_city").layout).toMatchObject({
      "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
    });
  });

  it("leaves unknown layers untouched", () => {
    expect(layer("future_layer")).toBe(style.layers[4]);
  });
});

describe("withOrbitalView", () => {
  it("switches to the globe projection and adds a sky without touching layers", () => {
    const result = withOrbitalView(style);
    expect(result.projection).toEqual({ type: "globe" });
    expect(result.sky?.["sky-color"]).toBe(NEON.background);
    expect(result.layers).toBe(style.layers);
  });
});
