// mutate.js — write helpers stamping the spec-00 convention fields:
// createdAt / updatedAt (serverTimestamp) and createdBy (current uid).
// Paths are trip-relative, same as useCollection/useDoc.
// (The activity-feed write from spec 00 is deferred until spec 41 is built.)

import {
  addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { auth, db, TRIP_ID } from '../firebase.js';

const createdBy = () => auth.currentUser?.uid ?? 'unknown';

/** Add a doc with an auto id. addItem(['tasks'], { title }) → DocumentReference */
export function addItem(collectionSegments, data) {
  return addDoc(collection(db, 'trips', TRIP_ID, ...collectionSegments), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: createdBy(),
  });
}

/** Create/overwrite a doc at a known id (slug collections, spec 00).
    setItem(['itinerary', '2026-07-06'], data, { merge: true }) */
export function setItem(docSegments, data, { merge = false } = {}) {
  return setDoc(
    doc(db, 'trips', TRIP_ID, ...docSegments),
    {
      ...data,
      ...(merge ? {} : { createdAt: serverTimestamp(), createdBy: createdBy() }),
      updatedAt: serverTimestamp(),
    },
    { merge },
  );
}

/** Patch fields on an existing doc. updateItem(['tasks', id], { status: 'done' }) */
export function updateItem(docSegments, patch) {
  return updateDoc(doc(db, 'trips', TRIP_ID, ...docSegments), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Hard delete (spec 00: no soft-delete machinery). removeItem(['tasks', id]) */
export function removeItem(docSegments) {
  return deleteDoc(doc(db, 'trips', TRIP_ID, ...docSegments));
}
