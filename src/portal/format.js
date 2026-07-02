// format.js — portal formatting constants/helpers extracted from the design
// handoff's mockData.js (the only non-mock pieces of that file: the UI kit's
// CatChip/ResearchCard/SummaryBar read these). Mock *data* is not ported —
// live Firestore replaces it. Currency: ¥ primary, $ secondary (see fx.js for
// the live JPY/USD rate used by the budget ledger).

export const yen = (n) => '¥' + n.toLocaleString('en-US');
export const usd = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CAT_ICON = {
  transport: '🚄', lodging: '🛏', activity: '⛩', docs: '📄',
  prep: '🎒', money: '💴', food: '🍜', shopping: '🛍',
};
