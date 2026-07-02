// fx.js — live JPY/USD exchange rate for the budget ledger (spec 14).
// Uses Frankfurter (frankfurter.dev), a free, keyless, CORS-enabled API
// backed by ECB reference rates. Cached in localStorage so the rate survives
// reloads and is available offline; a static fallback covers first-load
// offline and any fetch failure.

import { useEffect, useState } from 'react';

const FX_CACHE_KEY = 'japan2026:fxRate';
const FX_CACHE_MS = 12 * 60 * 60 * 1000; // 12h

// Static fallback: JPY per 1 USD. Only used when no cached rate exists and
// the live fetch fails (e.g. first load while offline).
export const FALLBACK_FX_JPY_PER_USD = 162;

function readCache() {
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const { rate, at } = JSON.parse(raw);
    if (typeof rate !== 'number' || !rate) return null;
    return { rate, stale: Date.now() - at > FX_CACHE_MS };
  } catch {
    return null;
  }
}

function writeCache(rate) {
  try {
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, at: Date.now() }));
  } catch {
    /* storage unavailable (private mode, quota) — the rate just won't persist */
  }
}

/** Fetch the current JPY-per-USD rate from Frankfurter. Throws on failure. */
export async function fetchLiveFxRate() {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=JPY');
  if (!res.ok) throw new Error(`frankfurter: ${res.status}`);
  const body = await res.json();
  const rate = body?.rates?.JPY;
  if (typeof rate !== 'number' || !rate) throw new Error('frankfurter: missing JPY rate');
  writeCache(rate);
  return rate;
}

/**
 * useFxRate() — JPY-per-USD rate for new budget/transport entries. Returns a
 * usable rate immediately (cache or static fallback), then refreshes in the
 * background when the cache is missing or stale.
 */
export function useFxRate() {
  const cached = readCache();
  const [rate, setRate] = useState(cached?.rate ?? FALLBACK_FX_JPY_PER_USD);

  useEffect(() => {
    if (cached && !cached.stale) return;
    let cancelled = false;
    fetchLiveFxRate().then((r) => { if (!cancelled) setRate(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return rate;
}
