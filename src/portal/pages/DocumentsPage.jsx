// DocumentsPage — document vault (spec 17). Live Firestore documents/{autoId},
// category-grouped cards (passports, insurance, bookings, contacts, checklist),
// each doc rendering a copyable label→value fields table. Tap a card → detail
// BottomSheet with fields + url + notes + Edit/Delete; FAB → add sheet with a
// repeatable fields editor; delete via ConfirmDialog. A static "Emergencies"
// card is pinned at the top (hardcoded, not a Firestore doc).
//
// SECURITY (spec 17): the vault stores REFERENCES, not secrets — data sits
// plaintext in Firestore + every device's offline cache. Tier 1 store freely,
// Tier 2 (passports) store last-4 + expiry only, Tier 3 never store full
// numbers/scans. The passports banner restates this.

import { useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { Button, EmptyState, Field, Input, Select, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import './documents.css';

const CATEGORY_ORDER = ['passports', 'insurance', 'bookings', 'contacts', 'checklist'];
const CATEGORY_LABEL = {
  passports: 'Passports',
  insurance: 'Insurance',
  bookings: 'Bookings',
  contacts: 'Contacts',
  checklist: 'Checklist',
};

const PASSPORT_BANNER =
  'Store last-4 + expiry only. Never full numbers or scans — those live in the '
  + 'physical pouch and phone wallets.';

/* Static Emergencies card (spec 17): hardcoded, not a Firestore doc. The
   insurance claim line has no value on purpose — the family fills it per-policy
   by adding their own insurance document. */
const EMERGENCY_ROWS = [
  { label: 'Police', value: '110' },
  { label: 'Ambulance / Fire', value: '119' },
  { label: 'Japan Visitor Hotline (24h)', value: '050-3816-2787' },
  { label: 'Thai Embassy Tokyo', value: '+81-3-5789-2433' },
  { label: 'Insurance claim line', value: '', hint: 'Add your own insurance doc to fill this in.' },
];

/* tel: href — strip spaces/dashes but keep a leading + */
function telHref(value) {
  const cleaned = value.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
}

/* ---- copyable value row ----------------------------------------------------- */
function CopyRow({ label, value, hint, tel }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(console.error);
  };
  const href = tel ? telHref(value) : null;

  return (
    <div className="doc-field">
      <span className="doc-field__label">{label}</span>
      <span className="doc-field__main">
        {value
          ? (href
              ? <a className="doc-field__value doc-field__value--link" href={href}>{value}</a>
              : <span className="doc-field__value">{value}</span>)
          : <span className="doc-field__value doc-field__value--empty">—</span>}
        {hint && <span className="doc-field__hint">{hint}</span>}
      </span>
      {value && (
        <button className="doc-field__copy" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      )}
    </div>
  );
}

/* ---- add / edit form -------------------------------------------------------- */
const EMPTY_FIELD = { label: '', value: '' };

function fieldsToRows(fields) {
  const rows = Object.entries(fields || {}).map(([label, value]) => ({ label, value: String(value) }));
  return rows.length ? rows : [{ ...EMPTY_FIELD }];
}

function rowsToFields(rows) {
  const out = {};
  for (const { label, value } of rows) {
    const l = label.trim();
    const v = value.trim();
    if (l && v) out[l] = v;
  }
  return out;
}

function DocForm({ initial, onSubmit, submitLabel }) {
  const [title, setTitle] = useState(initial.title || '');
  const [category, setCategory] = useState(initial.category || 'bookings');
  const [rows, setRows] = useState(() => fieldsToRows(initial.fields));
  const [url, setUrl] = useState(initial.url || '');
  const [notes, setNotes] = useState(initial.notes || '');

  const setRow = (i, k) => (e) => {
    const v = e.target.value;
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  };
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_FIELD }]);
  const removeRow = (i) => setRows((rs) => (rs.length === 1 ? [{ ...EMPTY_FIELD }] : rs.filter((_, idx) => idx !== i)));

  const valid = title.trim().length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const entry = { title: title.trim(), category };
    const fields = rowsToFields(rows);
    if (Object.keys(fields).length) entry.fields = fields;
    const u = url.trim();
    if (u) entry.url = u;
    const n = notes.trim();
    if (n) entry.notes = n;
    onSubmit(entry);
  };

  return (
    <form className="doc-form" onSubmit={submit}>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Travel insurance — AXA" required />
      </Field>
      <Field label="Category">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </Select>
      </Field>

      {category === 'passports' && (
        <div className="doc-banner" role="note">{PASSPORT_BANNER}</div>
      )}

      <div className="doc-form__fields">
        <span className="field__label">Fields</span>
        {rows.map((row, i) => (
          <div key={i} className="doc-form__row">
            <Input
              className="input"
              value={row.label}
              onChange={setRow(i, 'label')}
              placeholder="Label"
              aria-label={`Field ${i + 1} label`}
            />
            <Input
              className="input"
              value={row.value}
              onChange={setRow(i, 'value')}
              placeholder="Value"
              aria-label={`Field ${i + 1} value`}
            />
            <button
              type="button"
              className="doc-form__rm"
              onClick={() => removeRow(i)}
              aria-label={`Remove field ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="doc-form__add" onClick={addRow}>+ Add field</button>
      </div>

      <Field label="Link (optional)">
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Notes (optional)">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" />
      </Field>

      <Button variant="primary" block disabled={!valid}>{submitLabel}</Button>
    </form>
  );
}

/* ---- detail sheet ----------------------------------------------------------- */
function DocDetail({ doc, onEdit, onDelete, onClose }) {
  const fields = Object.entries(doc.fields || {});
  return (
    <BottomSheet title={doc.title} onClose={onClose}>
      <div className="doc-detail__cat">{CATEGORY_LABEL[doc.category] || doc.category}</div>

      {doc.category === 'passports' && (
        <div className="doc-banner" role="note">{PASSPORT_BANNER}</div>
      )}

      {fields.length > 0 && (
        <div className="doc-fields">
          {fields.map(([label, value]) => (
            <CopyRow key={label} label={label} value={String(value)} />
          ))}
        </div>
      )}

      {doc.url && (
        <a className="doc-detail__link" href={doc.url} target="_blank" rel="noreferrer">
          Open link ↗
        </a>
      )}

      {doc.notes && <p className="doc-detail__notes">{doc.notes}</p>}

      <div className="doc-detail__actions">
        <Button variant="secondary" block onClick={onEdit}>Edit</Button>
        <Button variant="destructive" block onClick={onDelete}>Delete</Button>
      </div>
    </BottomSheet>
  );
}

/* ---- document card ---------------------------------------------------------- */
function DocCard({ doc, onOpen }) {
  const fields = Object.entries(doc.fields || {});
  return (
    <div
      className="doc-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <div className="doc-card__title">{doc.title}</div>
      {fields.length > 0 && (
        <div className="doc-fields">
          {fields.map(([label, value]) => (
            <CopyRow key={label} label={label} value={String(value)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- page ------------------------------------------------------------------- */
export default function DocumentsPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { docs, loading, error } = useCollection(['documents']);

  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'documents')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The document vault isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const selected = docs.find((d) => d.id === selectedId) || null;

  const byCategory = (cat) => docs.filter((d) => (d.category || 'bookings') === cat);

  const closeDetail = () => { setSelectedId(null); setEditing(false); setConfirmDelete(false); };

  const submitAdd = (data) => {
    setAddOpen(false);
    addItem(['documents'], data).catch(console.error);
  };
  const submitEdit = (data) => {
    setEditing(false);
    updateItem(['documents', selected.id], data).catch(console.error);
  };
  const doDelete = () => {
    const id = selected.id;
    closeDetail();
    removeItem(['documents', id]).catch(console.error);
  };

  return (
    <div className="documents">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Refs &amp; contacts</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>DOCUMENTS</h1>

      {/* pinned static Emergencies card */}
      <div className="doc-card doc-card--emergency">
        <div className="doc-card__title">Emergencies</div>
        <div className="doc-fields">
          {EMERGENCY_ROWS.map((r) => (
            <CopyRow key={r.label} label={r.label} value={r.value} hint={r.hint} tel />
          ))}
        </div>
      </div>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load documents — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading documents…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No documents yet. Add a booking ref, insurance, or contact with the + button." />
      )}

      {!loading && !error && CATEGORY_ORDER.map((cat) => {
        const group = byCategory(cat);
        if (group.length === 0) return null;
        return (
          <div key={cat} className="doc-group">
            <div className="eyebrow doc-group__head">{CATEGORY_LABEL[cat]}</div>
            {group.map((d) => (
              <DocCard key={d.id} doc={d} onOpen={() => setSelectedId(d.id)} />
            ))}
          </div>
        );
      })}

      <button className="documents-fab" onClick={() => setAddOpen(true)} aria-label="Add document">+</button>

      {addOpen && (
        <BottomSheet title="Add document" onClose={() => setAddOpen(false)}>
          <DocForm initial={{ category: 'bookings' }} onSubmit={submitAdd} submitLabel="Add document" />
        </BottomSheet>
      )}

      {selected && !editing && (
        <DocDetail
          doc={selected}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onClose={closeDetail}
        />
      )}

      {selected && editing && (
        <BottomSheet title="Edit document" onClose={() => setEditing(false)}>
          <DocForm initial={selected} onSubmit={submitEdit} submitLabel="Save changes" />
        </BottomSheet>
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete this document?"
          body={`"${selected.title}" will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
