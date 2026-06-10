// features.js — registry of portal features the app knows how to render.
// A feature appears in nav/home only when its id is BOTH listed here AND
// flagged `true` in trips/japan-2026/config/features (spec 03: missing key =
// disabled). Add an entry as each feature ships. `ico` keys into ICONS
// (ui/primitives.jsx); `blurb` is the home-card one-liner.
//
// Settings is NOT a feature flag (spec 03) — it's always in nav for members.

export const FEATURES = [
  { id: 'tasks', label: 'Tasks', ico: 'tasks', path: '/portal/tasks', blurb: "Who's doing what before we fly." },
];

export const HOME_ITEM = { id: 'home', label: 'Home', ico: 'today', path: '/portal' };
export const SETTINGS_ITEM = { id: 'settings', label: 'Settings', ico: 'settings', path: '/portal/settings' };
export const MORE_TAB = { id: 'more', label: 'More', ico: 'more' };
