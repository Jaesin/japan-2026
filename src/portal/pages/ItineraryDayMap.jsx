// ItineraryDayMap — vanilla Leaflet day map for the itinerary (spec 12).
// Mirrors src/components/RouteMap.jsx's approach: L.divIcon custom pins
// (here numbered in timeline order), a dashed polyline connecting the stops,
// and a useEffect lifecycle that fully tears the map down on unmount to dodge
// "map container already initialized" errors on route changes.
//
// `stops` is the active day's activities that have `ll` (already in timeline
// order). Each gets a numbered pin; <2 stops → no polyline, just the pin(s).

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../components/map.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';

export default function ItineraryDayMap({ stops, height = 260 }) {
  const elRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || !stops.length) return undefined;

    const map = L.map(elRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 18 }).addTo(map);

    const latlngs = stops.map((s) => s.ll);
    if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [34, 34] });
      L.polyline(latlngs, { color: '#C5302B', weight: 2.5, opacity: 0.9, dashArray: '1 7', lineCap: 'round' }).addTo(map);
    } else {
      map.setView(latlngs[0], 14);
    }

    stops.forEach((s, i) => {
      L.marker(s.ll, {
        title: s.title || '',
        icon: L.divIcon({
          className: 'itin-pin-wrap',
          html: `<div class="itin-pin">${i + 1}</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        }),
      }).addTo(map);
    });

    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => { clearTimeout(t); map.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stops.map((s) => [s.id, s.ll]))]);

  if (!stops.length) {
    return <div className="itin-map-empty">No mapped stops yet.</div>;
  }
  return (
    <div className="mapbox skin-bureau itin-map" style={{ position: 'relative', height }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
