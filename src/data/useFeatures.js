// useFeatures — live feature-flag map from trips/japan-2026/config/features
// (spec 03). The doc is public-readable; keys are feature ids, values bools.
// Missing key = disabled; 'settings' is never a flag (always-on, enforced by
// rules + never consulted here). Exposes the raw keys so the Settings page
// can render its toggle list from the keys present in the doc.

import { useDoc } from './useDoc.js';

export function useFeatures() {
  const { data, loading, error } = useDoc(['config', 'features']);
  // Strip the synthetic `id` field useDoc injects — flag keys only.
  let features = {};
  if (data) {
    // eslint-disable-next-line no-unused-vars
    const { id, ...flags } = data;
    features = flags;
  }
  return { features, loading, error };
}

/** Missing key = disabled; only an explicit `true` enables. */
export function isEnabled(features, key) {
  return features?.[key] === true;
}
