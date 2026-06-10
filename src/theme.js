// theme.js — design tokens for the two modes (public poster + portal).
// LIGHT = Direction A "Rising Sun"; DARK = Direction B "Sunset Express".
// The portal itself is themed with CSS custom properties
// (src/portal/styles/tokens.css) selected by prefers-color-scheme; the
// lightExt/darkExt/dayColors exports below are the JS mirror for code that
// needs raw token *values* (e.g. Leaflet divIcon day colors, charts).
// Keep them in sync with tokens.css.

export const light = {
  paper:   '#F4ECD8', // page background (aged cream)
  cardBg:  '#FBF6E9', // dispatch card background
  ink:     '#211C15', // primary text / Fuji silhouette
  accent:  '#C5302B', // hinomaru red (sun, route, pins)
  gold:    '#F0B23E', // countdown number on the ink band
  muted:   '#8A7C62', // eyebrow labels / secondary text on paper
  line:    'rgba(33,28,21,0.14)',
  fonts: {
    display: "'Anton', sans-serif",
    body:    "'Archivo', sans-serif",
    jp:      "'Zen Old Mincho', serif",
  },
  map: { skin: 'bureau', tiles: 'voyager' },
};

export const dark = {
  night:   '#1B2A4A', // page background (indigo night)
  indigo:  '#243a63', // sunset band 1
  pink:    '#E3A79B', // sunset band 2
  orange:  '#D9622B', // sunset band 3 + countdown accent
  accent:  '#EE3C2B', // sun / route / pins
  cream:   '#F6EEDD', // primary text
  muted:   'rgba(246,238,221,0.55)',
  cardBg:  'rgba(255,255,255,0.05)',
  line:    'rgba(246,238,221,0.16)',
  fuji:    { fill: '#15203a', snow: '#2c3f66' },
  fonts: {
    display: "'Bebas Neue', sans-serif",
    body:    "'Space Grotesk', sans-serif",
  },
  map: { skin: 'ink', tiles: 'dark' },
};

// ---- Portal extensions (from the portal design handoff) --------------------
// Additions only — nothing above changes; the public posters depend on it.

// 10-step day palette (shared, oklch, retro-muted). Reads on both paper
// (#F4ECD8) and night (#1B2A4A). Accent-red region kept clear so day colors
// never read as "alert". Day N → ROUTE/itinerary day N.
export const dayColors = [
  'oklch(0.70 0.13 50)',  // Day 1  terracotta  (Tokyo)
  'oklch(0.74 0.12 85)',  // Day 2  amber
  'oklch(0.69 0.11 120)', // Day 3  olive       (Hakone)
  'oklch(0.65 0.11 155)', // Day 4  pine        (Kyoto)
  'oklch(0.67 0.09 195)', // Day 5  teal        (Kyoto)
  'oklch(0.65 0.10 230)', // Day 6  sea blue    (Nara)
  'oklch(0.62 0.11 262)', // Day 7  indigo blue (Osaka)
  'oklch(0.62 0.12 300)', // Day 8  violet      (Osaka)
  'oklch(0.64 0.12 340)', // Day 9  rose
  'oklch(0.58 0.10 25)',  // Day 10 brick
];

// Direction A "Rising Sun" (light) additions
export const lightExt = {
  surface2:    '#EFE5CC', // sunk / progress track
  // inputs
  inputBg:     '#FFFCF4',
  inputBorder: 'rgba(33,28,21,0.28)',
  inputFocus:  '#C5302B',
  placeholder: 'rgba(33,28,21,0.40)',
  // interaction states
  pressOverlay:'rgba(33,28,21,0.07)',
  disabledBg:  'rgba(33,28,21,0.10)',
  disabledText:'rgba(33,28,21,0.34)',
  // semantics
  success: '#4F7A45', successBg: 'rgba(79,122,69,0.14)',
  warning: '#B5781F', warningBg: 'rgba(181,120,31,0.16)',
  danger:  '#BE2C20', dangerBg:  'rgba(190,44,32,0.12)',
  // selected chip = inked stamp
  chipSelBg: '#211C15', chipSelText: '#F4ECD8',
  accentPress: '#A5241F',
  lineStrong: 'rgba(33,28,21,0.30)',
};

// Direction B "Sunset Express" (dark) additions
export const darkExt = {
  surface2:    'rgba(255,255,255,0.03)',
  inputBg:     'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(246,238,221,0.24)',
  inputFocus:  '#D9622B',
  placeholder: 'rgba(246,238,221,0.38)',
  pressOverlay:'rgba(246,238,221,0.10)',
  disabledBg:  'rgba(246,238,221,0.08)',
  disabledText:'rgba(246,238,221,0.30)',
  success: '#6FB07E', successBg: 'rgba(111,176,126,0.16)',
  warning: '#E0A84C', warningBg: 'rgba(224,168,76,0.16)',
  danger:  '#F0533C', dangerBg:  'rgba(240,83,60,0.14)',
  chipSelBg: '#F6EEDD', chipSelText: '#1B2A4A',
  accentPress: '#CF3322',
  lineStrong: 'rgba(246,238,221,0.34)',
  highlight: '#D9622B', // countdown number (orange in dark)
};
