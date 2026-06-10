// useCollection — live Firestore collection subscription (spec 00).
// Paths are trip-relative: useCollection(['tasks']) subscribes to
// trips/japan-2026/tasks. Returns { docs, loading, error } where docs is
// [{ id, ...data }]. Offline-first: snapshots serve from the persistent
// cache while the network catches up.
//
// opts (all optional, must be JSON-serializable — they key the effect):
//   where:   array of [field, op, value] tuples
//   orderBy: array of field names or [field, 'asc'|'desc'] tuples
//   limit:   number

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db, TRIP_ID } from '../firebase.js';

export function useCollection(pathSegments, opts = {}) {
  const [state, setState] = useState({ docs: [], loading: true, error: null });
  // Stringify so fresh array/object literals don't resubscribe every render.
  const key = JSON.stringify([pathSegments, opts.where, opts.orderBy, opts.limit]);

  useEffect(() => {
    const [segments, whereOpts, orderOpts, limitOpt] = JSON.parse(key);
    const clauses = [
      ...(whereOpts || []).map((w) => where(...w)),
      ...(orderOpts || []).map((o) => orderBy(...(Array.isArray(o) ? o : [o]))),
      ...(limitOpt ? [limit(limitOpt)] : []),
    ];
    const ref = collection(db, 'trips', TRIP_ID, ...segments);
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      clauses.length ? query(ref, ...clauses) : ref,
      (snap) => setState({
        docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        loading: false,
        error: null,
      }),
      (error) => setState({ docs: [], loading: false, error }),
    );
  }, [key]);

  return state;
}
