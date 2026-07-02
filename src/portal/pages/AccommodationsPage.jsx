// AccommodationsPage — accommodation manager (spec 13). Live Firestore
// accommodations/{autoId}: one doc per stay (name, city, nights, address,
// check-in/out, booking, host, access notes, status, cost). List ordered by
// first night, detail sheet with the two big touch targets (Copy address /
// Open in Maps) plus prominent access notes, add/edit/delete, and a gap
// detection banner flagging trip nights with no booked stay.

import { useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { useDoc } from '../../data/useDoc.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { Button, EmptyState, Field, Input, Select, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import './accommodations.css';

const TRIP_START = '2026-07-03';
const TRIP_NIGHTS_FALLBACK = 10; // nights slept: Jul 3,4,5,6,7,8,9,10,11,12 (check out Jul 13)

const EMPTY_FORM = {
  name: '', city: '', nights: '', address: '',
  lat: '', lng: '', checkInTime: '', checkOutTime: '',
  bookingRef: '', bookingUrl: '', hostContact: '', accessNotes: '',
  status: 'idea', costJPY: '',
};

/* "2026-07-06" → "Jul 6" (local-safe: parse parts, avoid UTC shift) */
function fmtDay(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* Earliest night in the array, or '' if none — used for ordering. */
function firstNight(nights) {
  if (!Array.isArray(nights) || nights.length === 0) return '';
  return [...nights].sort()[0];
}

/* ["2026-07-06","2026-07-07"] → "Jul 6–8" (range end = last night + 1, the
   checkout morning). Single night → "Jul 6 (1 night)". */
function nightsRange(nights) {
  if (!Array.isArray(nights) || nights.length === 0) return 'No nights set';
  const sorted = [...nights].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (nights.length === 1) return `${fmtDay(first)} · 1 night`;
  // checkout is the morning after the last night
  const [y, m, d] = last.split('-').map(Number);
  const checkout = new Date(y, m - 1, d + 1);
  const coLabel = checkout.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmtDay(first)}–${coLabel} · ${nights.length} nights`;
}

/* Parse a freeform string of dates (comma/space/newline separated) into a
   sorted, de-duped array of valid YYYY-MM-DD strings. */
function parseNights(raw) {
  const seen = new Set();
  for (const tok of (raw || '').split(/[\s,]+/)) {
    const t = tok.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) seen.add(t);
  }
  return [...seen].sort();
}

/* Build the set of trip nights (YYYY-MM-DD) from config/main, else fallback. */
function tripNights(config) {
  const start = config?.startDate || TRIP_START;
  const days = Number(config?.tripDays) || (TRIP_NIGHTS_FALLBACK + 1);
  const nights = Math.max(0, days - 1); // last day is checkout, not a night
  const [y, m, d] = start.split('-').map(Number);
  const out = [];
  for (let i = 0; i < nights; i += 1) {
    const dt = new Date(y, m - 1, d + i);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/* Google Maps deep link — prefer coordinates, fall back to address text. */
function mapsUrl(stay) {
  let query;
  if (Array.isArray(stay.ll) && stay.ll.length === 2) query = `${stay.ll[0]},${stay.ll[1]}`;
  else if (stay.address) query = stay.address;
  else query = stay.name || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/* Drop empty optionals; coerce nights → array, ll → [num,num], cost → number. */
function formToStay(form) {
  const stay = {
    name: form.name.trim(),
    city: form.city.trim(),
    nights: parseNights(form.nights),
    status: form.status,
  };
  for (const k of ['address', 'checkInTime', 'checkOutTime', 'bookingRef', 'bookingUrl', 'hostContact', 'accessNotes']) {
    const v = (form[k] || '').trim();
    if (v) stay[k] = v;
  }
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  if (form.lat.trim() && form.lng.trim() && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    stay.ll = [lat, lng];
  }
  const cost = Number(form.costJPY);
  if (form.costJPY.trim() && !Number.isNaN(cost)) stay.costJPY = cost;
  return stay;
}

function stayToForm(stay) {
  return {
    ...EMPTY_FORM,
    name: stay.name || '',
    city: stay.city || '',
    nights: Array.isArray(stay.nights) ? stay.nights.join(' ') : '',
    address: stay.address || '',
    lat: Array.isArray(stay.ll) ? String(stay.ll[0]) : '',
    lng: Array.isArray(stay.ll) ? String(stay.ll[1]) : '',
    checkInTime: stay.checkInTime || '',
    checkOutTime: stay.checkOutTime || '',
    bookingRef: stay.bookingRef || '',
    bookingUrl: stay.bookingUrl || '',
    hostContact: stay.hostContact || '',
    accessNotes: stay.accessNotes || '',
    status: stay.status || 'idea',
    costJPY: stay.costJPY != null ? String(stay.costJPY) : '',
  };
}

/* ---- add / edit form -------------------------------------------------------- */
function StayForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.name.trim() && form.city.trim();

  return (
    <form
      className="stay-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(formToStay(form)); }}
    >
      <Field label="Name">
        <Input value={form.name} onChange={set('name')} placeholder="Kyoto machiya" required />
      </Field>
      <Field label="City">
        <Input value={form.city} onChange={set('city')} placeholder="Kyoto" required />
      </Field>
      <Field label="Nights" hint="Dates slept here, YYYY-MM-DD, comma or space separated">
        <Input value={form.nights} onChange={set('nights')} placeholder="2026-07-06 2026-07-07" />
      </Field>
      <Field label="Status">
        <Select value={form.status} onChange={set('status')}>
          <option value="idea">Idea</option>
          <option value="booked">Booked</option>
        </Select>
      </Field>
      <Field label="Address" hint="Local + romaji, freeform">
        <Textarea rows={2} value={form.address} onChange={set('address')} placeholder="京都市… / Kyoto-shi…" />
      </Field>
      <div className="stay-form__pair">
        <Field label="Check-in">
          <Input type="time" value={form.checkInTime} onChange={set('checkInTime')} />
        </Field>
        <Field label="Check-out">
          <Input type="time" value={form.checkOutTime} onChange={set('checkOutTime')} />
        </Field>
      </div>
      <Field label="Access notes" hint="Door codes, key box — the 9pm-arrival lifesaver">
        <Textarea rows={3} value={form.accessNotes} onChange={set('accessNotes')} placeholder="Keypad 1234#, lockbox left of door…" />
      </Field>
      <Field label="Booking ref">
        <Input value={form.bookingRef} onChange={set('bookingRef')} placeholder="ABC123" />
      </Field>
      <Field label="Booking URL">
        <Input type="url" value={form.bookingUrl} onChange={set('bookingUrl')} placeholder="https://…" />
      </Field>
      <Field label="Host contact">
        <Input value={form.hostContact} onChange={set('hostContact')} placeholder="Phone / LINE / notes" />
      </Field>
      <div className="stay-form__pair">
        <Field label="Lat (optional)">
          <Input inputMode="decimal" value={form.lat} onChange={set('lat')} placeholder="35.0116" />
        </Field>
        <Field label="Lng (optional)">
          <Input inputMode="decimal" value={form.lng} onChange={set('lng')} placeholder="135.7681" />
        </Field>
      </div>
      <Field label="Cost (¥, optional)">
        <Input type="number" inputMode="numeric" min="0" value={form.costJPY} onChange={set('costJPY')} placeholder="42000" />
      </Field>
      <Button variant="primary" block disabled={!valid}>{submitLabel}</Button>
    </form>
  );
}

/* ---- detail sheet ------------------------------------------------------------ */
function StayDetail({ stay, onEdit, onDelete, onClose }) {
  const [copied, setCopied] = useState(false);
  const copyAddress = () => {
    if (!stay.address) return;
    navigator.clipboard.writeText(stay.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(console.error);
  };

  const rows = [
    ['City', stay.city],
    ['Nights', nightsRange(stay.nights)],
    ['Check-in', stay.checkInTime],
    ['Check-out', stay.checkOutTime],
    ['Status', stay.status === 'booked' ? 'Booked' : 'Idea'],
    ['Booking ref', stay.bookingRef],
    ['Host', stay.hostContact],
    ['Cost', stay.costJPY != null ? `¥${Number(stay.costJPY).toLocaleString()}` : ''],
  ].filter(([, v]) => v);

  return (
    <BottomSheet title={stay.name} onClose={onClose}>
      <div className="stay-detail__big">
        {(stay.address || stay.ll) && (
          <button
            className="stay-detail__act"
            onClick={copyAddress}
            disabled={!stay.address}
          >
            {copied ? 'Address copied ✓' : 'Copy address'}
          </button>
        )}
        {(stay.address || stay.ll) && (
          <a
            className="stay-detail__act stay-detail__act--primary"
            href={mapsUrl(stay)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Maps
          </a>
        )}
      </div>

      {stay.accessNotes && (
        <div className="stay-detail__access">
          <span className="eyebrow stay-detail__access-label">Access / door code</span>
          <p className="stay-detail__access-body">{stay.accessNotes}</p>
        </div>
      )}

      {stay.address && (
        <div className="stay-detail__address">{stay.address}</div>
      )}

      <div className="stay-detail__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="stay-detail__row">
            <span className="stay-detail__label">{label}</span>
            <span className="stay-detail__value">{value}</span>
          </div>
        ))}
      </div>

      {stay.bookingUrl && (
        <a className="stay-detail__link" href={stay.bookingUrl} target="_blank" rel="noreferrer">
          Open booking →
        </a>
      )}

      <div className="stay-detail__actions">
        <Button variant="secondary" block onClick={onEdit}>Edit</Button>
        <Button variant="destructive" block onClick={onDelete}>Delete</Button>
      </div>
    </BottomSheet>
  );
}

/* ---- gap banner --------------------------------------------------------------- */
function GapBanner({ docs, config }) {
  const nights = tripNights(config);
  if (nights.length === 0) return null;

  const covered = new Set();
  for (const d of docs) {
    if (d.status === 'booked' && Array.isArray(d.nights)) {
      for (const n of d.nights) covered.add(n);
    }
  }
  const gaps = nights.filter((n) => !covered.has(n));

  if (gaps.length === 0) {
    return <div className="stay-gap stay-gap--ok">All nights covered ✓</div>;
  }
  return (
    <div className="stay-gap stay-gap--warn">
      <span className="stay-gap__head">
        {gaps.length === 1 ? '1 night needs a booked stay' : `${gaps.length} nights need a booked stay`}
      </span>
      <span className="stay-gap__dates">
        {gaps.map(fmtDay).join(' · ')}
      </span>
    </div>
  );
}

/* ---- page --------------------------------------------------------------------- */
export default function AccommodationsPage() {
  const { features, loading: featuresLoading } = useFeatures();
  // No server orderBy: stays may lack `nights` and Firestore drops docs
  // missing an orderBy field — sort client-side by first night instead.
  const { docs, loading, error } = useCollection(['accommodations']);
  const { data: config } = useDoc(['config', 'main']);

  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'accommodations')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            Stays aren&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const selected = docs.find((d) => d.id === selectedId) || null;

  /* Order by first night; entries with no nights sort last. */
  const ordered = [...docs].sort((a, b) => {
    const fa = firstNight(a.nights);
    const fb = firstNight(b.nights);
    if (!fa && !fb) return (a.name || '').localeCompare(b.name || '');
    if (!fa) return 1;
    if (!fb) return -1;
    return fa.localeCompare(fb);
  });

  const closeDetail = () => { setSelectedId(null); setEditing(false); setConfirmDelete(false); };

  const submitAdd = (data) => {
    setAddOpen(false);
    addItem(['accommodations'], data, { activity: { verb: 'added', title: data.name, link: '/portal/accommodations' } }).catch(console.error);
  };
  const submitEdit = (data) => {
    setEditing(false);
    updateItem(['accommodations', selected.id], data).catch(console.error);
  };
  const doDelete = () => {
    const id = selected.id;
    closeDetail();
    removeItem(['accommodations', id]).catch(console.error);
  };

  return (
    <div className="accommodations">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Where we sleep</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>STAYS</h1>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load stays — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading stays…</div>}

      {!loading && !error && docs.length > 0 && (
        <GapBanner docs={docs} config={config} />
      )}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No stays yet. Add the first place with the + button." />
      )}

      {!loading && !error && ordered.map((stay) => (
        <div
          key={stay.id}
          className="stay-row"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedId(stay.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(stay.id); } }}
        >
          <span className="stay-row__ico" aria-hidden="true">🛏</span>
          <span className="stay-row__main">
            <span className="stay-row__name">{stay.name}</span>
            <span className="stay-row__meta">
              {[stay.city, nightsRange(stay.nights)].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className={`stay-row__status stay-row__status--${stay.status === 'booked' ? 'booked' : 'idea'}`}>
            {stay.status === 'booked' ? 'Booked' : 'Idea'}
          </span>
        </div>
      ))}

      <button className="accommodations-fab" onClick={() => setAddOpen(true)} aria-label="Add stay">+</button>

      {addOpen && (
        <BottomSheet title="Add stay" onClose={() => setAddOpen(false)}>
          <StayForm initial={EMPTY_FORM} onSubmit={submitAdd} submitLabel="Add stay" />
        </BottomSheet>
      )}

      {selected && !editing && (
        <StayDetail
          stay={selected}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onClose={closeDetail}
        />
      )}

      {selected && editing && (
        <BottomSheet title="Edit stay" onClose={() => setEditing(false)}>
          <StayForm initial={stayToForm(selected)} onSubmit={submitEdit} submitLabel="Save changes" />
        </BottomSheet>
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete this stay?"
          body={`${selected.name} will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
