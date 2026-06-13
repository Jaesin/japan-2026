// JournalPage — quick nightly journal (spec 23). Live Firestore
// journal/{YYYY-MM-DD--memberName}: one entry per member per day (deterministic
// id = natural upsert). Browse view is a calendar strip of trip days (derived
// from tripData) showing every member's entry side by side; a FAB + tapping a
// day opens the entry form (1–5 Sun rating, highlight, optional note). The
// current member's own entries are editable; others are read-only.

import { useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { setItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState, Field, Input, Textarea } from '../ui/ui.jsx';
import { BottomSheet } from '../ui/overlays.jsx';
import { Sun } from '../ui/primitives.jsx';
import { ROUTE, TRIP_DAYS, TRIP_START } from '../../tripData.js';
import './journal.css';

/* local-safe YYYY-MM-DD from a Date (no UTC shift) */
function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* "2026-07-06" → "Jul 6" (local-safe: parse parts, avoid UTC shift) */
function fmtShort(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* Build the ordered list of trip days with day number + city.
   ROUTE.day = the trip-day the family arrives at that stop; carry it forward. */
function tripDays() {
  const out = [];
  for (let i = 0; i < TRIP_DAYS; i++) {
    const dayNum = i + 1;
    const date = new Date(TRIP_START.getFullYear(), TRIP_START.getMonth(), TRIP_START.getDate() + i);
    let city = ROUTE[0]?.city || '';
    for (const r of ROUTE) if (r.day <= dayNum) city = r.city;
    out.push({ iso: isoOf(date), dayNum, city });
  }
  return out;
}

const TODAY_ISO = isoOf(new Date());

/* ---- rating: five Sun touch targets --------------------------------------- */
function SunRating({ value, onChange, readOnly }) {
  return (
    <div className={'sun-rating' + (readOnly ? ' sun-rating--ro' : '')} role={readOnly ? undefined : 'radiogroup'}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const sun = (
          <Sun
            size={readOnly ? 16 : 26}
            color={on ? 'var(--accent)' : 'var(--line-strong)'}
          />
        );
        if (readOnly) return <span key={n} className="sun-rating__pip">{sun}</span>;
        return (
          <button
            key={n}
            type="button"
            className="sun-rating__btn"
            aria-label={`${n} sun${n > 1 ? 's' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(n)}
          >
            {sun}
          </button>
        );
      })}
    </div>
  );
}

/* ---- add / edit form ------------------------------------------------------- */
function EntryForm({ initial, memberName, onSubmit }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.rating >= 1 && form.rating <= 5 && form.date;

  return (
    <form
      className="journal-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(form); }}
    >
      <div className="journal-form__as">Journaling as <b>{memberName}</b></div>

      <Field label="Date">
        <Input type="date" value={form.date} onChange={set('date')} required />
      </Field>

      <Field label="How was today?">
        <SunRating value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
      </Field>

      <Field label="Highlight" hint="Best thing today — one line.">
        <Input value={form.highlight} onChange={set('highlight')} placeholder="Best thing today?" />
      </Field>

      <Field label="Note (optional)">
        <Textarea rows={4} value={form.note} onChange={set('note')} placeholder="Anything else? (optional)" />
      </Field>

      <Button variant="primary" block disabled={!valid}>Save entry</Button>
    </form>
  );
}

/* ---- single entry display -------------------------------------------------- */
function EntryCard({ entry, mine, onEdit }) {
  const body = (
    <>
      <div className="journal-entry__head">
        <span className="journal-entry__by">{entry.by}{mine && <span className="journal-entry__you"> · you</span>}</span>
        <SunRating value={entry.rating} readOnly />
      </div>
      {entry.highlight && <div className="journal-entry__highlight">{entry.highlight}</div>}
      {entry.note && <div className="journal-entry__note">{entry.note}</div>}
    </>
  );
  if (mine) {
    return (
      <button type="button" className="journal-entry journal-entry--mine" onClick={onEdit}>
        {body}
        <span className="journal-entry__edit">Edit</span>
      </button>
    );
  }
  return <div className="journal-entry">{body}</div>;
}

/* ---- page ------------------------------------------------------------------ */
export default function JournalPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  const memberName = member?.name || '';
  const { docs, loading, error } = useCollection(['journal']);

  const [formDate, setFormDate] = useState(null); // iso string when the sheet is open

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'journal')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The journal isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  /* group entries by date */
  const byDate = new Map();
  for (const d of docs) {
    if (!byDate.has(d.date)) byDate.set(d.date, []);
    byDate.get(d.date).push(d);
  }

  const days = tripDays();
  const tripIsoSet = new Set(days.map((d) => d.iso));
  // entries on dates outside the trip range → "Other days" group at the end
  const otherIsos = [...byDate.keys()].filter((iso) => iso && !tripIsoSet.has(iso)).sort();

  const myEntryFor = (iso) => (byDate.get(iso) || []).find((e) => e.by === memberName) || null;

  const openForm = (iso) => setFormDate(iso || TODAY_ISO);

  const submit = (form) => {
    const date = form.date;
    const idName = String(memberName).replace(/\//g, '-');
    setFormDate(null);
    setItem(
      ['journal', `${date}--${idName}`],
      {
        date,
        by: memberName,
        rating: form.rating,
        highlight: form.highlight.trim(),
        note: form.note.trim(),
      },
      { merge: true },
    ).catch(console.error);
  };

  // initial form values — edit mode if this member already journaled that day
  const formInitial = () => {
    const iso = formDate;
    const existing = myEntryFor(iso);
    return {
      date: iso,
      rating: existing?.rating || 0,
      highlight: existing?.highlight || '',
      note: existing?.note || '',
    };
  };

  const hasAnyEntry = docs.length > 0;

  const renderDay = ({ iso, dayNum, city }) => {
    const entries = byDate.get(iso) || [];
    const mineHere = entries.some((e) => e.by === memberName);
    const label = dayNum
      ? `Day ${dayNum} · ${city} · ${fmtShort(iso)}`
      : fmtShort(iso);
    return (
      <div key={iso} className="journal-day">
        <div className="journal-day__head">
          <span className="eyebrow journal-day__label">{label}</span>
          {!mineHere && (
            <button type="button" className="journal-day__add" onClick={() => openForm(iso)}>
              + Add
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <button type="button" className="journal-day__empty" onClick={() => openForm(iso)}>
            No entries yet — tap to add yours.
          </button>
        ) : (
          <div className="journal-day__entries">
            {entries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                mine={e.by === memberName}
                onEdit={() => openForm(iso)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="journal">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Nightly ritual</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>JOURNAL</h1>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the journal — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading entries…</div>}

      {!loading && !error && (
        <>
          {!hasAnyEntry && (
            <EmptyState line="No entries yet. Tap a day below or the + button to log how today went." />
          )}

          {days.map(renderDay)}

          {otherIsos.length > 0 && (
            <>
              <div className="eyebrow journal__other-head">Other days</div>
              {otherIsos.map((iso) => renderDay({ iso, dayNum: null, city: null }))}
            </>
          )}
        </>
      )}

      <button className="journal-fab" onClick={() => openForm(TODAY_ISO)} aria-label="Add journal entry">+</button>

      {formDate && (
        <BottomSheet
          title={myEntryFor(formDate) ? 'Edit entry' : 'New entry'}
          onClose={() => setFormDate(null)}
        >
          <EntryForm initial={formInitial()} memberName={memberName} onSubmit={submit} />
        </BottomSheet>
      )}
    </div>
  );
}
