// CheckinsPage — live dispatches (spec 21). The bridge between the private
// trip and the public poster: a member taps "Check in", picks a place (today's
// itinerary first, then recent research, then free text), optionally grabs
// their location, adds a short note, and posts. The write lands in the
// public-read `checkins` collection, which the public poster subscribes to.
//
// Privacy: accommodations are deliberately NOT offered in the picker (don't
// broadcast where the kids sleep); the confirm button says "Post to the public
// page" so nobody is surprised it's public.

import { useMemo, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { useCollection } from '../../data/useCollection.js';
import { useDoc } from '../../data/useDoc.js';
import { addItem, removeItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState, Field, Input, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import { getTodayInfo, relativeTime } from '../../tripData.js';
import './checkins.css';

const NOTE_MAX = 140;

/* "Today" as a YYYY-MM-DD id, honouring the ?fakeDate dev override the same way
   TodayDashboard does. Pre-trip falls back to Day 1's date so the picker can
   still surface the opening day's plan. */
function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function resolveBaseDate() {
  if (typeof window !== 'undefined' && window.location) {
    const { search, hash } = window.location;
    const pick = (qs) => {
      const i = (qs || '').indexOf('?');
      if (i < 0) return null;
      return new URLSearchParams(qs.slice(i + 1)).get('fakeDate');
    };
    const raw = pick(search) || pick(hash);
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
}
/* The itinerary day to surface in the picker. During the trip → today; before
   it → Day 1 (Jul 3 2026); after → the real (faked) date (likely empty). */
function pickerDayKey() {
  const info = getTodayInfo();
  if (info.phase === 'before') return '2026-07-03';
  if (info.phase === 'during') return ymd(new Date(2026, 6, 3 + (info.dayNum - 1)));
  return ymd(resolveBaseDate());
}

/* timeline order: scheduled (HH:MM) ascending, then unscheduled in array order */
function orderedActs(activities) {
  const list = (activities || []).map((a, i) => ({ ...a, _i: i }));
  return list.sort((a, b) => {
    const at = a.time || '';
    const bt = b.time || '';
    if (at && bt) return at.localeCompare(bt) || a._i - b._i;
    if (at) return -1;
    if (bt) return 1;
    return a._i - b._i;
  });
}

/* ---- check-in flow (bottom sheet) ------------------------------------------ */
function CheckinFlow({ dayKey, memberName, onClose, onPost }) {
  const { data: dayDoc } = useDoc(['itinerary', dayKey]);
  const { docs: research } = useCollection(['research']);

  // selection: { place, jp?, ll?, activityId?, dayKey? }
  const [sel, setSel] = useState(null);
  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');
  const [note, setNote] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const [geoSupported] = useState(
    () => typeof navigator !== 'undefined' && !!navigator.geolocation,
  );

  const todayActs = useMemo(() => {
    const acts = orderedActs(dayDoc?.activities || []);
    return acts.filter((a) => a.title);
  }, [dayDoc]);

  // a few recent research places that have coordinates (one-tap fill)
  const researchPlaces = useMemo(() => {
    const toMs = (c) => (c?.seconds ? c.seconds * 1000 : (c?.toMillis ? c.toMillis() : 0));
    return [...research]
      .filter((r) => Array.isArray(r.ll) && r.ll.length === 2 && r.title)
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 6);
  }, [research]);

  const pickActivity = (a) => {
    setSel({
      kind: 'activity',
      key: `act-${a.id}`,
      place: a.title,
      jp: a.jp || '',
      ll: Array.isArray(a.ll) && a.ll.length === 2 ? a.ll : null,
      activityId: a.id,
      dayKey,
    });
  };
  const pickResearch = (r) => {
    setSel({
      kind: 'research',
      key: `res-${r.id}`,
      place: r.title,
      jp: r.jp || '',
      ll: r.ll,
    });
  };
  const pickCustom = () => setSel({ kind: 'custom', key: 'custom' });

  const useMyLocation = () => {
    setGeoMsg('');
    if (!geoSupported) { setGeoMsg('Location not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        setCustomLat(String(ll[0]));
        setCustomLng(String(ll[1]));
        setSel((s) => (s && s.kind === 'custom' ? { ...s, ll } : s));
        setGeoMsg('Location captured.');
      },
      () => setGeoMsg('Location permission denied.'),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  // resolve the place + ll for the active selection
  const resolved = useMemo(() => {
    if (!sel) return null;
    if (sel.kind === 'custom') {
      const place = customName.trim();
      const lat = parseFloat(customLat);
      const lng = parseFloat(customLng);
      const ll = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      return { place, jp: '', ll, activityId: null, dayKey: null };
    }
    return {
      place: sel.place,
      jp: sel.jp || '',
      ll: sel.ll || null,
      activityId: sel.activityId || null,
      dayKey: sel.dayKey || null,
    };
  }, [sel, customName, customLat, customLng]);

  // We require a place name to post. `ll` is optional here: a pre-picked
  // activity/research or city-level custom entry without coords still posts as
  // a place-only dispatch (the poster's map tag just won't move for it).
  const canPost = !!resolved && resolved.place.length > 0;

  const post = () => {
    if (!resolved || !resolved.place) return;
    const payload = {
      place: resolved.place,
      at: serverTimestamp(),
    };
    if (resolved.jp) payload.jp = resolved.jp;
    if (Array.isArray(resolved.ll)) payload.ll = resolved.ll;
    const n = note.trim();
    if (n) payload.note = n;
    if (memberName) payload.by = memberName;
    if (resolved.activityId) payload.activityId = resolved.activityId;
    if (resolved.dayKey) payload.dayKey = resolved.dayKey;
    addItem(['checkins'], payload, {
      activity: { verb: 'added', title: `Checked in · ${resolved.place}`, link: '/portal/checkins' },
    }).catch(console.error);
    onPost();
  };

  return (
    <BottomSheet title="Check in" onClose={onClose}>
      <div className="checkin-flow">
        {/* 1 · place picker */}
        <div className="checkin-flow__group">
          <div className="checkin-flow__head">Where are you?</div>

          {todayActs.length > 0 && (
            <>
              <div className="checkin-flow__sub">Today&rsquo;s plan</div>
              <div className="checkin-picks">
                {todayActs.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={'checkin-pick' + (sel?.key === `act-${a.id}` ? ' checkin-pick--on' : '')}
                    onClick={() => pickActivity(a)}
                  >
                    <span className="checkin-pick__title">{a.title}</span>
                    {(a.time || a.locationName) && (
                      <span className="checkin-pick__meta">{[a.time, a.locationName].filter(Boolean).join(' · ')}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {researchPlaces.length > 0 && (
            <>
              <div className="checkin-flow__sub">Recent research</div>
              <div className="checkin-picks">
                {researchPlaces.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={'checkin-pick' + (sel?.key === `res-${r.id}` ? ' checkin-pick--on' : '')}
                    onClick={() => pickResearch(r)}
                  >
                    <span className="checkin-pick__title">{r.title}</span>
                    {r.city && <span className="checkin-pick__meta">{r.city}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="checkin-flow__sub">Somewhere else</div>
          <button
            type="button"
            className={'checkin-pick checkin-pick--wide' + (sel?.kind === 'custom' ? ' checkin-pick--on' : '')}
            onClick={pickCustom}
          >
            <span className="checkin-pick__title">Type a place name</span>
          </button>

          {sel?.kind === 'custom' && (
            <div className="checkin-custom">
              <Field label="Place">
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Goodnight from Kyoto"
                  autoFocus
                />
              </Field>
              <div className="checkin-custom__pair">
                <Field label="Lat (optional)">
                  <Input type="number" step="any" value={customLat} onChange={(e) => setCustomLat(e.target.value)} placeholder="35.0116" />
                </Field>
                <Field label="Lng (optional)">
                  <Input type="number" step="any" value={customLng} onChange={(e) => setCustomLng(e.target.value)} placeholder="135.7681" />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* 2 · use my location */}
        {geoSupported && (
          <div className="checkin-flow__group">
            <Button variant="secondary" block onClick={useMyLocation}>📍 Use my location</Button>
            {geoMsg && <div className="checkin-flow__geo metaline">{geoMsg}</div>}
          </div>
        )}

        {/* 3 · note */}
        <div className="checkin-flow__group">
          <Field label="Note (optional)" hint="A line for the postcard.">
            <Textarea
              rows={2}
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="Ten thousand vermilion gates — and not one we could walk past."
            />
          </Field>
          <div className="checkin-flow__counter">{note.length}/{NOTE_MAX}</div>
        </div>

        {/* 4 · confirm */}
        <Button variant="primary" block disabled={!canPost} onClick={post}>
          Post to the public page
        </Button>
        <p className="checkin-flow__notice metaline">
          Check-ins appear on the public trip page for everyone.
        </p>
      </div>
    </BottomSheet>
  );
}

/* ---- recent dispatch row --------------------------------------------------- */
function DispatchRow({ item, onDelete }) {
  const when = relativeTime(item.at);
  return (
    <div className="checkin-row">
      <div className="checkin-row__main">
        <div className="checkin-row__head">
          <span className="checkin-row__place">{item.place}</span>
          {item.jp && <span className="checkin-row__jp">{item.jp}</span>}
          {when && <span className="checkin-row__when">{when}</span>}
        </div>
        {item.note && <div className="checkin-row__note">{item.note}</div>}
      </div>
      <button
        type="button"
        className="checkin-row__del"
        aria-label={`Delete check-in at ${item.place}`}
        onClick={onDelete}
      >✕</button>
    </div>
  );
}

/* ---- page ------------------------------------------------------------------ */
export default function CheckinsPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  const memberName = member?.name || '';
  const { docs, loading, error } = useCollection(['checkins'], {
    orderBy: [['at', 'desc']],
    limit: 30,
  });

  const [flowOpen, setFlowOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'checkins')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            Check-ins aren&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const confirming = docs.find((d) => d.id === confirmId) || null;
  const doDelete = () => {
    const id = confirmId;
    setConfirmId(null);
    removeItem(['checkins', id]).catch(console.error);
  };

  return (
    <div className="checkins">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Live dispatches</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>CHECK-INS</h1>

      <Button variant="primary" block onClick={() => setFlowOpen(true)}>Check in</Button>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)', marginTop: 16 }}>
          Couldn&rsquo;t load check-ins — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline" style={{ marginTop: 16 }}>Loading dispatches…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No dispatches yet. Tap Check in to post your first one." />
      )}

      {!loading && !error && docs.length > 0 && (
        <div className="checkin-list">
          {docs.map((item) => (
            <DispatchRow key={item.id} item={item} onDelete={() => setConfirmId(item.id)} />
          ))}
        </div>
      )}

      {flowOpen && (
        <CheckinFlow
          dayKey={pickerDayKey()}
          memberName={memberName}
          onClose={() => setFlowOpen(false)}
          onPost={() => setFlowOpen(false)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Delete this check-in?"
          body={`“${confirming.place}” will be removed from the public page.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
