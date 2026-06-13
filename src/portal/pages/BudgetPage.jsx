// BudgetPage — budget ledger (spec 14). One Firestore collection
// budget/{autoId} holds both pre-trip estimates and during-trip actuals;
// the summary header compares them per category. Amounts are canonical in
// JPY; THB display derives from config/main.fxRate (THB per ¥100).

import { useState, useMemo } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { useDoc } from '../../data/useDoc.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState, Field, FilterChip, Input, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import './budget.css';

const CATEGORIES = ['flights', 'stay', 'transport', 'food', 'activities', 'shopping', 'other'];
const CAT_LABELS = { flights: 'Flights', stay: 'Stay', transport: 'Transport', food: 'Food', activities: 'Activities', shopping: 'Shopping', other: 'Other' };
const CAT_ICO = { flights: '✈️', stay: '🛏', transport: '🚄', food: '🍜', activities: '⛩', shopping: '🛍', other: '📦' };

const FALLBACK_FX = 23; // THB per ¥100 when config/main is unavailable

/* ---- FX / formatting helpers ----------------------------------------------- */
function toTHB(entry, fxRate) {
  if (entry.amountTHB) return entry.amountTHB;
  if (entry.amountJPY) return (entry.amountJPY * fxRate) / 100;
  return 0;
}
function toJPY(entry, fxRate) {
  if (entry.amountJPY) return entry.amountJPY;
  if (entry.amountTHB) return (entry.amountTHB * 100) / fxRate;
  return 0;
}
function fmtTHB(n) { return '฿' + Math.round(n).toLocaleString(); }
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
  const isTHB = entry.amountJPY == null && entry.amountTHB != null;
  return {
    amount: String(isTHB ? entry.amountTHB : entry.amountJPY ?? ''),
    currency: isTHB ? 'THB' : 'JPY',
    category: entry.category || '',
    item: entry.item || '',
    kind: entry.kind || 'actual',
    date: entry.date || todayISO(),
    paidBy: entry.paidBy || memberName || '',
    notes: entry.notes || '',
  };
}

function formToEntry(form) {
  const entry = {
    category: form.category,
    kind: form.kind,
    paidBy: form.paidBy.trim(),
  };
  const amount = Number(form.amount);
  if (form.currency === 'THB') entry.amountTHB = amount;
  else entry.amountJPY = amount;
  const item = form.item.trim();
  if (item) entry.item = item;
  if (form.kind === 'actual' && form.date) entry.date = form.date;
  const notes = form.notes.trim();
  if (notes) entry.notes = notes;
  return entry;
}

function BudgetForm({ initial, onSubmit, submitLabel }) {
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
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(formToEntry(form)); }}
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
        <FilterChip selected={form.currency === 'THB'} onClick={() => setVal('currency', 'THB')}>฿ THB</FilterChip>
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
      fmtTHB(toTHB(entry, fxRate)),
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
      const thb = toTHB(d, fxRate);
      m[cat].count += 1;
      if (d.kind === 'estimate') { m[cat].estimate += thb; estimateTotal += thb; }
      else { m[cat].actual += thb; actualTotal += thb; }
    }
    return { m, actualTotal, estimateTotal };
  }, [docs, fxRate]);

  if (docs.length === 0) return null;
  const { m, actualTotal, estimateTotal } = byCat;

  return (
    <div className="budget__summary">
      <div className="budget__total">
        {fmtTHB(actualTotal)} <span className="budget__total-est">/ {fmtTHB(estimateTotal)} est</span>
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
            <span className="budget__cat-amt">{fmtTHB(actual)}</span>
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
        <span className="budget__amt-thb">{fmtTHB(toTHB(entry, fxRate))}</span>
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
  const { data: config } = useDoc(['config', 'main']);
  const fxRate = config?.fxRate || FALLBACK_FX;

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
    const amt = entry.amountJPY != null ? `¥${entry.amountJPY}` : entry.amountTHB != null ? `฿${entry.amountTHB}` : '';
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
                  {fmtTHB(g.entries.reduce((sum, e) => sum + toTHB(e, fxRate), 0))}
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
                  {fmtTHB(g.entries.reduce((sum, e) => sum + toTHB(e, fxRate), 0))}
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
          <BudgetForm initial={entryToForm(null, member?.name)} onSubmit={submitAdd} submitLabel="Add entry" />
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
