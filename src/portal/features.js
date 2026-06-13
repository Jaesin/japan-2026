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
  { id: 'budget', label: 'Budget', ico: 'budget', path: '/portal/budget', group: 'planning', blurb: 'Estimates and actual spend.' },
  { id: 'accommodations', label: 'Stays', ico: 'bed', path: '/portal/accommodations', group: 'planning', blurb: "Tonight's bed, codes, and gaps." },
  { id: 'documents', label: 'Docs', ico: 'docs', path: '/portal/documents', group: 'planning', blurb: 'Refs, contacts, and emergency numbers.' },
  { id: 'journal', label: 'Journal', ico: 'journal', path: '/portal/journal', group: 'trip', blurb: 'A 60-second nightly entry.' },
  { id: 'research', label: 'Research', ico: 'research', path: '/portal/research', group: 'planning', blurb: 'Shared shortlist of places and finds.' },
  { id: 'food', label: 'Food', ico: 'food', path: '/portal/food', group: 'planning', blurb: 'Eat shortlist the kids can vote on.' },
  { id: 'checkins', label: 'Check-ins', ico: 'pin', path: '/portal/checkins', group: 'trip', blurb: 'Post a dispatch to the public page.' },
  { id: 'postcards', label: 'Postcards', ico: 'pin', path: '/portal/postcards', group: 'trip', blurb: 'Photo dispatches to the public page.' },
  { id: 'itinerary', label: 'Itinerary', ico: 'itinerary', path: '/portal/itinerary', group: 'planning', blurb: 'The day-by-day plan.' },
  { id: 'map', label: 'Map', ico: 'map', path: '/portal/map', group: 'trip', blurb: 'Everything on one map.' },
  { id: 'activity', label: 'Activity', ico: 'today', path: '/portal/activity', group: 'other', blurb: 'What changed, latest first.' },
  // Today dashboard (spec 20): the /portal landing page itself, not a nav tab.
  // `hidden` keeps it out of the bottom tabs / sidebar / home feature-card list,
  // but it still shows as a Settings toggle (the family flips it on as the trip
  // nears). No `path` — it's not routed separately; PortalHome renders it.
  { id: 'today', label: 'Today dashboard', ico: 'today', group: 'trip', hidden: true, blurb: 'During-trip home screen.' },
];

export const HOME_ITEM = { id: 'home', label: 'Home', ico: 'today', path: '/portal' };
export const SETTINGS_ITEM = { id: 'settings', label: 'Settings', ico: 'settings', path: '/portal/settings' };
export const MORE_TAB = { id: 'more', label: 'More', ico: 'more' };
