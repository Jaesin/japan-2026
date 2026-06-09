// tripData.js — trip route + live "where are they today" date logic.
// No React; pure data + helpers. Swap ROUTE / TRIP_START when the itinerary
// is finalized. All other components derive from this file.

export const TRIP_START = new Date(2026, 6, 4); // Jul 4 2026 (month is 0-indexed), local time
export const TRIP_DAYS = 10;

// Placeholder route — replace with the real itinerary. `day` = trip-day the
// family arrives at that stop; `ll` = [lat, lng] for the map.
export const ROUTE = [
  { city: 'Tokyo',  jp: '東京', day: 1, ll: [35.6762, 139.6503] },
  { city: 'Hakone', jp: '箱根', day: 3, ll: [35.2324, 139.1069] },
  { city: 'Kyoto',  jp: '京都', day: 5, ll: [35.0116, 135.7681] },
  { city: 'Nara',   jp: '奈良', day: 7, ll: [34.6851, 135.8048] },
  { city: 'Osaka',  jp: '大阪', day: 9, ll: [34.6937, 135.5023] },
];

const MS_DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * What the public hero should say *today*.
 *  - phase 'before' → { daysToGo }            (countdown)
 *  - phase 'during' → { dayNum, stop }        (best-guess current stop)
 *  - phase 'after'  → {}                       (trip over)
 */
export function getTodayInfo(now = new Date()) {
  const today = startOfDay(now);
  const diff = Math.round((today - TRIP_START) / MS_DAY); // whole days since start
  if (diff < 0) return { phase: 'before', daysToGo: -diff };
  if (diff < TRIP_DAYS) {
    const dayNum = diff + 1;
    let stop = ROUTE[0];
    for (const r of ROUTE) if (r.day <= dayNum) stop = r; // last stop reached
    return { phase: 'during', dayNum, stop };
  }
  return { phase: 'after' };
}

// Sample dispatch/check-in data — replace with Firebase reads in production.
export const SAMPLE_CHECKINS = [
  { place: 'Fushimi Inari', jp: '伏見稲荷', note: 'Ten thousand vermilion gates — and not one we could walk past.', when: '2 days ago' },
  { place: 'Tsukiji Outer Market', jp: '築地', note: 'Sushi for breakfast at 7am. No regrets, only soy sauce.', when: '4 days ago' },
  { place: 'Hakone Ropeway', jp: '箱根', note: 'Fuji showed her face for exactly four minutes. We got the shot.', when: '5 days ago' },
];
