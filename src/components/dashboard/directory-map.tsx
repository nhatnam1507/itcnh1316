"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type CameraOptions,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CENTER, DEFAULT_ZOOM, loadNeonStyle, NEON, withOrbitalView } from "@/components/map/map-style";
import { configureMaplibre } from "@/components/map/maplibre-setup";
import type { DirectoryPerson } from "@/features/people/people-queries";
import { type FlyRequest, useSelection } from "./selection-context";
import { beacon, easeOutCubic, EMPTY_COLLECTION, rangeRings, scanGrid } from "./target-lock";

const SOURCE_ID = "classmates";
const HIT_LAYER = "classmates-hit";
const PULSE_LAYER = "classmates-pulse";
const PING_LAYER = "classmates-ping";
const PING_PERIOD_MS = 2400;
const RINGS_SOURCE = "target-rings";
const GRID_SOURCE = "target-grid";
const GRID_LAYER = "target-grid";
const BEACON_SOURCE = "target-beacon";
const BEACON_LAYER = "target-beacon";
const SHOCKWAVE_LAYER = "target-shockwave";
const LOCK_MS = 1100;
/** One sonar ripple from a locked target; the reticle pulses on the same beat (see CSS). */
const SONAR_PERIOD_MS = 2400;
const BEACON_OPACITY = 0.55;
const GRID_OPACITY = 0.32;
const BEACON_HEIGHT_M = 420;
/** Orbit speed around a locked target: a full turn every minute. */
const ORBIT_DEG_PER_MS = 360 / 60_000;
/** While locked, buildings light up as if the area were under floodlights. */
/** Buildings rise out of the ground as the camera comes in. */
const BUILDING_HEIGHT: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  13,
  0,
  14.5,
  ["coalesce", ["get", "render_height"], 8],
];
const BUILDING_BASE: ExpressionSpecification = ["coalesce", ["get", "render_min_height"], 0];
const LIT_BUILDINGS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "render_height"], 8],
  0,
  "#1d4a44",
  80,
  "#5ff5d2",
];
const TILE_SOURCE = "openmaptiles";
const BUILDINGS_LAYER = "buildings-3d";
const BUILDINGS_LIT_LAYER = "buildings-3d-lit";
/** Engage the lock even if some tile never finishes loading. */
const ENGAGE_FALLBACK_MS = 3500;
/** The rings re-send their GeoJSON at most this often while they grow; each update is re-tiled in a worker. */
const GROUND_FRAME_MS = 33;
const VIEW_PITCH = 50;
const VIEW_BEARING = -12;
const ORBIT_ZOOM = 1.2;
const DESCENT_KEY = "classnet-orbital-descent";
const DESCENT_HOLD_MS = 1500;
const DESCENT_MS = 4500;
const DESCENT_TILE_WAIT_MS = 4000;

const isActive: ExpressionSpecification = ["boolean", ["feature-state", "active"], false];
const isHighlighted: ExpressionSpecification = ["boolean", ["feature-state", "highlight"], false];

declare global {
  interface Window {
    /** Lets end-to-end tests find a pin's screen position; exposes no data. */
    __classnetDirectoryMap?: { project: (lng: number, lat: number) => { x: number; y: number } };
  }
}

function toFeatureCollection(people: DirectoryPerson[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }> {
  return {
    type: "FeatureCollection",
    features: people
      .filter((person) => person.latitude !== null && person.longitude !== null)
      .map((person) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [person.longitude as number, person.latitude as number] },
        properties: { id: person.id },
      })),
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positive : negative}`;
}

/** A lock is "tracking" while the camera flies in and the area loads, then "locked". */
type CalloutState = "tracking" | "locked";

const CALLOUT_KICKERS: Record<CalloutState, string> = {
  tracking: "Tracking…",
  locked: "Target locked",
};

/** Builds the callout with DOM APIs and textContent, so names are never parsed as HTML. */
function targetCallout(name: string, latitude: number, longitude: number): HTMLElement {
  const svgNs = "http://www.w3.org/2000/svg";
  const root = document.createElement("div");
  root.className = "target-callout";
  root.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("class", "target-callout-line");
  svg.setAttribute("viewBox", "0 0 64 52");
  const line = document.createElementNS(svgNs, "polyline");
  line.setAttribute("points", "2,50 30,10 64,10");
  svg.append(line);

  const box = document.createElement("div");
  box.className = "target-callout-box";
  const kicker = document.createElement("span");
  kicker.className = "target-callout-kicker";
  const title = document.createElement("strong");
  title.textContent = name;
  const coordinates = document.createElement("span");
  coordinates.className = "target-callout-coords";
  coordinates.textContent = `${formatCoordinate(latitude, "N", "S")} ${formatCoordinate(longitude, "E", "W")}`;
  box.append(kicker, title, coordinates);

  root.append(svg, box);
  return root;
}

/** The first console load in a browser session descends from orbit; later loads open in place. */
function takeDescent(): boolean {
  if (prefersReducedMotion()) return false;
  try {
    if (sessionStorage.getItem(DESCENT_KEY) === "1") return false;
    sessionStorage.setItem(DESCENT_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export default function DirectoryMap({ people }: { people: DirectoryPerson[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { activeId, highlightId, flyRequest, lockedId, setHighlightId, selectAndFly, releaseLock } = useSelection();
  const setHighlightRef = useRef(setHighlightId);
  const selectAndFlyRef = useRef(selectAndFly);
  const releaseLockRef = useRef(releaseLock);
  /** True while the camera dives in to a newly locked target. */
  const lockFlightRef = useRef(false);
  const lockedIdRef = useRef(lockedId);
  const lockHudRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const calloutRef = useRef<HTMLElement | null>(null);
  // The lock engages (environment, HUD, orbit) only once the camera has arrived and the
  // map has drawn the area; until then the target is shown as "tracking". Engagement
  // belongs to one flight, so every new lock starts out tracking.
  const [engagedFlight, setEngagedFlight] = useState<FlyRequest | null>(null);
  const engaged =
    engagedFlight !== null && engagedFlight.id === lockedId && engagedFlight.nonce === flyRequest?.nonce;
  const engagedId = engaged ? lockedId : null;
  const data = useMemo(() => toFeatureCollection(people), [people]);
  const dataRef = useRef(data);
  const target = engaged
    ? people.find((person) => person.id === engagedId && person.latitude !== null && person.longitude !== null)
    : undefined;
  const targetId = target?.id ?? null;
  const targetLng = target?.longitude ?? null;
  const targetLat = target?.latitude ?? null;
  // The person being tracked or locked: the HUD follows them through both phases.
  const tracked = people.find((person) => person.id === lockedId && person.latitude !== null && person.longitude !== null);
  const trackedLng = tracked?.longitude ?? null;
  const trackedLat = tracked?.latitude ?? null;

  useEffect(() => {
    setHighlightRef.current = setHighlightId;
    selectAndFlyRef.current = selectAndFly;
    releaseLockRef.current = releaseLock;
    lockedIdRef.current = lockedId;
    dataRef.current = data;
  }, [setHighlightId, selectAndFly, releaseLock, lockedId, data]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;

    loadNeonStyle()
      .then((style) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        configureMaplibre();
        const descend = takeDescent();
        const map = new MapLibreMap({
          container,
          style: withOrbitalView(style),
          center: DEFAULT_CENTER,
          zoom: descend ? ORBIT_ZOOM : DEFAULT_ZOOM,
          bearing: VIEW_BEARING,
          attributionControl: { compact: true },
        });
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;

        map.on("load", () => {
          if (map.getSource(TILE_SOURCE)) {
            const firstLabel = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
            map.addLayer(
              {
                id: BUILDINGS_LAYER,
                type: "fill-extrusion",
                source: TILE_SOURCE,
                "source-layer": "building",
                minzoom: 13,
                paint: {
                  "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["coalesce", ["get", "render_height"], 8],
                    0,
                    NEON.buildingLow,
                    80,
                    NEON.buildingHigh,
                  ],
                  "fill-extrusion-height": BUILDING_HEIGHT,
                  "fill-extrusion-base": BUILDING_BASE,
                  "fill-extrusion-opacity": 0.9,
                },
              },
              firstLabel,
            );
            // Floodlit copy of the buildings, faded in while a target is locked. Fading a
            // layer's opacity is cheap; swapping the colour expression would re-parse every tile.
            map.addLayer(
              {
                id: BUILDINGS_LIT_LAYER,
                type: "fill-extrusion",
                source: TILE_SOURCE,
                "source-layer": "building",
                minzoom: 13,
                paint: {
                  "fill-extrusion-color": LIT_BUILDINGS,
                  "fill-extrusion-height": BUILDING_HEIGHT,
                  "fill-extrusion-base": BUILDING_BASE,
                  "fill-extrusion-opacity": 0,
                  "fill-extrusion-opacity-transition": { duration: 700, delay: 0 },
                },
              },
              firstLabel,
            );
          }
          map.addSource(SOURCE_ID, { type: "geojson", data: dataRef.current, promoteId: "id" });
          // Lock environment, all empty until a target is locked. The ground layers go under
          // the 3D buildings so the buildings stand on top of them.
          const underBuildings = map.getLayer(BUILDINGS_LAYER) ? BUILDINGS_LAYER : undefined;
          for (const id of [GRID_SOURCE, RINGS_SOURCE, BEACON_SOURCE]) {
            map.addSource(id, { type: "geojson", data: EMPTY_COLLECTION });
          }
          map.addLayer(
            {
              id: GRID_LAYER,
              type: "line",
              source: GRID_SOURCE,
              paint: { "line-color": NEON.pinActive, "line-width": 1, "line-opacity": 0 },
            },
            underBuildings,
          );
          // Range rings around a locked target, flat on the ground under the pins.
          map.addLayer(
            {
              id: "target-zone",
              type: "fill",
              source: RINGS_SOURCE,
              filter: ["==", ["get", "radius"], 150],
              paint: { "fill-color": NEON.pinActive, "fill-opacity": 0.08 },
            },
            underBuildings,
          );
          map.addLayer(
            {
              id: "target-rings",
              type: "line",
              source: RINGS_SOURCE,
              paint: {
                "line-color": NEON.pinActive,
                "line-width": 1.4,
                "line-dasharray": [3, 2],
                "line-opacity": 0.75,
              },
            },
            underBuildings,
          );
          // A beam of light rising from the locked target.
          map.addLayer({
            id: BEACON_LAYER,
            type: "fill-extrusion",
            source: BEACON_SOURCE,
            paint: {
              "fill-extrusion-color": NEON.pinActive,
              "fill-extrusion-height": 0,
              "fill-extrusion-opacity": BEACON_OPACITY,
            },
          });
          // One-shot shockwave that bursts across the ground when a target is locked.
          map.addLayer({
            id: SHOCKWAVE_LAYER,
            type: "circle",
            source: SOURCE_ID,
            filter: ["==", ["get", "id"], ""],
            paint: {
              "circle-pitch-alignment": "map",
              "circle-radius": 8,
              "circle-color": NEON.pinActive,
              "circle-opacity": 0,
              "circle-stroke-color": NEON.pinActive,
              "circle-stroke-width": 3,
              "circle-stroke-opacity": 0,
            },
          });
          map.addLayer({
            id: "classmates-glow",
            type: "circle",
            source: SOURCE_ID,
            paint: {
              "circle-pitch-alignment": "map",
              "circle-radius": ["case", isActive, 24, isHighlighted, 20, 14],
              "circle-color": ["case", isActive, NEON.pinActive, NEON.pin],
              "circle-blur": 1,
              "circle-opacity": ["case", isActive, 0.75, isHighlighted, 0.7, 0.45],
            },
          });
          map.addLayer({
            id: PING_LAYER,
            type: "circle",
            source: SOURCE_ID,
            paint: {
              "circle-pitch-alignment": "map",
              "circle-radius": 6,
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-color": ["case", isActive, NEON.pinActive, NEON.pin],
              "circle-stroke-width": 1.5,
              "circle-stroke-opacity": 0,
            },
          });
          map.addLayer({
            id: PULSE_LAYER,
            type: "circle",
            source: SOURCE_ID,
            filter: ["==", ["get", "id"], ""],
            paint: {
              "circle-pitch-alignment": "map",
              "circle-radius": 10,
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-color": NEON.pinActive,
              "circle-stroke-width": 2,
              "circle-stroke-opacity": 0.8,
            },
          });
          map.addLayer({
            id: "classmates-pin",
            type: "circle",
            source: SOURCE_ID,
            paint: {
              "circle-radius": ["case", isActive, 8, isHighlighted, 8, 6],
              "circle-color": ["case", isActive, NEON.pinActive, isHighlighted, NEON.pinHighlight, NEON.pin],
              "circle-stroke-color": NEON.background,
              "circle-stroke-width": 1.5,
            },
          });
          // Invisible, larger hit area so pins are easy to hover and tap.
          map.addLayer({
            id: HIT_LAYER,
            type: "circle",
            source: SOURCE_ID,
            paint: { "circle-radius": 16, "circle-opacity": 0 },
          });

          const pinId = (event: MapLayerMouseEvent) => {
            const id = event.features?.[0]?.properties?.id;
            return typeof id === "string" ? id : null;
          };
          // Hover only highlights a pin (and its roster entry); it never changes the dossier
          // or the lock, so the one locked target is never in doubt.
          map.on("mousemove", HIT_LAYER, (event) => {
            map.getCanvas().style.cursor = "pointer";
            setHighlightRef.current(pinId(event));
          });
          map.on("mouseleave", HIT_LAYER, () => {
            map.getCanvas().style.cursor = "";
            setHighlightRef.current(null);
          });
          // A click (or tap) locks on and flies in, exactly like picking from the roster.
          map.on("click", HIT_LAYER, (event) => {
            const id = pinId(event);
            if (id) selectAndFlyRef.current(id);
          });
          // A double-click on a pin must not zoom: any zoom releases the lock.
          map.on("dblclick", HIT_LAYER, (event) => event.preventDefault());

          const points = dataRef.current.features.map((feature) => feature.geometry.coordinates as [number, number]);
          let fitted: CameraOptions = { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
          if (points.length === 1) {
            fitted = { center: points[0], zoom: 12 };
          } else if (points.length > 1) {
            const bounds = points.reduce((box, point) => box.extend(point), new LngLatBounds(points[0], points[0]));
            fitted = map.cameraForBounds(bounds, { padding: 60, maxZoom: 13, bearing: VIEW_BEARING }) ?? fitted;
          }
          const view: CameraOptions = { ...fitted, pitch: VIEW_PITCH, bearing: VIEW_BEARING };

          const markReady = () => {
            // Zooming by hand (wheel, pinch, buttons, double-click) releases the lock and
            // returns the map to normal. Scroll zoom carries no originalEvent, so instead every
            // zoom counts except the lock's own dive. Listening starts only once the opening
            // view is set, so the map's own first camera move cannot drop a lock restored
            // from the URL.
            map.on("zoomstart", () => {
              if (!lockFlightRef.current) releaseLockRef.current();
            });
            window.__classnetDirectoryMap = {
              project: (lng, lat) => {
                const point = map.project([lng, lat]);
                return { x: point.x, y: point.y };
              },
            };
            setReady(true);
          };
          if (descend) {
            // Land is the style's background, so until the ocean tiles draw the globe is a
            // solid disc. Stay hidden until the first tiles render (or a fallback fires),
            // hold on the globe for a moment, then dive in to the class. The camera only
            // rotates during a target lock, so the dive keeps one heading.
            let started = false;
            const startDescent = () => {
              if (started || cancelled) return;
              started = true;
              container.dataset.live = "true";
              setTimeout(() => {
                if (cancelled) return;
                map.flyTo({ ...view, duration: DESCENT_MS, curve: 1.7, essential: true });
                map.once("moveend", markReady);
              }, DESCENT_HOLD_MS);
            };
            map.once("idle", startDescent);
            setTimeout(startDescent, DESCENT_TILE_WAIT_MS);
          } else {
            container.dataset.live = "true";
            map.jumpTo(view);
            markReady();
          }
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      delete window.__classnetDirectoryMap;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep the pins in sync with the data after admin changes are revalidated.
  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
  }, [ready, data]);

  // Mirror selection into feature state.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.removeFeatureState({ source: SOURCE_ID });
    if (highlightId) map.setFeatureState({ source: SOURCE_ID, id: highlightId }, { highlight: true });
    if (activeId) map.setFeatureState({ source: SOURCE_ID, id: activeId }, { active: true });
  }, [ready, data, activeId, highlightId]);

  // Pulse ring around the active pin, off when the system asks for reduced motion.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter(PULSE_LAYER, ["==", ["get", "id"], activeId ?? ""]);
    if (!activeId || prefersReducedMotion()) {
      map.setPaintProperty(PULSE_LAYER, "circle-radius", 14);
      map.setPaintProperty(PULSE_LAYER, "circle-stroke-opacity", activeId ? 0.8 : 0);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const phase = ((now - started) % 1600) / 1600;
      map.setPaintProperty(PULSE_LAYER, "circle-radius", 10 + phase * 22);
      map.setPaintProperty(PULSE_LAYER, "circle-stroke-opacity", 0.9 * (1 - phase));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, activeId]);

  // HUD callout: a leader line from the locked pin out to a label with name and coordinates.
  // It belongs to the lock, so it goes when the lock is released.
  useEffect(() => {
    const map = mapRef.current;
    const person = people.find((candidate) => candidate.id === lockedId);
    if (!ready || !map || person?.latitude == null || person.longitude == null) return;
    const element = targetCallout(person.full_name, person.latitude, person.longitude);
    calloutRef.current = element;
    const marker = new Marker({
      element,
      anchor: "bottom-left",
      pitchAlignment: "viewport",
      rotationAlignment: "viewport",
    })
      .setLngLat([person.longitude, person.latitude])
      .addTo(map);
    return () => {
      calloutRef.current = null;
      marker.remove();
    };
  }, [ready, lockedId, people]);

  // Callout status: tracking while the camera flies in and the area loads, then locked.
  useEffect(() => {
    const element = calloutRef.current;
    if (!ready || !element) return;
    const state: CalloutState = engaged ? "locked" : "tracking";
    element.dataset.state = state;
    const kicker = element.querySelector(".target-callout-kicker");
    if (kicker) kicker.textContent = CALLOUT_KICKERS[state];
  }, [ready, lockedId, engaged, people]);

  // Target lock environment: a shockwave bursts from the pin, range rings and a scan grid
  // spread out, a light beam rises and the buildings light up. Once settled, a sonar ripple
  // pulses from the target and the beam breathes; both are paint updates, so no map data is
  // re-sent. All of it is cleared when the lock is released.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !targetId || targetLng === null || targetLat === null) return;
    const source = (id: string) => map.getSource(id) as GeoJSONSource;
    const center: [number, number] = [targetLng, targetLat];
    const lit = map.getLayer(BUILDINGS_LIT_LAYER) !== undefined;
    if (lit) map.setPaintProperty(BUILDINGS_LIT_LAYER, "fill-extrusion-opacity", 0.9);
    source(GRID_SOURCE).setData(scanGrid(center));
    source(BEACON_SOURCE).setData(beacon(center));

    let frame = 0;
    if (prefersReducedMotion()) {
      source(RINGS_SOURCE).setData(rangeRings(center));
      map.setPaintProperty(GRID_LAYER, "line-opacity", GRID_OPACITY);
      map.setPaintProperty(BEACON_LAYER, "fill-extrusion-height", BEACON_HEIGHT_M);
    } else {
      map.setFilter(SHOCKWAVE_LAYER, ["==", ["get", "id"], targetId]);
      const started = performance.now();
      let lastGround = -Infinity;
      let settled = false;
      const tick = (now: number) => {
        // rAF stamps the frame start, which can precede `started`.
        const elapsed = Math.max(0, now - started);
        const t = Math.min(1, elapsed / LOCK_MS);
        const eased = easeOutCubic(t);
        if (t < 1) {
          if (now - lastGround >= GROUND_FRAME_MS) {
            lastGround = now;
            source(RINGS_SOURCE).setData(rangeRings(center, eased));
          }
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-radius", 8 + eased * 240);
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-stroke-width", 3 - 2 * t);
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-stroke-opacity", 0.9 * (1 - t));
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-opacity", 0.18 * (1 - eased));
          map.setPaintProperty(GRID_LAYER, "line-opacity", GRID_OPACITY * eased);
          map.setPaintProperty(BEACON_LAYER, "fill-extrusion-height", BEACON_HEIGHT_M * eased);
        } else {
          if (!settled) {
            settled = true;
            source(RINGS_SOURCE).setData(rangeRings(center));
            map.setPaintProperty(SHOCKWAVE_LAYER, "circle-opacity", 0);
            map.setPaintProperty(GRID_LAYER, "line-opacity", GRID_OPACITY);
            map.setPaintProperty(BEACON_LAYER, "fill-extrusion-height", BEACON_HEIGHT_M);
          }
          // Sonar heartbeat across the ground, and the beam breathing in time with it.
          const phase = ((elapsed - LOCK_MS) % SONAR_PERIOD_MS) / SONAR_PERIOD_MS;
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-radius", 10 + easeOutCubic(phase) * 170);
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-stroke-width", 2);
          map.setPaintProperty(SHOCKWAVE_LAYER, "circle-stroke-opacity", 0.7 * (1 - phase));
          map.setPaintProperty(BEACON_LAYER, "fill-extrusion-opacity", 0.4 + 0.25 * Math.cos(phase * 2 * Math.PI));
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      if (!map.getSource(RINGS_SOURCE)) return;
      for (const id of [GRID_SOURCE, RINGS_SOURCE, BEACON_SOURCE]) source(id).setData(EMPTY_COLLECTION);
      map.setPaintProperty(SHOCKWAVE_LAYER, "circle-stroke-opacity", 0);
      map.setPaintProperty(SHOCKWAVE_LAYER, "circle-opacity", 0);
      map.setPaintProperty(GRID_LAYER, "line-opacity", 0);
      map.setPaintProperty(BEACON_LAYER, "fill-extrusion-height", 0);
      map.setPaintProperty(BEACON_LAYER, "fill-extrusion-opacity", BEACON_OPACITY);
      if (lit) map.setPaintProperty(BUILDINGS_LIT_LAYER, "fill-extrusion-opacity", 0);
    };
  }, [ready, targetId, targetLng, targetLat]);

  // Keep the HUD (the tracking radar, then the reticle, crosshairs and spotlight) pinned to
  // the target as the map moves. The element changes between phases, so re-attach on each.
  useLayoutEffect(() => {
    const map = mapRef.current;
    const hud = lockHudRef.current;
    if (!ready || !map || !hud || trackedLng === null || trackedLat === null) return;
    const place = () => {
      const point = map.project([trackedLng, trackedLat]);
      hud.style.setProperty("--tx", `${point.x}px`);
      hud.style.setProperty("--ty", `${point.y}px`);
      // Live camera readout under the reticle: it ticks as the camera orbits the target.
      if (readoutRef.current) {
        const bearing = Math.round((map.getBearing() + 360) % 360);
        readoutRef.current.textContent = `Lock · BRG ${String(bearing).padStart(3, "0")}° · Z ${map.getZoom().toFixed(1)}`;
      }
    };
    place();
    map.on("move", place);
    map.on("resize", place);
    return () => {
      map.off("move", place);
      map.off("resize", place);
    };
  }, [ready, lockedId, engaged, trackedLng, trackedLat]);

  // Sonar ping expanding from every pin, off when the system asks for reduced motion.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || prefersReducedMotion()) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const phase = ((now - started) % PING_PERIOD_MS) / PING_PERIOD_MS;
      map.setPaintProperty(PING_LAYER, "circle-radius", 6 + phase * 30);
      map.setPaintProperty(PING_LAYER, "circle-stroke-opacity", 0.7 * (1 - phase));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  // Fly to a person picked from the roster or clicked on the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !flyRequest) return;
    const person = people.find((candidate) => candidate.id === flyRequest.id);
    if (person?.latitude == null || person.longitude == null) return;
    // Lock on: swoop down to street level, where the 3D buildings stand around the pin. Once
    // the camera has arrived and the area's tiles are loaded, engage the lock and circle the
    // target for as long as it holds. Zooming releases the lock and locking another pin
    // starts a new flight; dragging only pauses the orbit.
    const reduced = prefersReducedMotion();
    let frame = 0;
    let held = false;
    const hold = () => {
      held = true;
    };
    const letGo = () => {
      held = false;
    };
    const orbit = (last: number) => (now: number) => {
      if (lockedIdRef.current !== person.id) return;
      if (!held && !map.isMoving()) map.setBearing(map.getBearing() + Math.max(0, now - last) * ORBIT_DEG_PER_MS);
      frame = requestAnimationFrame(orbit(now));
    };
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let engagedLock = false;
    const engage = () => {
      if (engagedLock || lockedIdRef.current !== person.id) return;
      engagedLock = true;
      clearTimeout(fallback);
      map.off("render", engageWhenLoaded);
      setEngagedFlight(flyRequest);
      if (!reduced) frame = requestAnimationFrame(orbit(performance.now()));
    };
    // The pins' sonar ping repaints every frame, so the map never reports "idle";
    // check the tiles on each rendered frame instead.
    const engageWhenLoaded = () => {
      if (map.areTilesLoaded()) engage();
    };
    const arrive = () => {
      lockFlightRef.current = false;
      fallback = setTimeout(engage, ENGAGE_FALLBACK_MS);
      map.on("render", engageWhenLoaded);
      engageWhenLoaded();
    };
    const container = map.getCanvasContainer();
    container.addEventListener("pointerdown", hold);
    window.addEventListener("pointerup", letGo);
    window.addEventListener("pointercancel", letGo);
    // Registered before the flight starts: with no duration it ends synchronously.
    map.once("moveend", arrive);
    lockFlightRef.current = true;
    map.flyTo({
      center: [person.longitude, person.latitude],
      zoom: Math.max(map.getZoom(), 15),
      pitch: 60,
      bearing: map.getBearing() + 35,
      essential: false,
      duration: reduced ? 0 : 2200,
    });
    return () => {
      lockFlightRef.current = false;
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
      map.off("moveend", arrive);
      map.off("render", engageWhenLoaded);
      container.removeEventListener("pointerdown", hold);
      window.removeEventListener("pointerup", letGo);
      window.removeEventListener("pointercancel", letGo);
    };
  }, [ready, flyRequest, people]);

  return (
    <div className="directory-map-wrap">
      <div
        ref={containerRef}
        className="directory-map"
        data-testid="directory-map"
        data-ready={ready ? "true" : undefined}
        role="region"
        aria-label="Map of classmates. Use the roster to browse by keyboard."
      />
      {ready && tracked && !engaged ? (
        // Tracking: a radar sweeps around the target while the camera flies in.
        <div key={`${tracked.id}:tracking`} ref={lockHudRef} className="target-lock" aria-hidden="true">
          <span className="target-track-radar" />
        </div>
      ) : null}
      {ready && target && targetLat !== null && targetLng !== null ? (
        // Keyed by person so the lock-on animation replays for each newly engaged target.
        <div key={`${target.id}:locked`} ref={lockHudRef} className="target-lock" aria-hidden="true">
          <span className="target-lock-spot" />
          <span className="target-lock-flash" />
          <span className="target-lock-x" />
          <span className="target-lock-y" />
          <span className="target-lock-lat">{formatCoordinate(targetLat, "N", "S")}</span>
          <span className="target-lock-lng">{formatCoordinate(targetLng, "E", "W")}</span>
          <span className="target-lock-reticle">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span ref={readoutRef} className="target-lock-readout" />
        </div>
      ) : null}
      {loadError ? (
        <p className="map-error form-error" role="alert">
          Map offline. The roster still lists every classmate.
        </p>
      ) : null}
    </div>
  );
}
