// theme.js — design tokens for the two public-page modes.
// LIGHT = Direction A "Rising Sun"; DARK = Direction B "Sunset Express".

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
