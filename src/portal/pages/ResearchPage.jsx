// ResearchPage — shared research board (spec 11). Live Firestore
// research/{autoId}: places, activities, and logistics findings collected
// during planning. City tabs in route order (+ General + All), filter chips
// by category and status (rejected hidden by default), cards with a big
// tappable star button (per-member `stars` map, like journal's per-member
// entries), tap-card detail sheet with link-out / pin / edit / delete, and a
// quick-add FAB. Hermes is the primary populator later; no seed data here.

import { useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState, Field, FilterChip, Input, Select, StatusChip, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import { ROUTE } from '../../tripData.js';
import './research.css';

const CAT_ICO = {
  sight: '⛩', activity: '🎏', food: '🍜', shopping: '🛍', logistics: '🧭', daytrip: '🚆',
};
const CAT_LABEL = {
  sight: 'Sight', activity: 'Activity', food: 'Food',
  shopping: 'Shopping', logistics: 'Logistics', daytrip: 'Day trip',
};
const CATEGORIES = Object.keys(CAT_ICO);
const STATUSES = ['idea', 'shortlist', 'booked', 'rejected'];
const STATUS_LABEL = { idea: 'Idea', shortlist: 'Shortlist', booked: 'Booked', rejected: 'Rejected' };

const CITIES = ROUTE.map((r) => r.city); // route order
const GENERAL = 'general';

const EMPTY_FORM = {
  title: '', url: '', notes: '', city: GENERAL, category: 'sight',
  tags: '', cost: '', lat: '', lng: '', status: 'idea',
};

/* star helpers — stars is a map { [memberName]: true } */
const starCount = (stars) => (stars ? Object.keys(stars).length : 0);
const hasStar = (stars, name) => !!(stars && name && stars[name]);
/* updateItem is a shallow patch, so always write the WHOLE new stars object */
function toggledStars(stars, name) {
  const next = { ...(stars || {}) };
  if (next[name]) delete next[name];
  else next[name] = true;
  return next;
}

/* Drop empty optionals; build tags[] and ll[] when present. */
function cleanForm(form) {
  const out = {
    title: form.title.trim(),
    city: form.city,
    category: form.category,
    status: form.status,
  };
  for (const k of ['url', 'notes', 'cost']) {
    const v = (form[k] || '').trim();
    if (v) out[k] = v;
  }
  const tags = (form.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length) out.tags = tags;
  const lat = parseFloat(form.lat);
  const lng = parseFloat(form.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) out.ll = [lat, lng];
  return out;
}

/* ---- star button (≥44px touch target) -------------------------------------- */
function StarButton({ stars, memberName, onToggle, big }) {
  const count = starCount(stars);
  const mine = hasStar(stars, memberName);
  return (
    <button
      type="button"
      className={'star-btn' + (big ? ' star-btn--big' : '') + (mine ? ' star-btn--on' : '')}
      aria-pressed={mine}
      aria-label={mine ? `Starred — ${count}. Tap to remove your star.` : `${count} stars. Tap to star.`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <span className="star-btn__glyph" aria-hidden="true">{mine ? '★' : '☆'}</span>
      <span className="star-btn__count">{count}</span>
    </button>
  );
}

/* ---- add / edit form -------------------------------------------------------- */
function ResearchForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.title.trim().length > 0;

  return (
    <form
      className="research-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(cleanForm(form)); }}
    >
      <Field label="Title">
        <Input value={form.title} onChange={set('title')} placeholder="Fushimi Inari at dawn" required />
      </Field>
      <Field label="Link (optional)" hint="Source URL — blog, map, official site.">
        <Input type="url" value={form.url} onChange={set('url')} placeholder="https://…" />
      </Field>
      <Field label="Notes" hint="Summary / why it's interesting.">
        <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Ten thousand vermilion gates — go early to beat crowds." />
      </Field>
      <div className="research-form__pair">
        <Field label="City">
          <Select value={form.city} onChange={set('city')}>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={GENERAL}>General</option>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Tags" hint="Comma-separated — kids, rainy-day, reservation-needed, free…">
        <Input value={form.tags} onChange={set('tags')} placeholder="kids, free" />
      </Field>
      <Field label="Cost (optional)" hint="Freeform — “¥1,200/adult”.">
        <Input value={form.cost} onChange={set('cost')} placeholder="¥1,200/adult" />
      </Field>
      <div className="research-form__pair">
        <Field label="Lat (optional)">
          <Input type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="34.9671" />
        </Field>
        <Field label="Lng (optional)">
          <Input type="number" step="any" value={form.lng} onChange={set('lng')} placeholder="135.7727" />
        </Field>
      </div>
      <Field label="Status">
        <Select value={form.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      </Field>
      <Button variant="primary" block disabled={!valid}>{submitLabel}</Button>
    </form>
  );
}

/* ---- detail sheet ----------------------------------------------------------- */
function ResearchDetail({ item, memberName, onStar, onPin, onEdit, onDelete, onClose }) {
  const cityLabel = item.city === GENERAL ? 'General' : item.city;
  const rows = [
    ['Category', `${CAT_ICO[item.category] || '•'} ${CAT_LABEL[item.category] || item.category}`],
    ['City', cityLabel],
    ['Status', STATUS_LABEL[item.status] || item.status],
    ['Cost', item.cost],
    ['Tags', (item.tags || []).join(' · ')],
    ['Coords', Array.isArray(item.ll) ? item.ll.join(', ') : ''],
    ['Notes', item.notes],
  ].filter(([, v]) => v);

  return (
    <BottomSheet title={item.title} onClose={onClose}>
      <div className="research-detail__top">
        <StatusChip status={item.status} />
        {item.pinned && <span className="research-detail__pinned">📌 Pinned</span>}
        <span className="research-detail__spacer" />
        <StarButton stars={item.stars} memberName={memberName} onToggle={onStar} big />
      </div>

      {item.url && (
        <a className="research-detail__link" href={item.url} target="_blank" rel="noopener noreferrer">
          Open source link ↗
        </a>
      )}

      <div className="research-detail__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="research-detail__row">
            <span className="research-detail__label">{label}</span>
            <span className="research-detail__value">{value}</span>
          </div>
        ))}
      </div>

      {/* "Add to itinerary…" (spec 12) and "Add to food list" (spec 18) are
          deferred until those features land — omitted intentionally for now. */}

      <div className="research-detail__actions">
        <Button variant="secondary" block onClick={onPin}>{item.pinned ? 'Unpin' : 'Pin'}</Button>
        <Button variant="secondary" block onClick={onEdit}>Edit</Button>
        <Button variant="destructive" block onClick={onDelete}>Delete</Button>
      </div>
    </BottomSheet>
  );
}

/* ---- card ------------------------------------------------------------------- */
function ResearchCard({ item, memberName, onOpen, onStar }) {
  return (
    <div
      className={'research-card' + (item.pinned ? ' research-card--pinned' : '')}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      {item.pinned && <div className="research-card__pinflag"><span aria-hidden="true">📌</span> Pinned</div>}
      <div className="research-card__head">
        <span className="research-card__cat" aria-hidden="true">{CAT_ICO[item.category] || '•'}</span>
        <span className="research-card__title">{item.title}</span>
        <StatusChip status={item.status} />
      </div>
      {item.notes && <div className="research-card__note">{item.notes}</div>}
      <div className="research-card__foot">
        <span className="research-card__cattag">{CAT_LABEL[item.category] || item.category}</span>
        <StarButton stars={item.stars} memberName={memberName} onToggle={onStar} />
      </div>
    </div>
  );
}

/* ---- page ------------------------------------------------------------------- */
export default function ResearchPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  const memberName = member?.name || '';
  const { docs, loading, error } = useCollection(['research']);

  const [tab, setTab] = useState('all'); // 'all' | 'general' | <city>
  const [catFilter, setCatFilter] = useState('all');
  const [showRejected, setShowRejected] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'research')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The research board isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const selected = docs.find((d) => d.id === selectedId) || null;

  /* filter → city tab + category + rejected toggle */
  const visible = docs.filter((d) => {
    if (tab !== 'all' && d.city !== tab) return false;
    if (catFilter !== 'all' && d.category !== catFilter) return false;
    if (d.status === 'rejected' && !showRejected) return false;
    return true;
  });

  /* sort: pinned first, then star count desc, then title */
  visible.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const sc = starCount(b.stars) - starCount(a.stars);
    if (sc) return sc;
    return (a.title || '').localeCompare(b.title || '');
  });

  const closeDetail = () => { setSelectedId(null); setEditing(false); setConfirmDelete(false); };

  const star = (item) => {
    updateItem(['research', item.id], { stars: toggledStars(item.stars, memberName) }).catch(console.error);
  };
  const togglePin = (item) => {
    updateItem(['research', item.id], { pinned: !item.pinned }).catch(console.error);
  };
  const submitAdd = (data) => {
    setAddOpen(false);
    addItem(['research'], { ...data, stars: {}, pinned: false }).catch(console.error);
  };
  const submitEdit = (data) => {
    setEditing(false);
    updateItem(['research', selected.id], data).catch(console.error);
  };
  const doDelete = () => {
    const id = selected.id;
    closeDetail();
    removeItem(['research', id]).catch(console.error);
  };

  /* edit form initial — flatten ll/tags back into the flat form shape */
  const editInitial = () => ({
    ...EMPTY_FORM,
    title: selected.title || '',
    url: selected.url || '',
    notes: selected.notes || '',
    city: selected.city || GENERAL,
    category: selected.category || 'sight',
    tags: (selected.tags || []).join(', '),
    cost: selected.cost || '',
    lat: Array.isArray(selected.ll) ? String(selected.ll[0]) : '',
    lng: Array.isArray(selected.ll) ? String(selected.ll[1]) : '',
    status: selected.status || 'idea',
  });

  return (
    <div className="research">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Shared shortlist</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>RESEARCH</h1>

      {/* city tabs — route order + General + All */}
      <div className="research__tabs">
        <FilterChip sm selected={tab === 'all'} onClick={() => setTab('all')}>All</FilterChip>
        {CITIES.map((c) => (
          <FilterChip key={c} sm selected={tab === c} onClick={() => setTab(c)}>{c}</FilterChip>
        ))}
        <FilterChip sm selected={tab === GENERAL} onClick={() => setTab(GENERAL)}>General</FilterChip>
      </div>

      {/* category filter */}
      <div className="research__filters">
        <FilterChip sm selected={catFilter === 'all'} onClick={() => setCatFilter('all')}>All types</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} sm selected={catFilter === c} onClick={() => setCatFilter(c)}>
            {CAT_ICO[c]} {CAT_LABEL[c]}
          </FilterChip>
        ))}
      </div>

      {/* status filter — just the rejected toggle (others always shown) */}
      <div className="research__filters">
        <FilterChip sm selected={showRejected} onClick={() => setShowRejected((v) => !v)}>
          {showRejected ? '✓ Showing rejected' : 'Show rejected'}
        </FilterChip>
      </div>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the research board — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading finds…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No finds yet. Add the first place or idea with the + button." />
      )}

      {!loading && !error && docs.length > 0 && visible.length === 0 && (
        <div className="metaline" style={{ padding: '24px 0', textAlign: 'center' }}>
          Nothing here for this filter yet.
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="research__grid">
          {visible.map((item) => (
            <ResearchCard
              key={item.id}
              item={item}
              memberName={memberName}
              onOpen={() => setSelectedId(item.id)}
              onStar={() => star(item)}
            />
          ))}
        </div>
      )}

      <button className="research-fab" onClick={() => setAddOpen(true)} aria-label="Add a find">+</button>

      {addOpen && (
        <BottomSheet title="Add a find" onClose={() => setAddOpen(false)}>
          <ResearchForm initial={EMPTY_FORM} onSubmit={submitAdd} submitLabel="Add find" />
        </BottomSheet>
      )}

      {selected && !editing && (
        <ResearchDetail
          item={selected}
          memberName={memberName}
          onStar={() => star(selected)}
          onPin={() => togglePin(selected)}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onClose={closeDetail}
        />
      )}

      {selected && editing && (
        <BottomSheet title="Edit find" onClose={() => setEditing(false)}>
          <ResearchForm initial={editInitial()} onSubmit={submitEdit} submitLabel="Save changes" />
        </BottomSheet>
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete this find?"
          body={`“${selected.title}” will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
