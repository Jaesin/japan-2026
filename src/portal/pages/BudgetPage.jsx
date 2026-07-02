// BudgetPage — budget ledger (spec 14). One Firestore collection
// budget/{autoId} holds both pre-trip estimates and during-trip actuals;
// the summary header compares them per category. Amounts are canonical in
// JPY; USD display derives from the live rate (fx.js) or, for entries that
// stamped their own `fxRate` at entry time, that historical rate.

import { useState, useMemo } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { useFxRate } from '../fx.js';
import { Button, EmptyState, Field, FilterChip, Input, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import './budget.css';

const CATEGORIES = ['flights', 'stay', 'transport', 'food', 'activities', 'shopping', 'other'];
const CAT_LABELS = { flights: 'Flights', stay: 'Stay', transport: 'Transport', food: 'Food', activities: 'Activities', shopping: 'Shopping', other: 'Other' };
const CAT_ICO = { flights: '✈️', stay: '🛏', transport: '🚄', food: '🍜', activities: '⛩', shopping: '🛍', other: '📦' };

/* ---- FX / formatting helpers ----------------------------------------------- */
// Prefer the rate stamped on the entry itself (the rate at time of payment)
// over the live rate, so historical entries don't drift as the live rate moves.
function toUSD(entry, liveRate) {
  if (entry.amountUSD != null) return entry.amountUSD;
  if (entry.amountJPY != null) return entry.amountJPY / (entry.fxRate || liveRate);
  return 0;
}
function toJPY(entry, liveRate) {
  if (entry.amountJPY != null) return entry.amountJPY;
  if (entry.amountUSD != null) return entry.amountUSD * (entry.fxRate || liveRate);
  return 0;
}
function fmtUSD(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtJPY(n) { return '¥' + Math.round(n).toLocaleString(); }

/* "2026-07-04" → "Sat Jul 4" (local-safe: parse parts, avoid UTC shift) */
function fmtDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || 'No date';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---- add / edit form --------------------------------------------------------- */
function entryToForm(entry, memberName) {
  if (!entry) {
    return {
      amount: '', currency: 'JPY', category: '', item: '',
      kind: 'actual', date: todayISO(), paidBy: memberName || '', notes: '',
    };
  }
  const isUSD = entry.amountJPY == null && entry.amountUSD != null;
  return {
    amount: String(isUSD ? entry.amountUSD : entry.amountJPY ?? ''),
    currency: isUSD ? 'USD' : 'JPY',
    category: entry.category || '',
    item: entry.item || '',
    kind: entry.kind || 'actual',
    date: entry.date || todayISO(),
    paidBy: entry.paidBy || memberName || '',
    notes: entry.notes || '',
  };
}

// Stamps BOTH amountJPY and amountUSD, plus the fxRate used, so the entry
// stays accurate at its original value even as the live rate moves later.
function formToEntry(form, fxRate) {
  const entry = {
    category: form.category,
    kind: form.kind,
    paidBy: form.paidBy.trim(),
    fxRate,
  };
  const amount = Number(form.amount);
  if (form.currency === 'USD') {
    entry.amountUSD = amount;
    entry.amountJPY = Math.round(amount * fxRate);
  } else {
    entry.amountJPY = amount;
    entry.amountUSD = Math.round((amount / fxRate) * 100) / 100;
  }
  const item = form.item.trim();
  if (item) entry.item = item;
  if (form.kind === 'actual' && form.date) entry.date = form.date;
  const notes = form.notes.trim();
  if (notes) entry.notes = notes;
  return entry;
}

function BudgetForm({ initial, fxRate, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const [notesOpen, setNotesOpen] = useState(!!initial.notes);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const amount = Number(form.amount);
  const valid = amount > 0 && form.category && form.paidBy.trim()
    && (form.kind !== 'actual' || form.date);

  return (
    <form
      className="budget-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(formToEntry(form, fxRate)); }}
    >
      <input
        className="budget__amount-input"
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        autoFocus
        value={form.amount}
        onChange={set('amount')}
        placeholder="0"
        aria-label={`Amount in ${form.currency}`}
      />
      <div className="budget-form__chips" role="group" aria-label="Currency">
        <FilterChip selected={form.currency === 'JPY'} onClick={() => setVal('currency', 'JPY')}>¥ JPY</FilterChip>
        <FilterChip selected={form.currency === 'USD'} onClick={() => setVal('currency', 'USD')}>$ USD</FilterChip>
      </div>
      <div className="budget-form__cats" role="group" aria-label="Category">
        {CATEGORIES.map((c) => (
          <FilterChip key={c} selected={form.category === c} onClick={() => setVal('category', c)}>
            {CAT_ICO[c]} {CAT_LABELS[c]}
          </FilterChip>
        ))}
      </div>
      <Field label="Item">
        <Input value={form.item} onChange={set('item')} placeholder="What was it?" />
      </Field>
      <div className="budget-form__chips" role="group" aria-label="Kind">
        <FilterChip selected={form.kind === 'actual'} onClick={() => setVal('kind', 'actual')}>Actual</FilterChip>
        <FilterChip selected={form.kind === 'estimate'} onClick={() => setVal('kind', 'estimate')}>Estimate</FilterChip>
      </div>
      {form.kind === 'actual' && (
        <Field label="Date">
          <Input type="date" value={form.date} onChange={set('date')} required />
        </Field>
      )}
      <Field label="Paid by">
        <Input value={form.paidBy} onChange={set('paidBy')} placeholder="Who paid" required />
      </Field>
      {notesOpen ? (
        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering…" />
        </Field>
      ) : (
        <button type="button" className="budget-form__notes-link" onClick={() => setNotesOpen(true)}>
          Add note +
        </button>
      )}
      <Button variant="primary" block disabled={!valid}>{submitLabel}</Button>
    </form>
  );
}

/* ---- detail sheet -------------------------------------------------------------- */
function EntryDetail({ entry, fxRate, onEdit, onDelete, onClose }) {
  const rows = [
    ['Amount', [
      entry.amountJPY != null && fmtJPY(entry.amountJPY),
      fmtUSD(toUSD(entry, fxRate)),
    ].filter(Boolean).join(' · ')],
    ['Category', `${CAT_ICO[entry.category] || '•'} ${CAT_LABELS[entry.category] || entry.category}`],
    ['Kind', entry.kind === 'estimate' ? 'Estimate' : 'Actual'],
    ['Date', entry.date ? fmtDate(entry.date) : ''],
    ['Paid by', entry.paidBy],
    ['Notes', entry.notes],
  ].filter(([, v]) => v);

  return (
    <BottomSheet title={entry.item || CAT_LABELS[entry.category] || 'Entry'} onClose={onClose}>
      <div className="budget-detail__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="budget-detail__row">
            <span className="budget-detail__label">{label}</span>
            <span className="budget-detail__value">{value}</span>
          </div>
        ))}
      </div>
      <div className="budget-detail__actions">
        <Button variant="secondary" block onClick={onEdit}>Edit</Button>
        <Button variant="destructive" block onClick={onDelete}>Delete</Button>
      </div>
    </BottomSheet>
  );
}

/* ---- summary header ------------------------------------------------------------ */
function Summary({ docs, fxRate }) {
  const byCat = useMemo(() => {
    const m = {};
    for (const c of CATEGORIES) m[c] = { actual: 0, estimate: 0, count: 0 };
    let actualTotal = 0;
    let estimateTotal = 0;
    for (const d of docs) {
      const cat = m[d.category] ? d.category : 'other';
      const usd = toUSD(d, fxRate);
      m[cat].count += 1;
      if (d.kind === 'estimate') { m[cat].estimate += usd; estimateTotal += usd; }
      else { m[cat].actual += usd; actualTotal += usd; }
    }
    return { m, actualTotal, estimateTotal };
  }, [docs, fxRate]);

  if (docs.length === 0) return null;
  const { m, actualTotal, estimateTotal } = byCat;

  return (
    <div className="budget__summary">
      <div className="budget__total">
        {fmtUSD(actualTotal)} <span className="budget__total-est">/ {fmtUSD(estimateTotal)} est</span>
      </div>
      {CATEGORIES.filter((c) => m[c].count > 0).map((c) => {
        const { actual, estimate } = m[c];
        const over = estimate > 0 ? actual > estimate : actual > 0;
        const pct = estimate > 0 ? Math.min((actual / estimate) * 100, 100) : (actual > 0 ? 100 : 0);
        return (
          <div key={c} className="budget__cat-row">
            <span className="budget__cat-label">{CAT_LABELS[c]}</span>
            <span className="budget__bar-track">
              <span
                className={'budget__bar-fill' + (over ? ' budget__bar-fill--over' : '')}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="budget__cat-amt">{fmtUSD(actual)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- ledger row ------------------------------------------------------------------ */
function EntryRow({ entry, fxRate, onSelect }) {
  return (
    <div
      className="budget__row"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      <span className="budget__row-ico" aria-hidden="true">{CAT_ICO[entry.category] || '•'}</span>
      <span className="budget__row-main">
        <span className="budget__row-name">{entry.item || CAT_LABELS[entry.category] || 'Entry'}</span>
        <span className="budget__row-meta">
          {[entry.paidBy, CAT_LABELS[entry.category]].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="budget__row-amt">
        <span className="budget__amt-jpy">{fmtJPY(toJPY(entry, fxRate))}</span>
        <span className="budget__amt-usd">{fmtUSD(toUSD(entry, fxRate))}</span>
      </span>
    </div>
  );
}

/* ---- page -------------------------------------------------------------------------- */
export default function BudgetPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  // No server orderBy: estimates may lack `date` and Firestore drops docs
  // missing an orderBy field — sort client-side instead.
  const { docs, loading, error } = useCollection(['budget']);
  const fxRate = useFxRate();

  const [view, setView] = useState('actual');
  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'budget')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            Budget isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const selected = docs.find((d) => d.id === selectedId) || null;

  /* Actuals grouped by date, newest day first. */
  const actuals = docs.filter((d) => d.kind !== 'estimate');
  const dateGroups = [];
  for (const e of [...actuals].sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
    const key = e.date || '';
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.date === key) last.entries.push(e);
    else dateGroups.push({ date: key, entries: [e] });
  }

  /* Estimates grouped by category, fixed order. */
  const estimates = docs.filter((d) => d.kind === 'estimate');
  const catGroups = CATEGORIES
    .map((c) => ({ cat: c, entries: estimates.filter((e) => e.category === c) }))
    .filter((g) => g.entries.length > 0);

  const closeDetail = () => { setSelectedId(null); setEditing(false); setConfirmDelete(false); };

  const submitAdd = (entry) => {
    setAddOpen(false);
    const amt = entry.amountJPY != null ? `¥${entry.amountJPY}` : entry.amountUSD != null ? `$${entry.amountUSD}` : '';
    const title = entry.item || `${CAT_LABELS[entry.category] || entry.category} ${amt}`.trim();
    addItem(['budget'], entry, { activity: { verb: 'added', title, link: '/portal/budget' } }).catch(console.error);
  };
  const submitEdit = (entry) => {
    setEditing(false);
    updateItem(['budget', selected.id], entry).catch(console.error);
  };
  const doDelete = () => {
    const id = selected.id;
    closeDetail();
    removeItem(['budget', id]).catch(console.error);
  };

  const showing = view === 'actual' ? dateGroups.length : catGroups.length;

  return (
    <div className="budget">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Trip spending</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>BUDGET</h1>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the ledger — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading the ledger…</div>}

      {!loading && !error && (
        <>
          <Summary docs={docs} fxRate={fxRate} />

          <div className="budget__views" role="group" aria-label="View">
            <FilterChip selected={view === 'actual'} onClick={() => setView('actual')}>Actuals</FilterChip>
            <FilterChip selected={view === 'estimate'} onClick={() => setView('estimate')}>Estimates</FilterChip>
          </div>

          {showing === 0 && (
            <EmptyState
              line={view === 'actual'
                ? 'Nothing spent yet. Capture the first expense with the + button.'
                : 'No estimates yet. Sketch the budget with the + button.'}
            />
          )}

          {view === 'actual' && dateGroups.map((g) => (
            <div key={g.date || 'no-date'}>
              <div className="eyebrow budget__date-head">
                <span>{fmtDate(g.date)}</span>
                <span className="budget__date-sub">
                  {fmtUSD(g.entries.reduce((sum, e) => sum + toUSD(e, fxRate), 0))}
                </span>
              </div>
              {g.entries.map((e) => (
                <EntryRow key={e.id} entry={e} fxRate={fxRate} onSelect={() => setSelectedId(e.id)} />
              ))}
            </div>
          ))}

          {view === 'estimate' && catGroups.map((g) => (
            <div key={g.cat}>
              <div className="eyebrow budget__date-head">
                <span>{CAT_ICO[g.cat]} {CAT_LABELS[g.cat]}</span>
                <span className="budget__date-sub">
                  {fmtUSD(g.entries.reduce((sum, e) => sum + toUSD(e, fxRate), 0))}
                </span>
              </div>
              {g.entries.map((e) => (
                <EntryRow key={e.id} entry={e} fxRate={fxRate} onSelect={() => setSelectedId(e.id)} />
              ))}
            </div>
          ))}
        </>
      )}

      <button className="budget-fab" onClick={() => setAddOpen(true)} aria-label="Add budget entry">+</button>

      {addOpen && (
        <BottomSheet title="Add entry" onClose={() => setAddOpen(false)}>
          <BudgetForm initial={entryToForm(null, member?.name)} fxRate={fxRate} onSubmit={submitAdd} submitLabel="Add entry" />
        </BottomSheet>
      )}

      {selected && !editing && (
        <EntryDetail
          entry={selected}
          fxRate={fxRate}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onClose={closeDetail}
        />
      )}

      {selected && editing && (
        <BottomSheet title="Edit entry" onClose={() => setEditing(false)}>
          <BudgetForm
            initial={entryToForm(selected, member?.name)}
            fxRate={fxRate}
            onSubmit={submitEdit}
            submitLabel="Save changes"
          />
        </BottomSheet>
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          body={`${selected.item || CAT_LABELS[selected.category] || 'This entry'} will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
