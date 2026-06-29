'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle } from '@/types/vehicle';

const STATUS_COLOR: Record<string, string> = {
  online:  '#22c55e',
  offline: '#6b7280',
  alert:   '#ef4444',
};

interface TileCfg { url: string; attr: string; sub?: string }
const TILE_LAYERS: Record<string, TileCfg> = {
  Dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',      attr: '&copy; OpenStreetMap &copy; CARTO',   sub: 'abcd' },
  Streets:   { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                  attr: '&copy; OpenStreetMap contributors',    sub: 'abc'  },
  Light:     { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',     attr: '&copy; OpenStreetMap &copy; CARTO',   sub: 'abcd' },
  Satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri' },
  Topo:      { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                   attr: '&copy; OpenStreetMap, SRTM &copy; OpenTopoMap', sub: 'abc' },
};

function pinSVG(fill: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">' +
    '<ellipse cx="18" cy="46" rx="7" ry="2" fill="rgba(0,0,0,.3)"/>' +
    '<path d="M18 2C10.27 2 4 8.27 4 16C4 27 18 46 18 46S32 27 32 16C32 8.27 25.73 2 18 2Z"' +
    ' fill="' + fill + '" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="18" cy="16" r="9" fill="rgba(255,255,255,.18)"/>' +
    '<rect x="10" y="12" width="16" height="10" rx="2.5" fill="#fff"/>' +
    '<rect x="12.5" y="8.5" width="11" height="7" rx="2" fill="#fff" fill-opacity=".8"/>' +
    '<rect x="13" y="8.5" width="10" height="2" rx="1" fill="' + fill + '"/>' +
    '<rect x="7" y="13" width="3" height="4" rx="1.5" fill="#fff"/>' +
    '<rect x="26" y="13" width="3" height="4" rx="1.5" fill="#fff"/>' +
    '</svg>'
  );
}

function makeIcon(status: string): L.DivIcon {
  const fill    = STATUS_COLOR[status] ?? STATUS_COLOR.online;
  const isAlert = status === 'alert';
  return L.divIcon({
    className:   'leaflet-div-icon fp-pin' + (isAlert ? ' fp-pin--alert' : ''),
    html:        pinSVG(fill),
    iconSize:    [36, 48],
    iconAnchor:  [18, 48],
    popupAnchor: [0, -52],
  });
}

function popupHTML(v: Vehicle): string {
  const c   = STATUS_COLOR[v.status] ?? STATUS_COLOR.online;
  const bat = v.battery < 20 ? '#ef4444' : v.battery < 50 ? '#f59e0b' : '#22c55e';
  const spd = v.speed > 120  ? '#ef4444' : '#f1f5f9';
  const pct = Math.min(100, Math.max(0, v.battery));
  return (
    '<div style="font:13px/1.4 system-ui,sans-serif;padding:12px 15px;min-width:200px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;' +
    'padding-bottom:9px;margin-bottom:9px;border-bottom:1px solid #1e293b;">' +
    '<b style="font-size:15px;color:#f1f5f9;">' + v.vehicleId + '</b>' +
    '<span style="font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 8px;' +
    'border-radius:4px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' +
    v.status.toUpperCase() + '</span>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">' +
    '<span style="color:#64748b;">Speed</span>' +
    '<b style="color:' + spd + ';">' + v.speed.toFixed(1) + ' km/h</b>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;">' +
    '<span style="color:#64748b;">Battery</span>' +
    '<div style="display:flex;align-items:center;gap:7px;">' +
    '<div style="width:50px;height:5px;border-radius:3px;background:#1e293b;overflow:hidden;">' +
    '<div style="width:' + pct + '%;height:100%;border-radius:3px;background:' + bat + ';"></div></div>' +
    '<b style="color:' + bat + ';">' + v.battery.toFixed(0) + '%</b>' +
    '</div></div>' +
    '<div style="color:#334155;font-size:11px;text-align:right;border-top:1px solid #1e293b;padding-top:7px;">' +
    new Date(v.timestamp).toLocaleTimeString() + '</div>' +
    '</div>'
  );
}

const LEGEND_ITEMS: Array<[string, string]> = [
  ['#22c55e', 'Online'],
  ['#ef4444', 'Alert'],
  ['#6b7280', 'Offline'],
];

function buildLegendEl(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'background:rgba(15,23,42,.93);border:1px solid #1e293b;border-radius:10px;' +
    'padding:10px 13px;font:12px/1.5 system-ui,sans-serif;color:#cbd5e1;' +
    'box-shadow:0 4px 20px rgba(0,0,0,.5);';

  const title = document.createElement('div');
  title.style.cssText =
    'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;' +
    'color:#475569;margin-bottom:8px;';
  title.textContent = 'Status';
  wrap.appendChild(title);

  LEGEND_ITEMS.forEach(function(item) {
    const color = item[0];
    const label = item[1];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;margin-bottom:5px;';
    const dot = document.createElement('span');
    dot.style.cssText =
      'width:9px;height:9px;border-radius:50%;flex-shrink:0;background:' +
      color + ';box-shadow:0 0 4px ' + color + '88;';
    const txt = document.createElement('span');
    txt.textContent = label;
    row.appendChild(dot);
    row.appendChild(txt);
    wrap.appendChild(row);
  });
  return wrap;
}

function addLegend(map: L.Map): void {
  const LegendControl = L.Control.extend({
    onAdd: function(): HTMLElement {
      const el = buildLegendEl();
      L.DomEvent.disableClickPropagation(el);
      return el;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (LegendControl as any)({ position: 'bottomleft' }).addTo(map);
}

interface Props {
  vehicles:        Record<string, Vehicle>;
  selectedId:      string | null;
  onVehicleSelect: (id: string) => void;
  routeLatLngs:    [number, number][];  // [lat, lng] pairs — drawn as a Leaflet Polyline
}
interface MarkerEntry { marker: L.Marker; status: string }

export default function MapView({ vehicles, selectedId, onVehicleSelect, routeLatLngs }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const markersRef    = useRef<Record<string, MarkerEntry>>({});
  const routeGroupRef = useRef<L.LayerGroup | null>(null);
  const firstFitRef   = useRef(false);
  const onSelectRef   = useRef(onVehicleSelect);
  onSelectRef.current = onVehicleSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center:      [20.5937, 78.9629],
      zoom:        5,
      zoomControl: false,
    });

    const bases: Record<string, L.TileLayer> = {};
    Object.entries(TILE_LAYERS).forEach(function(entry) {
      const name = entry[0];
      const cfg  = entry[1];
      bases[name] = L.tileLayer(cfg.url, {
        attribution: cfg.attr,
        maxZoom:     19,
        subdomains:  cfg.sub || '',
      });
    });
    bases['Dark'].addTo(map);
    L.control.layers(bases, {}, { position: 'topright', collapsed: true }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    addLegend(map);

    mapRef.current = map;
    setTimeout(function() { map.invalidateSize(); }, 60);

    // Re-measure when container resizes (e.g. mobile tab switch)
    const observer = new ResizeObserver(function() { map.invalidateSize(); });
    observer.observe(containerRef.current!);

    return function() {
      observer.disconnect();
      if (routeGroupRef.current) { routeGroupRef.current.clearLayers(); routeGroupRef.current.remove(); routeGroupRef.current = null; }
      // ⚠️ CRITICAL: clear markersRef before destroying the map.
      // React 18 StrictMode double-mounts: without this cleanup, markersRef
      // still holds markers from the destroyed map, so the next mount's
      // sync effect calls setLatLng() on dead markers instead of addTo(newMap).
      Object.values(markersRef.current).forEach(function(e) { e.marker.remove(); });
      markersRef.current = {};
      firstFitRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const list    = Object.values(vehicles);
    const liveIds = new Set(Object.keys(vehicles));

    list.forEach(function(v) {
      const ll: L.LatLngTuple = [v.lat, v.lng];
      const entry = markersRef.current[v.vehicleId];

      if (entry) {
        entry.marker.setLatLng(ll);
        if (entry.status !== v.status) {
          entry.marker.setIcon(makeIcon(v.status));
          entry.status = v.status;
        }
        const popup = entry.marker.getPopup();
        if (popup && popup.isOpen()) popup.setContent(popupHTML(v));
      } else {
        const marker = L.marker(ll, { icon: makeIcon(v.status), riseOnHover: true })
          .addTo(map)
          .bindPopup(popupHTML(v), { className: 'fp-popup', closeButton: true, autoPan: false });
        marker.on('click', function() {
          onSelectRef.current(v.vehicleId);
          marker.openPopup();
        });
        markersRef.current[v.vehicleId] = { marker: marker, status: v.status };
      }
    });

    Object.keys(markersRef.current).forEach(function(id) {
      if (!liveIds.has(id)) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
      }
    });

    if (!firstFitRef.current && list.length > 0) {
      firstFitRef.current = true;
      try {
        const lls = list.map(function(v) { return L.latLng(v.lat, v.lng); });
        const bounds = L.latLngBounds(lls);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
        }
      } catch (_e) { /* ignore */ }
    }
  }, [vehicles]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const entry = markersRef.current[selectedId];
    if (!entry) return;
    mapRef.current.flyTo(entry.marker.getLatLng(), 14, { duration: 1 });
    const v = vehicles[selectedId];
    if (v) entry.marker.setPopupContent(popupHTML(v));
    entry.marker.openPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    Object.entries(markersRef.current).forEach(function(pair) {
      const id    = pair[0];
      const entry = pair[1];
      entry.marker.setZIndexOffset(id === selectedId ? 500 : 0);
      const el = entry.marker.getElement();
      if (!el) return;
      el.style.filter =
        id === selectedId
          ? 'drop-shadow(0 0 10px rgba(255,255,255,.6)) drop-shadow(0 2px 6px rgba(0,0,0,.7))'
          : 'drop-shadow(0 2px 6px rgba(0,0,0,.55))';
    });
  }, [selectedId]);

  // ── Route polyline — redraws whenever routeLatLngs changes ──────────────
  useEffect(() => {
    const map = mapRef.current;

    // Tear down the previous group (polylines + endpoint markers)
    if (routeGroupRef.current) {
      routeGroupRef.current.clearLayers();
      routeGroupRef.current.remove();
      routeGroupRef.current = null;
    }

    if (!map || routeLatLngs.length < 2) return;

    const group = L.layerGroup().addTo(map);

    // Shadow line (wide + dim) + bright line on top → depth effect
    L.polyline(routeLatLngs, {
      color: '#1e3a5f', weight: 7, opacity: 0.5,
      lineCap: 'round', lineJoin: 'round',
    }).addTo(group);

    L.polyline(routeLatLngs, {
      color: '#60a5fa', weight: 3, opacity: 0.95,
      lineCap: 'round', lineJoin: 'round',
    }).addTo(group);

    // Mark only the route START with a small dot so the user knows where
    // the 30-min trail begins. The current position is already shown by the
    // vehicle pin marker, so no end-dot is needed.
    const startPt = routeLatLngs[0];
    L.circleMarker(startPt, {
      radius: 4, color: '#1d4ed8', fillColor: '#93c5fd', fillOpacity: 1, weight: 2,
    }).bindTooltip('Route start (30 min ago)', { direction: 'top' }).addTo(group);

    routeGroupRef.current = group;
  }, [routeLatLngs]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
