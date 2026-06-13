// ItineraryPage — the day-by-day plan (spec 12). Live Firestore
// itinerary/{YYYY-MM-DD}: one doc per trip day (deterministic id), each with an
// ordered embedded `activities` array read/written as a unit. A horizontal day
// strip switches the active day (auto-selecting today if within the trip); the
// active day shows a sortable timeline (scheduled first ascending, then
// unscheduled), an "Edit order" mode with ▲▼ moves, an activity detail sheet
// (with Edit / Delete / "Move to day…"), an add-activity FAB, a Map/List toggle
// for a numbered Leaflet day map, and a per-day estimated-cost footer.

import { useMemo, useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { useDoc } from '../../data/useDoc.js';
import { updateItem, setItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { Button, EmptyState, Field, Input, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import { ROUTE, TRIP_DAYS as TRIP_DAYS_FALLBACK } from '../../tripData.js';
import ItineraryDayMap from './ItineraryDayMap.jsx';
import './itinerary.css';

const TRIP_START_FALLBACK = '2026-07-04';

const EMPTY_FORM = {
  time: '', title: '', locationName: '', lat: '', lng: '',
  notes: '', cost: '', link: '',
};

/* deterministic doc id for a Date offset from the start (local, no UTC shift) */
function dateIdFromStart(startIso, offsetDays) {
  const [y, m, d] = startIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/* "2026-07-04" → "Jul 4" / "Sat Jul 4" (local-safe: parse parts) */
function fmtShort(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtLong(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
function todayId() {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/* city for a given trip day — same carry-forward logic as getTodayInfo() */
function cityForDay(dayNum) {
  let stop = ROUTE[0];
  for (const r of ROUTE) if (r.day <= dayNum) stop = r;
  return stop?.city || '';
}

/* sum leading numeric values from each activity's cost string ("¥1,200/adult" → 1200) */
function estTotal(activities) {
  let total = 0;
  for (const a of activities || []) {
    const m = String(a.cost || '').replace(/[, ]/g, '').match(/\d+/);
    if (m) total += Number(m[0]);
  }
  return total;
}

/* timeline sort — scheduled (HH:MM) ascending first, then unscheduled in array order */
function sortedActivities(activities) {
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

/* fresh short id for a new embedded activity */
function newActivityId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanForm(form) {
  const out = {
    title: form.title.trim(),
    time: (form.time || '').trim(),
    locationName: (form.locationName || '').trim(),
    notes: (form.notes || '').trim(),
    cost: (form.cost || '').trim(),
    link: (form.link || '').trim(),
  };
  const lat = parseFloat(form.lat);
  const lng = parseFloat(form.lng);
  out.ll = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  return out;
}

/* ---- add / edit form -------------------------------------------------------- */
function ActivityForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.title.trim().length > 0;

  return (
    <form
      className="itin-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(cleanForm(form)); }}
    >
      <Field label="Title">
        <Input value={form.title} onChange={set('title')} placeholder="Fushimi Inari at dawn" required />
      </Field>
      <Field label="Time (optional)" hint="Leave blank for an unscheduled idea.">
        <Input type="time" value={form.time} onChange={set('time')} />
      </Field>
      <Field label="Place (optional)">
        <Input value={form.locationName} onChange={set('locationName')} placeholder="Fushimi Inari Taisha" />
      </Field>
      <div className="itin-form__pair">
        <Field label="Lat (optional)">
          <Input type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="34.9671" />
        </Field>
        <Field label="Lng (optional)">
          <Input type="number" step="any" value={form.lng} onChange={set('lng')} placeholder="135.7727" />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Go early to beat the crowds." />
      </Field>
      <Field label="Cost (optional)" hint="Freeform — “¥1,200/adult”.">
        <Input value={form.cost} onChange={set('cost')} placeholder="¥1,200/adult" />
      </Field>
      <Field label="Link (optional)">
        <Input type="url" value={form.link} onChange={set('link')} placeholder="https://…" />
      </Field>
      {/* "Promote from Research" (spec 11) is deferred — that integration lives on
          the Research side and is intentionally not built here. */}
      <Button variant="primary" block disabled={!valid}>{submitLabel}</Button>
    </form>
  );
}

/* ---- activity detail sheet -------------------------------------------------- */
function ActivityDetail({ activity, days, currentDateId, onEdit, onDelete, onMove, onClose }) {
  const [movePicker, setMovePicker] = useState(false);
  const rows = [
    ['Time', activity.time || 'Unscheduled'],
    ['Place', activity.locationName],
    ['Coords', Array.isArray(activity.ll) ? activity.ll.join(', ') : ''],
    ['Cost', activity.cost],
    ['Notes', activity.notes],
  ].filter(([, v]) => v);

  return (
    <BottomSheet title={activity.title} onClose={onClose}>
      <div className="itin-detail__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="itin-detail__row">
            <span className="itin-detail__label">{label}</span>
            <span className="itin-detail__value">{value}</span>
          </div>
        ))}
      </div>

      {activity.link && (
        <a className="itin-detail__link" href={activity.link} target="_blank" rel="noopener noreferrer">
          Open link ↗
        </a>
      )}

      {!movePicker ? (
        <div className="itin-detail__actions">
          <Button variant="secondary" block onClick={() => setMovePicker(true)}>Move to day…</Button>
          <Button variant="secondary" block onClick={onEdit}>Edit</Button>
          <Button variant="destructive" block onClick={onDelete}>Delete</Button>
        </div>
      ) : (
        <div className="itin-move">
          <div className="itin-move__head eyebrow">Move to which day?</div>
          {days.map((d) => (
            <button
              key={d.dateId}
              className="itin-move__opt"
              disabled={d.dateId === currentDateId}
              onClick={() => onMove(d.dateId)}
            >
              <span className="itin-move__day">Day {d.dayNum}</span>
              <span className="itin-move__date">{fmtShort(d.dateId)} · {d.city}</span>
              {d.dateId === currentDateId && <span className="itin-move__here">Here now</span>}
            </button>
          ))}
          <Button variant="secondary" block onClick={() => setMovePicker(false)}>Cancel</Button>
        </div>
      )}
    </BottomSheet>
  );
}

/* ---- page ------------------------------------------------------------------- */
export default function ItineraryPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { docs, loading, error } = useCollection(['itinerary']);
  const { data: configMain } = useDoc(['config', 'main']);

  const [activeId, setActiveId] = useState(null);
  const [editOrder, setEditOrder] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedActId, setSelectedActId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Day list: prefer the itinerary docs; else derive from config/main; else tripData. */
  const days = useMemo(() => {
    if (docs.length) {
      return [...docs]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => ({
          dateId: d.id,
          dayNum: d.dayNum,
          city: d.city || cityForDay(d.dayNum),
          label: d.label || '',
          activities: d.activities || [],
          exists: true,
        }));
    }
    const startIso = configMain?.startDate || TRIP_START_FALLBACK;
    const tripDays = configMain?.tripDays || TRIP_DAYS_FALLBACK;
    return Array.from({ length: tripDays }, (_, i) => ({
      dateId: dateIdFromStart(startIso, i),
      dayNum: i + 1,
      city: cityForDay(i + 1),
      label: '',
      activities: [],
      exists: false,
    }));
  }, [docs, configMain]);

  /* Active day — auto-select today if within the trip, else Day 1. */
  const active = useMemo(() => {
    if (!days.length) return null;
    if (activeId) return days.find((d) => d.dateId === activeId) || days[0];
    const tid = todayId();
    return days.find((d) => d.dateId === tid) || days[0];
  }, [days, activeId]);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'itinerary')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The itinerary isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  /* Ensure a day doc exists before writing an embedded activities array to it.
     Falls through to setItem(merge) so deriving days from config still works. */
  const ensureAndWrite = (day, activities) => {
    if (day.exists) {
      return updateItem(['itinerary', day.dateId], { activities });
    }
    return setItem(
      ['itinerary', day.dateId],
      { dayNum: day.dayNum, city: day.city, label: day.label || '', activities },
      { merge: true },
    );
  };

  const selectedAct = active && selectedActId
    ? (active.activities || []).find((a) => a.id === selectedActId) || null
    : null;

  const closeDetail = () => { setSelectedActId(null); setEditing(false); setConfirmDelete(false); };

  const submitAdd = (data) => {
    setAddOpen(false);
    const next = [...(active.activities || []), { id: newActivityId(), ...data, researchId: null, done: false }];
    ensureAndWrite(active, next).catch(console.error);
  };

  const submitEdit = (data) => {
    setEditing(false);
    const next = (active.activities || []).map((a) => (a.id === selectedAct.id ? { ...a, ...data } : a));
    ensureAndWrite(active, next).catch(console.error);
  };

  const toggleDone = (act) => {
    const next = (active.activities || []).map((a) => (a.id === act.id ? { ...a, done: !a.done } : a));
    ensureAndWrite(active, next).catch(console.error);
  };

  const doDelete = () => {
    const id = selectedAct.id;
    closeDetail();
    const next = (active.activities || []).filter((a) => a.id !== id);
    ensureAndWrite(active, next).catch(console.error);
  };

  /* Move within the day's underlying (timeline-sorted) order via ▲▼. We sort,
     swap neighbours, and rewrite the whole array. */
  const move = (act, dir) => {
    const ordered = sortedActivities(active.activities).map(({ _i, ...a }) => a); // eslint-disable-line no-unused-vars
    const idx = ordered.findIndex((a) => a.id === act.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= ordered.length) return;
    [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
    ensureAndWrite(active, ordered).catch(console.error);
  };

  /* Move an activity to another day — pull from current array, append to target. */
  const moveToDay = (targetDateId) => {
    const act = selectedAct;
    closeDetail();
    const targetDay = days.find((d) => d.dateId === targetDateId);
    if (!targetDay || !act) return;
    const fromNext = (active.activities || []).filter((a) => a.id !== act.id);
    const toNext = [...(targetDay.activities || []), act];
    Promise.all([
      ensureAndWrite(active, fromNext),
      ensureAndWrite(targetDay, toNext),
    ]).catch(console.error);
  };

  const ordered = active ? sortedActivities(active.activities) : [];
  const mapStops = ordered.filter((a) => Array.isArray(a.ll) && a.ll.length === 2);
  const est = active ? estTotal(active.activities) : 0;

  return (
    <div className="itinerary">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Day by day</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>ITINERARY</h1>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the itinerary — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading days…</div>}

      {!error && active && (
        <>
          {/* day strip */}
          <div className="itin-strip">
            {days.map((d) => (
              <button
                key={d.dateId}
                className={'itin-strip__day' + (d.dateId === active.dateId ? ' itin-strip__day--active' : '')}
                onClick={() => { setActiveId(d.dateId); setEditOrder(false); }}
              >
                <span className="itin-strip__date">{fmtShort(d.dateId)}</span>
                <span className="itin-strip__city">{d.city}</span>
              </button>
            ))}
          </div>

          {/* active day header */}
          <div className="itin-dayhead">
            <div className="itin-dayhead__top">
              <span className="itin-dayhead__num">Day {active.dayNum}</span>
              <span className="itin-dayhead__date">{fmtLong(active.dateId)}</span>
            </div>
            <div className="itin-dayhead__city">{active.city}</div>
            {active.label && <div className="itin-dayhead__label">{active.label}</div>}
          </div>

          {/* controls */}
          <div className="itin-controls">
            <button
              className={'itin-controls__btn' + (showMap ? ' itin-controls__btn--on' : '')}
              onClick={() => setShowMap((v) => !v)}
            >
              {showMap ? 'List' : 'Map'}
            </button>
            <button
              className={'itin-controls__btn' + (editOrder ? ' itin-controls__btn--on' : '')}
              onClick={() => setEditOrder((v) => !v)}
              disabled={ordered.length < 2}
            >
              {editOrder ? 'Done' : 'Edit order'}
            </button>
          </div>

          {showMap ? (
            mapStops.length ? (
              <ItineraryDayMap stops={mapStops} />
            ) : (
              <div className="itin-map-empty">No mapped stops yet.</div>
            )
          ) : (
            <>
              {ordered.length === 0 && (
                <EmptyState line="Nothing planned for this day yet. Add the first stop with the + button." />
              )}

              <div className="itin-timeline">
                {ordered.map((a, i) => {
                  const scheduled = !!a.time;
                  return (
                    <div
                      key={a.id}
                      className={'itin-act' + (scheduled ? '' : ' itin-act--unscheduled') + (a.done ? ' itin-act--done' : '')}
                    >
                      <span className="itin-act__time">{scheduled ? a.time : '·'}</span>
                      <button
                        type="button"
                        className={'itin-act__check' + (a.done ? ' itin-act__check--on' : '')}
                        aria-pressed={!!a.done}
                        aria-label={a.done ? 'Mark not done' : 'Mark done'}
                        onClick={() => toggleDone(a)}
                      />
                      <button
                        type="button"
                        className="itin-act__main"
                        onClick={() => setSelectedActId(a.id)}
                      >
                        <span className="itin-act__title">{a.title}</span>
                        {a.locationName && <span className="itin-act__loc">{a.locationName}</span>}
                        {a.notes && <span className="itin-act__notes">{a.notes}</span>}
                        {a.cost && <span className="itin-act__cost">{a.cost}</span>}
                      </button>
                      {editOrder ? (
                        <span className="itin-act__reorder">
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={i === 0}
                            onClick={() => move(a, -1)}
                          >▲</button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={i === ordered.length - 1}
                            onClick={() => move(a, 1)}
                          >▼</button>
                        </span>
                      ) : (
                        <span className="itin-act__chev" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>

              {est > 0 && (
                <div className="itin-foot">Est. ¥{est.toLocaleString('en-US')}</div>
              )}
            </>
          )}
        </>
      )}

      <button className="itinerary-fab" onClick={() => setAddOpen(true)} aria-label="Add activity">+</button>

      {addOpen && active && (
        <BottomSheet title={`Add to Day ${active.dayNum}`} onClose={() => setAddOpen(false)}>
          <ActivityForm initial={EMPTY_FORM} onSubmit={submitAdd} submitLabel="Add activity" />
        </BottomSheet>
      )}

      {selectedAct && !editing && (
        <ActivityDetail
          activity={selectedAct}
          days={days}
          currentDateId={active.dateId}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onMove={moveToDay}
          onClose={closeDetail}
        />
      )}

      {selectedAct && editing && (
        <BottomSheet title="Edit activity" onClose={() => setEditing(false)}>
          <ActivityForm
            initial={{
              ...EMPTY_FORM,
              time: selectedAct.time || '',
              title: selectedAct.title || '',
              locationName: selectedAct.locationName || '',
              lat: Array.isArray(selectedAct.ll) ? String(selectedAct.ll[0]) : '',
              lng: Array.isArray(selectedAct.ll) ? String(selectedAct.ll[1]) : '',
              notes: selectedAct.notes || '',
              cost: selectedAct.cost || '',
              link: selectedAct.link || '',
            }}
            onSubmit={submitEdit}
            submitLabel="Save changes"
          />
        </BottomSheet>
      )}

      {selectedAct && confirmDelete && (
        <ConfirmDialog
          title="Delete this activity?"
          body={`“${selectedAct.title}” will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
