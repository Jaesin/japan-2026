// mutate.js — write helpers stamping the spec-00 convention fields:
// createdAt / updatedAt (serverTimestamp) and createdBy (current uid).
// Paths are trip-relative, same as useCollection/useDoc.
//
// Activity-feed logging (spec 41): every helper accepts an OPTIONAL final
// `opts` argument. When `opts.activity` (alias `opts.log`) is provided, the
// helper ALSO writes an `activity/{autoId}` doc describing the change. This is
// strictly OPT-IN and ADDITIVE: callers that pass no opts behave exactly as
// before. The activity write is fire-and-forget — it runs AFTER the primary
// mutation resolves and its failure is swallowed, so logging can never reject
// the caller's write. Callers never await the log.
//
//   opts.activity = {
//     verb?:  'added' | 'updated' | 'completed' | 'removed'  // helper default
//     title:  string   // precomputed human line ("Book Shinkansen tickets")
//     link?:  string   // portal hash route to the item ('/portal/tasks')
//     target?: string  // collection name; defaults to the first path segment
//     by?:    string   // explicit author override (e.g. 'hermes')
//   }

import {
  addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { auth, db, TRIP_ID } from '../firebase.js';

const createdBy = () => auth.currentUser?.uid ?? 'unknown';

/**
 * Write a single activity/{autoId} doc. Fire-and-forget: callers do not await
 * this and any rejection is swallowed by the call sites below. Spec 41 shape:
 * { at, byUid, by?, verb, target, title, link? }.
 */
function logActivity({ verb, target, title, link, by }) {
  const entry = {
    at: serverTimestamp(),
    byUid: auth.currentUser?.uid ?? 'unknown',
    verb,
    target,
    title,
  };
  if (by) entry.by = by;
  if (link) entry.link = link;
  return addDoc(collection(db, 'trips', TRIP_ID, 'activity'), entry);
}

/**
 * Run an opts.activity / opts.log spec as a non-blocking activity write.
 * `defaultVerb` and `defaultTarget` fill in fields the caller didn't supply.
 * Never throws — a logging failure must not surface to the caller.
 */
function maybeLog(opts, defaultVerb, defaultTarget) {
  const spec = opts && (opts.activity || opts.log);
  if (!spec || !spec.title) return;
  try {
    logActivity({
      verb: spec.verb || defaultVerb,
      target: spec.target || defaultTarget,
      title: spec.title,
      link: spec.link,
      by: spec.by,
    }).catch(() => {});
  } catch {
    /* swallow — logging is best-effort only */
  }
}

/**
 * Add a doc with an auto id. addItem(['tasks'], { title }) → DocumentReference.
 * Optional `opts.activity` logs an 'added' activity entry (see file header).
 */
export function addItem(collectionSegments, data, opts = {}) {
  const p = addDoc(collection(db, 'trips', TRIP_ID, ...collectionSegments), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: createdBy(),
  });
  return p.then((ref) => { maybeLog(opts, 'added', collectionSegments[0]); return ref; });
}

/**
 * Create/overwrite a doc at a known id (slug collections, spec 00).
 *   setItem(['itinerary', '2026-07-06'], data, { merge: true })
 * Optional `opts.activity` logs an 'updated' activity entry (see file header).
 */
export function setItem(docSegments, data, opts = {}) {
  const { merge = false } = opts;
  const p = setDoc(
    doc(db, 'trips', TRIP_ID, ...docSegments),
    {
      ...data,
      ...(merge ? {} : { createdAt: serverTimestamp(), createdBy: createdBy() }),
      updatedAt: serverTimestamp(),
    },
    { merge },
  );
  return p.then((res) => { maybeLog(opts, 'updated', docSegments[0]); return res; });
}

/**
 * Patch fields on an existing doc. updateItem(['tasks', id], { status: 'done' }).
 * Optional `opts.activity` logs an 'updated' activity entry (see file header).
 */
export function updateItem(docSegments, patch, opts = {}) {
  const p = updateDoc(doc(db, 'trips', TRIP_ID, ...docSegments), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  return p.then((res) => { maybeLog(opts, 'updated', docSegments[0]); return res; });
}

/**
 * Hard delete (spec 00: no soft-delete machinery). removeItem(['tasks', id]).
 * Optional `opts.activity` logs a 'removed' activity entry (see file header).
 */
export function removeItem(docSegments, opts = {}) {
  const p = deleteDoc(doc(db, 'trips', TRIP_ID, ...docSegments));
  return p.then((res) => { maybeLog(opts, 'removed', docSegments[0]); return res; });
}
