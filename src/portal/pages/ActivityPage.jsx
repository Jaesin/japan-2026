// ActivityPage — the activity feed (spec 41). Live Firestore activity/{autoId}
// written opt-in by the shared mutate helpers. Reverse-chron, grouped by day,
// each row resolving byUid → member name. A localStorage-backed "N new"
// indicator tracks the newest entry seen on the last visit (no per-member
// Firestore read state — deliberately simple). Whole rows with a `link`
// navigate into the relevant feature.

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../data/useCollection.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { Button, EmptyState } from '../ui/ui.jsx';
import './activity.css';

const LAST_SEEN_KEY = 'japan2026.activity.lastSeen';

const VERB_LABEL = {
  added: 'added',
  updated: 'updated',
  completed: 'completed',
  removed: 'removed',
};
/* Singular target noun for the verb+target line ("added a task"). */
const TARGET_NOUN = {
  tasks: 'a task',
  research: 'a research find',
  itinerary: 'an itinerary item',
  budget: 'a budget entry',
  accommodations: 'a stay',
  packing: 'a packing item',
  documents: 'a document',
  transport: 'a transport leg',
  journal: 'a journal entry',
};

/* A retro-muted day color from the name (stable per author). */
const AVATAR_COLORS = [
  'var(--day-1)', 'var(--day-3)', 'var(--day-5)',
  'var(--day-7)', 'var(--day-9)', 'var(--day-2)',
];
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* Firestore Timestamp → millis, or null while the serverTimestamp is pending. */
function atMillis(at) {
  if (at && typeof at.toMillis === 'function') return at.toMillis();
  if (at && typeof at.seconds === 'number') return at.seconds * 1000;
  return null;
}

function readLastSeen() {
  try {
    const v = Number(localStorage.getItem(LAST_SEEN_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
function writeLastSeen(ms) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(ms));
  } catch {
    /* storage unavailable — the indicator just won't persist */
  }
}

/* Day bucket key + label, local-safe. */
function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ms) {
  const now = new Date();
  const d = new Date(ms);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* Short clock / relative time for an entry. */
function timeLabel(ms) {
  if (ms == null) return 'just now';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function Row({ entry, authorName, isBot, onOpen }) {
  const verb = VERB_LABEL[entry.verb] || entry.verb || 'changed';
  const noun = TARGET_NOUN[entry.target] || (entry.target ? `a ${entry.target} item` : 'something');
  const clickable = !!entry.link;
  return (
    <div
      className={'activity-row' + (clickable ? ' activity-row--link' : '')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
    >
      <span
        className={'activity-avatar' + (isBot ? ' activity-avatar--bot' : '')}
        style={isBot ? undefined : { background: colorFor(authorName) }}
        aria-hidden="true"
      >
        {isBot ? '🤖' : (authorName[0] || '?').toUpperCase()}
      </span>
      <span className="activity-row__main">
        <span className="activity-row__line">
          <strong className="activity-row__who">{authorName}</strong>
          {' '}{verb} {noun}
          {entry.title ? <span className="activity-row__sep"> · </span> : null}
          {entry.title ? <em className="activity-row__title">{entry.title}</em> : null}
        </span>
      </span>
      <span className="activity-row__time">{timeLabel(atMillis(entry.at))}</span>
    </div>
  );
}

export default function ActivityPage() {
  const navigate = useNavigate();
  const { features, loading: featuresLoading } = useFeatures();
  const { docs, loading, error } = useCollection(['activity'], { orderBy: [['at', 'desc']], limit: 50 });
  const { docs: members } = useCollection(['members']);

  // Snapshot lastSeen once on mount so the "N new" count is stable for this
  // visit; we bump the stored value after rendering.
  const lastSeenRef = useRef(readLastSeen());

  const nameByUid = useMemo(() => {
    const m = {};
    for (const mem of members) m[mem.id] = mem.name;
    return m;
  }, [members]);

  // Newest resolved timestamp across all entries (pending writes are null).
  const newestMs = useMemo(() => {
    let max = 0;
    for (const d of docs) {
      const ms = atMillis(d.at);
      if (ms != null && ms > max) max = ms;
    }
    return max;
  }, [docs]);

  const newCount = useMemo(
    () => docs.filter((d) => {
      const ms = atMillis(d.at);
      return ms == null || ms > lastSeenRef.current;
    }).length,
    [docs],
  );

  // After the feed has loaded, mark everything seen up to the newest entry.
  useEffect(() => {
    if (!loading && newestMs > 0 && newestMs > lastSeenRef.current) {
      writeLastSeen(newestMs);
    }
  }, [loading, newestMs]);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'activity')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The activity feed isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
          <Button variant="secondary" onClick={() => navigate('/portal')}>Back home</Button>
        </div>
      </div>
    );
  }

  // Group: pending (null `at`) first under "Just now", then by day desc.
  const groups = [];
  const indexByKey = {};
  const pushTo = (key, label, entry) => {
    let g = indexByKey[key];
    if (!g) {
      g = { key, label, entries: [] };
      indexByKey[key] = g;
      groups.push(g);
    }
    g.entries.push(entry);
  };
  const pending = docs.filter((d) => atMillis(d.at) == null);
  const settled = docs.filter((d) => atMillis(d.at) != null);
  if (pending.length) {
    groups.push({ key: '__pending', label: 'Just now', entries: pending });
    indexByKey.__pending = groups[groups.length - 1];
  }
  for (const d of settled) {
    const ms = atMillis(d.at);
    pushTo(dayKey(ms), dayLabel(ms), d);
  }

  const authorOf = (entry) => {
    if (entry.by === 'hermes') return { name: 'Hermes', isBot: true };
    if (entry.by) return { name: entry.by, isBot: false };
    return { name: nameByUid[entry.byUid] || 'Someone', isBot: false };
  };

  return (
    <div className="activity">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>What changed</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>ACTIVITY</h1>

      {newCount > 0 && (
        <div className="activity-new" aria-live="polite">
          {newCount === 1 ? '1 new' : `${newCount} new`} since you last looked
        </div>
      )}

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the feed — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading what changed…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="Nothing's happened yet. Add a task, a find, or a stay and it'll show up here." />
      )}

      {!loading && !error && groups.map((g) => (
        <div key={g.key} className="activity-group">
          <div className="eyebrow activity-group__head">{g.label}</div>
          {g.entries.map((entry) => {
            const { name, isBot } = authorOf(entry);
            return (
              <Row
                key={entry.id}
                entry={entry}
                authorName={name}
                isBot={isBot}
                onOpen={() => entry.link && navigate(entry.link)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
