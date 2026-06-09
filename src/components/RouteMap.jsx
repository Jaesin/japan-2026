// RouteMap.jsx — real Leaflet/OpenStreetMap route, skinned to match a poster.
// Vanilla Leaflet (no react-leaflet) to keep deps minimal.
//   npm i leaflet
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { ROUTE } from '../tripData';

const TILE_URLS = {
  light:   'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
};

/**
 * skin        'bureau' (warm/light) | 'ink' (dark) — see map.css
 * tiles       'voyager' | 'light' | 'dark'
 * accent      route + pin color
 * lastSeenIdx index into ROUTE for the pulsing "last seen" pin (null = none)
 * label       small corner caption (null = none)
 * interactive false = static display (prototype default); true = pan/zoom
 */
export default function RouteMap({
  skin = 'bureau', tiles = 'voyager', height = 200,
  accent = '#C5302B', ink = '#211C15', lastSeenIdx = 1, label = null,
  interactive = false,
}) {
  const elRef = useRef(null);

  useEffect(() => {
    if (!elRef.current) return;
    const opts = interactive
      ? { zoomControl: true, attributionControl: false }
      : {
          zoomControl: false, attributionControl: false, dragging: false,
          scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false,
          boxZoom: false, keyboard: false, fadeAnimation: false,
        };
    const map = L.map(elRef.current, opts);

    L.tileLayer(TILE_URLS[tiles] || TILE_URLS.voyager, { subdomains: 'abcd', maxZoom: 18 }).addTo(map);

    const latlngs = ROUTE.map((r) => r.ll);
    map.fitBounds(L.latLngBounds(latlngs), { padding: [26, 26] });

    L.polyline(latlngs, { color: accent, weight: 2.5, opacity: 0.9, dashArray: '1 7', lineCap: 'round' }).addTo(map);

    ROUTE.forEach((r) => {
      L.marker(r.ll, {
        icon: L.divIcon({
          className: 'sun-pin-wrap',
          html: `<div class="sun-pin" style="--c:${accent};--ink:${ink}"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        }),
      }).addTo(map);
    });

    if (lastSeenIdx != null && ROUTE[lastSeenIdx]) {
      L.marker(ROUTE[lastSeenIdx].ll, {
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: 'live-pin-wrap',
          html: `<div class="live-pin" style="--c:${accent}"><span></span></div>`,
          iconSize: [22, 22], iconAnchor: [11, 11],
        }),
      }).addTo(map);
    }

    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => { clearTimeout(t); map.remove(); };
  }, [skin, tiles, accent, ink, lastSeenIdx, interactive]);

  return (
    <div className={`mapbox skin-${skin}`} style={{ position: 'relative', height }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
      {label && <div className="map-tag" style={{ '--c': accent }}>{label}</div>}
    </div>
  );
}
