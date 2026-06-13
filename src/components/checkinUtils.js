// checkinUtils.js — tiny data helpers shared by the two posters for wiring
// live check-ins into the existing design. No styling, no DOM — pure data.
//
// The RouteMap's pulsing "last seen" pin is positioned by an INDEX into ROUTE
// (it never took an arbitrary lat/lng). To keep that contract unchanged while
// binding the pin to the newest real check-in, we snap the check-in's `ll` to
// the nearest ROUTE stop and pass that index along with a live "Last seen ·
// {place}" label. With no check-ins we return the poster's original default
// (idx 1, "Last seen · Hakone") so the design is pixel-identical pre-trip.

import { ROUTE } from '../tripData';

const DEFAULT = { idx: 1, label: 'Last seen · Hakone' };

/** nearest ROUTE index to [lat,lng] by squared euclidean distance (good enough
 *  for snapping a city-scale pin); null ll → null. */
function nearestRouteIdx(ll) {
  if (!Array.isArray(ll) || ll.length !== 2) return null;
  const [lat, lng] = ll;
  let best = null;
  let bestD = Infinity;
  ROUTE.forEach((r, i) => {
    if (!Array.isArray(r.ll)) return;
    const d = (r.ll[0] - lat) ** 2 + (r.ll[1] - lng) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * Resolve the RouteMap "last seen" pin index + label from a checkins array
 * (newest first). Falls back to the poster's original default when empty or
 * when the newest check-in lacks coordinates.
 * @returns {{ idx: number|null, label: string }}
 */
export function lastSeenFromCheckins(checkins) {
  if (!Array.isArray(checkins) || checkins.length === 0) return DEFAULT;
  const newest = checkins[0];
  const idx = nearestRouteIdx(newest.ll);
  const place = newest.place || '';
  return {
    idx: idx == null ? DEFAULT.idx : idx,
    label: place ? `Last seen · ${place}` : DEFAULT.label,
  };
}
