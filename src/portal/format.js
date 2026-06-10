// format.js — portal formatting constants/helpers extracted from the design
// handoff's mockData.js (the only non-mock pieces of that file: the UI kit's
// CatChip/ResearchCard/SummaryBar read these). Mock *data* is not ported —
// live Firestore replaces it. Currency: ¥ primary, ฿ secondary.
// fxRate will eventually come from config/main (spec 00); this is the static
// fallback, like tripData.js is for the route.

export const JPY_TO_THB = 0.225;
export const yen = (n) => '¥' + n.toLocaleString('en-US');
export const baht = (n) => '฿' + Math.round(n * JPY_TO_THB).toLocaleString('en-US');

export const CAT_ICON = {
  transport: '🚄', lodging: '🛏', activity: '⛩', docs: '📄',
  prep: '🎒', money: '💴', food: '🍜', shopping: '🛍',
};
