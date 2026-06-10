// firebase.js — SDK initialization for the browser app.
// Offline-first per specs/00-architecture-foundation.md: persistent multi-tab
// cache so reads (and queued writes) survive spotty roaming data during the trip.

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseConfig, TRIP_ID } from './firebaseConfig.js';

export { TRIP_ID };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/**
 * Resolve the current Firebase user, signing in anonymously if there isn't one.
 * Anonymous uids persist per browser; membership (trips/{TRIP_ID}/members/{uid})
 * is what actually grants write access — see specs/01-access-and-security.md.
 */
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          stop();
          resolve(user);
        } else {
          signInAnonymously(auth).catch((err) => {
            stop();
            reject(err);
          });
        }
      },
      reject,
    );
  });
}
