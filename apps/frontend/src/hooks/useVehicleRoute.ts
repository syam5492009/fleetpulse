'use client';

import { useEffect, useRef, useState } from 'react';

// Leaflet expects [lat, lng]; GeoJSON uses [lng, lat] — we return Leaflet order.
export type LatLng = [number, number];

// OSRM public demo — no API key needed, uses OpenStreetMap road data.
// Replace with your own OSRM instance URL if you self-host.
const OSRM_BASE = 'https://router.project-osrm.org/match/v1/driving';

// OSRM allows max 100 waypoints per request — we downsample to this before sending.
const OSRM_MAX_POINTS = 100;

/**
 * Takes raw GPS points (GeoJSON [lng, lat] order) and returns
 * road-snapped coordinates via OSRM map matching.
 * Falls back to the original points if snapping fails.
 */
async function snapToRoads(
  rawCoords: [number, number][],   // GeoJSON order: [lng, lat]
): Promise<[number, number][]> {
  if (rawCoords.length < 2) return rawCoords;

  // Downsample to OSRM limit while keeping first and last
  let coords = rawCoords;
  if (coords.length > OSRM_MAX_POINTS) {
    const step = (coords.length - 1) / (OSRM_MAX_POINTS - 1);
    coords = Array.from({ length: OSRM_MAX_POINTS }, (_, i) =>
      rawCoords[Math.round(i * step)],
    );
    coords[OSRM_MAX_POINTS - 1] = rawCoords[rawCoords.length - 1];
  }

  // OSRM coordinate string: "lng,lat;lng,lat;..."
  const coordStr = coords.map(([lng, lat]) => lng + ',' + lat).join(';');

  try {
    const url =
      OSRM_BASE + '/' + coordStr +
      '?overview=full&geometries=geojson&steps=false&tidy=true';

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return rawCoords;

    const data = await res.json() as {
      code: string;
      matchings?: Array<{ geometry: { type: string; coordinates: [number, number][] } }>;
    };

    if (data.code !== 'Ok' || !data.matchings?.length) return rawCoords;

    // Merge all matching segments (OSRM may split GPS trace into multiple)
    const snapped: [number, number][] = [];
    for (const m of data.matchings) {
      snapped.push(...m.geometry.coordinates);
    }
    return snapped;
  } catch {
    // Network error, timeout, or OSRM down — fall back to raw trace
    return rawCoords;
  }
}

export function useVehicleRoute(vehicleId: string | null): LatLng[] {
  const [points, setPoints] = useState<LatLng[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (!vehicleId) {
      setPoints([]);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    async function fetchRoute() {
      const to   = new Date();
      const from = new Date(to.getTime() - 30 * 60 * 1000); // last 30 min

      try {
        const res = await fetch(
          apiUrl + '/vehicles/' + vehicleId + '/route' +
          '?from=' + from.toISOString() + '&to=' + to.toISOString(),
        );
        if (!res.ok) return;

        const geojson = await res.json() as {
          type: string;
          coordinates: [number, number][];
        };

        if (geojson.type !== 'LineString' || !geojson.coordinates?.length) {
          setPoints([]);
          return;
        }

        // Snap raw GPS trace to road network, fall back to raw on error
        const snapped = await snapToRoads(geojson.coordinates);

        // Convert GeoJSON [lng, lat] → Leaflet [lat, lng]
        setPoints(snapped.map(([lng, lat]) => [lat, lng]));
      } catch {
        // silently ignore network errors
      }
    }

    fetchRoute();
    // Re-fetch every 10 s so the trail grows as the vehicle moves
    timerRef.current = setInterval(fetchRoute, 10_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [vehicleId]);

  return points;
}
