// TransportPage — transport hub (spec 16). Live Firestore transport/{autoId}:
// chronological legs (flights, trains, buses, ferries, transfer notes) grouped
// by date, tap-row detail sheet with "Copy booking ref", add/edit/delete, and
// a static IC-cards / transit-tips reference block at the bottom.

import { useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { Button, EmptyState, Field, Input, Select, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import './transport.css';

const KIND_ICO = { flight: '✈', train: '🚄', bus: '🚌', ferry: '⛴', 'transfer-note': '📋' };
const KIND_LABEL = { flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry', 'transfer-note': 'Transfer note' };
const KINDS = Object.keys(KIND_ICO);

const EMPTY_FORM = {
  kind: 'flight', date: '', carrier: '', from: '', to: '',
  depTime: '', arrTime: '', bookingRef: '', seats: '', status: 'idea', notes: '',
};

/* "2026-07-04" → "Sat Jul 4" (local-safe: parse parts, avoid UTC shift) */
function fmtDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || 'No date';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* Drop empty-string fields so optional values are never stored as ''. */
function cleanForm(form) {
  const required = { kind: form.kind, date: form.date, from: form.from.trim(), to: form.to.trim(), status: form.status };
  const out = { ...required };
  for (const k of ['carrier', 'depTime', 'arrTime', 'bookingRef', 'seats', 'notes']) {
    const v = (form[k] || '').trim();
    if (v) out[k] = v;
  }
  return out;
}

/* ---- add / edit form -------------------------------------------------------- */
function LegForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const carrierRequired = form.kind === 'flight' || form.kind === 'train';
  const valid = form.date && form.from.trim() && form.to.trim()
    && (!carrierRequired || form.carrier.trim());

  return (
    <form
      className="leg-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(cleanForm(form)); }}
    >
      <Field label="Kind">
        <Select value={form.kind} onChange={set('kind')}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
      </Field>
      <Field label="Date">
        <Input type="date" value={form.date} onChange={set('date')} required />
      </Field>
      <Field label={carrierRequired ? 'Carrier' : 'Carrier (optional)'} hint="e.g. Thai Airways TG682, Hikari 505">
        <Input value={form.carrier} onChange={set('carrier')} placeholder="Carrier & number" />
      </Field>
      <div className="leg-form__pair">
        <Field label="From">
          <Input value={form.from} onChange={set('from')} placeholder="BKK T1" required />
        </Field>
        <Field label="To">
          <Input value={form.to} onChange={set('to')} placeholder="HND T3" required />
        </Field>
      </div>
      <div className="leg-form__pair">
        <Field label="Dep time">
          <Input type="time" value={form.depTime} onChange={set('depTime')} />
        </Field>
        <Field label="Arr time">
          <Input type="time" value={form.arrTime} onChange={set('arrTime')} />
        </Field>
      </div>
      <Field label="Booking ref">
        <Input value={form.bookingRef} onChange={set('bookingRef')} placeholder="ABC123" />
      </Field>
      <Field label="Seats">
        <Input value={form.seats} onChange={set('seats')} placeholder="34A 34B 34C 34D · car 7" />
      </Field>
      <Field label="Status">
        <Select value={form.status} onChange={set('status')}>
          <option value="idea">Idea</option>
          <option value="booked">Booked</option>
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Platform habits, transfer instructions…" />
      </Field>
      <Button variant="primary" block disabled={!valid}>{submitLabel}</Button>
    </form>
  );
}

/* ---- detail sheet ------------------------------------------------------------ */
function LegDetail({ leg, onEdit, onDelete, onClose }) {
  const [copied, setCopied] = useState(false);
  const copyRef = () => {
    navigator.clipboard.writeText(leg.bookingRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(console.error);
  };

  const rows = [
    ['Kind', `${KIND_ICO[leg.kind] || '•'} ${KIND_LABEL[leg.kind] || leg.kind}`],
    ['Date', fmtDate(leg.date)],
    ['Route', `${leg.from} → ${leg.to}`],
    ['Times', [leg.depTime, leg.arrTime].filter(Boolean).join(' – ')],
    ['Carrier', leg.carrier],
    ['Seats', leg.seats],
    ['Status', leg.status === 'booked' ? 'Booked' : 'Idea'],
    ['Cost', [
      leg.costJPY != null && `¥${Number(leg.costJPY).toLocaleString()}`,
      leg.costTHB != null && `฿${Number(leg.costTHB).toLocaleString()}`,
    ].filter(Boolean).join(' · ')],
    ['Notes', leg.notes],
  ].filter(([, v]) => v);

  return (
    <BottomSheet title={`${leg.from} → ${leg.to}`} onClose={onClose}>
      {leg.bookingRef && (
        <button className="leg-detail__ref" onClick={copyRef}>
          <span className="leg-detail__ref-code">{leg.bookingRef}</span>
          <span className="leg-detail__ref-action">{copied ? 'Copied ✓' : 'Copy booking ref'}</span>
        </button>
      )}
      <div className="leg-detail__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="leg-detail__row">
            <span className="leg-detail__label">{label}</span>
            <span className="leg-detail__value">{value}</span>
          </div>
        ))}
      </div>
      <div className="leg-detail__actions">
        <Button variant="secondary" block onClick={onEdit}>Edit</Button>
        <Button variant="destructive" block onClick={onDelete}>Delete</Button>
      </div>
    </BottomSheet>
  );
}

/* ---- static reference block --------------------------------------------------- */
const REF_CARDS = [
  {
    title: 'Suica / Pasmo / Welcome Suica',
    body: 'Welcome Suica (¥500, no deposit, 28-day expiry) available at Narita/Haneda. Kids under 12 need a child Suica — get it at a station office (JR East major stations). Top up at any convenience store or station machine.',
  },
  {
    title: 'Airport transfers',
    body: "Narita → central Tokyo: Narita Express (N'EX) ~55 min ¥3,070, or Limousine Bus to major hotels ~¥3,200. Haneda → central: Keikyu/Tokyo Monorail ~30 min ¥600.",
  },
  {
    title: 'Luggage forwarding (takkyubin)',
    body: 'Send bags hotel-to-hotel via Yamato (¥1,500–2,500/bag). Book the night before at your hotel or konbini. Bags arrive next morning — great for Shinkansen days.',
  },
  {
    title: 'Shinkansen tips',
    body: 'Board 10 min early, car/seat is printed on the ticket. Non-reserved cars (自由席 jiyūseki) at the front/back of the train — fine for short legs.',
  },
];

function ReferenceSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="transport__ref">
      <button
        className={'transport__ref-head' + (open ? ' transport__ref-head--open' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="eyebrow transport__ref-label">IC cards &amp; Japan transit tips</span>
        <span className="transport__ref-chev" aria-hidden="true" />
      </button>
      {open && REF_CARDS.map((c) => (
        <div key={c.title} className="transport__ref-card">
          <div className="transport__ref-title">{c.title}</div>
          <p className="transport__ref-body">{c.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ---- page --------------------------------------------------------------------- */
export default function TransportPage() {
  const { features, loading: featuresLoading } = useFeatures();
  // Firestore drops docs missing an orderBy field, and depTime is optional —
  // so order by date server-side and sort depTime within each group client-side.
  const { docs, loading, error } = useCollection(['transport'], { orderBy: [['date', 'asc']] });

  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'transport')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            Transport isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const selected = docs.find((d) => d.id === selectedId) || null;

  /* group by date, legs without depTime sort last within their day */
  const groups = [];
  for (const leg of docs) {
    const last = groups[groups.length - 1];
    if (last && last.date === leg.date) last.legs.push(leg);
    else groups.push({ date: leg.date, legs: [leg] });
  }
  for (const g of groups) {
    g.legs.sort((a, b) => (a.depTime || '99:99').localeCompare(b.depTime || '99:99'));
  }

  const closeDetail = () => { setSelectedId(null); setEditing(false); setConfirmDelete(false); };

  const submitAdd = (data) => {
    setAddOpen(false);
    addItem(['transport'], data).catch(console.error);
  };
  const submitEdit = (data) => {
    setEditing(false);
    updateItem(['transport', selected.id], data).catch(console.error);
  };
  const doDelete = () => {
    const id = selected.id;
    closeDetail();
    removeItem(['transport', id]).catch(console.error);
  };

  return (
    <div className="transport">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Getting around</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 24px', fontWeight: 400 }}>TRANSPORT</h1>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load transport legs — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading legs…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No legs yet. Add the first flight, train, or transfer with the + button." />
      )}

      {!loading && !error && groups.map((g) => (
        <div key={g.date}>
          <div className="eyebrow transport__date-head">{fmtDate(g.date)}</div>
          {g.legs.map((leg) => {
            const times = [leg.depTime, leg.arrTime].filter(Boolean).join(' – ');
            return (
              <div
                key={leg.id}
                className="leg-row"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(leg.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(leg.id); } }}
              >
                <span className="leg-row__ico" aria-hidden="true">{KIND_ICO[leg.kind] || '•'}</span>
                <span className="leg-row__main">
                  <span className="leg-row__route">{leg.from} → {leg.to}</span>
                  <span className="leg-row__times">
                    {[leg.carrier, times].filter(Boolean).join(' · ') || KIND_LABEL[leg.kind] || ''}
                  </span>
                </span>
                <span className={`leg-row__status leg-row__status--${leg.status === 'booked' ? 'booked' : 'idea'}`}>
                  {leg.status === 'booked' ? 'Booked' : 'Idea'}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      <ReferenceSection />

      <button className="transport-fab" onClick={() => setAddOpen(true)} aria-label="Add transport leg">+</button>

      {addOpen && (
        <BottomSheet title="Add leg" onClose={() => setAddOpen(false)}>
          <LegForm initial={EMPTY_FORM} onSubmit={submitAdd} submitLabel="Add leg" />
        </BottomSheet>
      )}

      {selected && !editing && (
        <LegDetail
          leg={selected}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onClose={closeDetail}
        />
      )}

      {selected && editing && (
        <BottomSheet title="Edit leg" onClose={() => setEditing(false)}>
          <LegForm
            initial={{ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(selected).filter(([k]) => k in EMPTY_FORM)) }}
            onSubmit={submitEdit}
            submitLabel="Save changes"
          />
        </BottomSheet>
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete this leg?"
          body={`${selected.from} → ${selected.to} will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
