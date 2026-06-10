// features.js — registry of portal features the app knows how to render.
// A feature appears in nav/home only when its id is BOTH listed here AND
// flagged `true` in trips/japan-2026/config/features (spec 03: missing key =
// disabled). Add an entry as each feature ships. `ico` keys into ICONS
// (ui/primitives.jsx); `blurb` is the home-card one-liner.
//
// Settings is NOT a feature flag (spec 03) — it's always in nav for members.
//
// `group` keys into FEATURE_GROUPS (spec 03: Settings toggles are grouped like
// the specs index — Planning / During the trip / Other). Flag keys missing from
// this registry fall into 'other'.

export const FEATURE_GROUPS = [
  { id: 'planning', label: 'Planning' },
  { id: 'trip', label: 'During the trip' },
  { id: 'other', label: 'Other' },
];

export const FEATURES = [
  { id: 'tasks', label: 'Tasks', ico: 'tasks', path: '/portal/tasks', group: 'planning', blurb: "Who's doing what before we fly." },
  { id: 'packing', label: 'Packing', ico: 'packing', path: '/portal/packing', group: 'planning', blurb: "Who's got what covered." },
  { id: 'phrases', label: 'Phrasebook', ico: 'docs', path: '/portal/phrases', group: 'trip', blurb: 'Phrases, show-cards, and Japan tips.' },
  { id: 'transport', label: 'Transport', ico: 'itinerary', path: '/portal/transport', group: 'planning', blurb: 'Every leg — flights, trains, transfers.' },
];

export const HOME_ITEM = { id: 'home', label: 'Home', ico: 'today', path: '/portal' };
export const SETTINGS_ITEM = { id: 'settings', label: 'Settings', ico: 'settings', path: '/portal/settings' };
export const MORE_TAB = { id: 'more', label: 'More', ico: 'more' };
