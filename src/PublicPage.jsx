// PublicPage.jsx — the public (non-portal) trip page.
// Auto-switches the entire treatment on the browser's light/dark setting:
//   light → PosterLight (Direction A)   dark → PosterDark (Direction B)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import PosterLight from './components/PosterLight';
import PosterDark from './components/PosterDark';
import { useMember } from './auth/useMember.js';
import { db, TRIP_ID } from './firebase.js';

function usePrefersDark() {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/**
 * Live subscription to the latest 3 public check-ins (no auth — checkins are
 * public-read per firestore.rules). Reuses the already-bundled Firestore SDK
 * (db/TRIP_ID) with onSnapshot so the poster updates without a refresh.
 *
 * Returns `null` until the first snapshot resolves, and stays `null` on
 * error/offline — the posters then fall back to their SAMPLE_CHECKINS default,
 * so the page never flashes a broken/empty feed. Once resolved it returns the
 * live array (which may be empty → posters render the "Dispatches begin" state).
 */
function useLiveCheckins() {
  const [checkins, setCheckins] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    try {
      const ref = collection(db, 'trips', TRIP_ID, 'checkins');
      const q = query(ref, orderBy('at', 'desc'), limit(3));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          setCheckins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        () => { /* offline / denied → keep null, posters use SAMPLE default */ },
      );
    } catch {
      /* construction failed → keep null, posters use SAMPLE default */
    }
    return () => { cancelled = true; unsub(); };
  }, []);
  return checkins;
}

/**
 * Live subscription to the latest 12 public postcards (spec 22). Same shape as
 * useLiveCheckins: postcards are public-read per firestore.rules, so no auth is
 * needed. Returns `[]` until the first snapshot resolves and stays `[]` on
 * error/offline — the posters omit the strip entirely when it's empty, so the
 * pre-trip / broken-feed case is simply "no strip" (never a layout flash).
 */
function useLivePostcards() {
  const [postcards, setPostcards] = useState([]);
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    try {
      const ref = collection(db, 'trips', TRIP_ID, 'postcards');
      const q = query(ref, orderBy('at', 'desc'), limit(12));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          setPostcards(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        () => { /* offline / denied → keep [] so the strip just doesn't render */ },
      );
    } catch {
      /* construction failed → keep [] */
    }
    return () => { cancelled = true; unsub(); };
  }, []);
  return postcards;
}

export default function PublicPage() {
  const dark = usePrefersDark();
  const navigate = useNavigate();
  const { status } = useMember();
  const liveCheckins = useLiveCheckins();
  const livePostcards = useLivePostcards();
  // Pass live data only once resolved; while null the posters use their
  // SAMPLE_CHECKINS default (no flash of empty layout). Postcards are additive
  // and default to [] (strip omitted), so we always pass them.
  const posterProps = { postcards: livePostcards, ...(liveCheckins == null ? {} : { checkins: liveCheckins }) };
  // The poster is a single ~480px column; center it with letterboxing on
  // larger screens. Page background matches the active mode's edge color.
  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: dark ? '#11192c' : '#e7ddc4' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {dark ? <PosterDark {...posterProps} /> : <PosterLight {...posterProps} />}
        {status === 'member' && (
          <button
            onClick={() => navigate('/portal')}
            style={{
              width: '100%',
              padding: '16px 24px',
              background: dark ? '#EE3C2B' : '#C5302B',
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '.04em',
              cursor: 'pointer',
            }}
          >
            Enter Portal
          </button>
        )}
      </div>
    </div>
  );
}
