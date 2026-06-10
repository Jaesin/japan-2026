// useDoc — live Firestore single-document subscription (spec 00).
// Paths are trip-relative: useDoc(['config', 'features']) subscribes to
// trips/japan-2026/config/features. Returns { data, exists, loading, error };
// data is { id, ...fields } or null while loading / when the doc is missing.

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, TRIP_ID } from '../firebase.js';

export function useDoc(pathSegments) {
  const [state, setState] = useState({ data: null, exists: false, loading: true, error: null });
  const key = JSON.stringify(pathSegments);

  useEffect(() => {
    const segments = JSON.parse(key);
    const ref = doc(db, 'trips', TRIP_ID, ...segments);
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      ref,
      (snap) => setState({
        data: snap.exists() ? { id: snap.id, ...snap.data() } : null,
        exists: snap.exists(),
        loading: false,
        error: null,
      }),
      (error) => setState({ data: null, exists: false, loading: false, error }),
    );
  }, [key]);

  return state;
}
