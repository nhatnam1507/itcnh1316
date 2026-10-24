"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_CENTER, DEFAULT_ZOOM, loadNeonStyle, NEON } from "./map-style";
import { configureMaplibre } from "./maplibre-setup";

export type PinValue = { lat: number; lng: number };

type PinPickerProps = {
  value: PinValue | null;
  /** Called when the admin clicks the map or drags the marker. */
  onPick: (value: PinValue) => void;
  label: string;
};

const PIN_ZOOM = 15;

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export default function PinPicker({ value, onPick, label }: PinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;

    loadNeonStyle()
      .then((style) => {
        if (cancelled || !containerRef.current) return;
        configureMaplibre();
        const map = new MapLibreMap({
          container: containerRef.current,
          style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: { compact: false },
        });
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.on("click", (event) => {
          onPickRef.current({ lat: round(event.lngLat.lat), lng: round(event.lngLat.lng) });
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = new Marker({ color: NEON.pinActive, draggable: true });
      marker.on("dragend", () => {
        const position = marker.getLngLat();
        onPickRef.current({ lat: round(position.lat), lng: round(position.lng) });
      });
      markerRef.current = marker.setLngLat([value.lng, value.lat]).addTo(map);
      map.jumpTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), PIN_ZOOM) });
      return;
    }

    const previous = markerRef.current.getLngLat();
    markerRef.current.setLngLat([value.lng, value.lat]);
    // Follow large jumps (a new geocode); leave the view alone for small click adjustments.
    if (Math.abs(previous.lat - value.lat) > 0.01 || Math.abs(previous.lng - value.lng) > 0.01) {
      map.flyTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), PIN_ZOOM) });
    }
  }, [ready, value]);

  return (
    <div className="pin-picker">
      <div ref={containerRef} className="pin-picker-map" role="application" aria-label={label} />
      {loadError ? (
        <p className="field-error" role="alert">
          The map could not load. The record can still be saved without a pin.
        </p>
      ) : (
        <p className="hud-label">Click the map to set the pin, or drag the marker.</p>
      )}
    </div>
  );
}
