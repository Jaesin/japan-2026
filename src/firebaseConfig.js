// firebaseConfig.js — web app config + trip constants. Data only (no SDK init)
// so Node scripts (scripts/seed.mjs) can import it without browser-only caches.
// These values are public identifiers, not secrets — security lives in
// firestore.rules (see specs/01-access-and-security.md).

export const firebaseConfig = {
  apiKey: 'AIzaSyBbErWmDye2m6-txENE_a_kNZYOhidOpUA',
  authDomain: 'japan-2026-6363d.firebaseapp.com',
  projectId: 'japan-2026-6363d',
  storageBucket: 'japan-2026-6363d.firebasestorage.app',
  messagingSenderId: '361824342995',
  appId: '1:361824342995:web:35995ecc63f601b441d526',
};

export const TRIP_ID = 'japan-2026';
