// TripMap — portal-side vanilla Leaflet map for the Live Trip Map (spec 24).
//
// This deliberately REUSES the patterns from src/components/RouteMap.jsx
// (L.divIcon custom pins, dashed polyline, skinned tile layer, a useEffect
// that fully tears the map down on unmount to dodge "container already
// initialized" on route changes) WITHOUT importing it. RouteMap.jsx and
// everything under src/components/ are protected public-poster files from the
// design handoff — we keep them pristine and accept slight duplication here.
//
// The map instance is created once and stored in a ref. Pin/line layers live
// in L.layerGroups that we clear and rebuild when data or filters change, so we
// never re-init the whole map on a data tick.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../components/map.css'; // tile-skin classes + .sun-pin (read-only reuse)
import './tripmap.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
const ACCENT = '#C5302B';
const INK = '#211C15';

/* per-day color: reuse the 10-step token palette (tokens.css --day-1..10),
   wrapping for days beyond 10. divIcon HTML can't read CSS vars from the host,
   so we resolve them off :root at render time. */
function dayColor(dayNum) {
  const idx = ((Number(dayNum) || 1) - 1) % 10 + 1;
  if (typeof window === 'undefined') return ACCENT;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--day-${idx}`)
    .trim();
  return v || ACCENT;
}

/**
 * markers : array of {
 *   id, ll:[lat,lng], kind:'route'|'itin'|'stay'|'me',
 *   label, dayNum?, time?, onTap?
 * }
 * polyline : array of [lat,lng] to draw as a dashed line (or null)
 * fitKey   : changing this string re-fits the map to current markers
 * onFit    : (map) => void — called after layers are (re)built when fitKey
 *            changes, so the page can drive "fit today" / "fit route" bounds.
 */
export default function TripMap({ markers = [], polyline = null, fitKey = '', onFit }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const pinLayerRef = useRef(null);
  const lineLayerRef = useRef(null);

  // init once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 18 }).addTo(map);
    map.setView([35.5, 137.5], 6); // rough Japan view until first fit
    pinLayerRef.current = L.layerGroup().addTo(map);
    lineLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      pinLayerRef.current = null;
      lineLayerRef.current = null;
    };
  }, []);

  // rebuild line layer when polyline changes
  useEffect(() => {
    const layer = lineLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (Array.isArray(polyline) && polyline.length > 1) {
      L.polyline(polyline, {
        color: ACCENT, weight: 2.5, opacity: 0.9, dashArray: '1 7', lineCap: 'round',
      }).addTo(layer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(polyline)]);

  // rebuild pin layer when markers change
  useEffect(() => {
    const layer = pinLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    markers.forEach((m) => {
      if (!Array.isArray(m.ll) || m.ll.length !== 2) return;
      let icon;
      if (m.kind === 'route') {
        icon = L.divIcon({
          className: 'sun-pin-wrap',
          html: `<div class="sun-pin" style="--c:${ACCENT};--ink:${INK}"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
      } else if (m.kind === 'itin') {
        const c = dayColor(m.dayNum);
        icon = L.divIcon({
          className: 'tm-pin-wrap',
          html: `<div class="tm-pin" style="--c:${c}">${m.seq ?? ''}</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
      } else if (m.kind === 'stay') {
        icon = L.divIcon({
          className: 'tm-pin-wrap',
          html: `<div class="tm-pin tm-pin--bed" style="--c:${INK}">🛏</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        });
      } else if (m.kind === 'me') {
        icon = L.divIcon({
          className: 'tm-me-wrap',
          html: '<div class="tm-me"><span></span></div>',
          iconSize: [22, 22], iconAnchor: [11, 11],
        });
      }
      const marker = L.marker(m.ll, { icon, title: m.label || '', zIndexOffset: m.kind === 'me' ? 1200 : 0 });
      if (m.onTap) marker.on('click', () => m.onTap(m));
      marker.addTo(layer);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers.map((m) => [m.id, m.ll, m.kind, m.dayNum, m.seq]))]);

  // fit bounds when fitKey changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (onFit) { onFit(map); return; }
    const lls = markers.filter((m) => Array.isArray(m.ll) && m.ll.length === 2).map((m) => m.ll);
    if (lls.length > 1) map.fitBounds(L.latLngBounds(lls), { padding: [40, 40] });
    else if (lls.length === 1) map.setView(lls[0], 13);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <div className="mapbox skin-bureau tm-box">
      <div ref={elRef} className="tm-canvas" />
    </div>
  );
}
