// FoodPage — shared food shortlist with kid-friendly voting (spec 18). Live
// Firestore food/{autoId}: places to eat collected during planning and rated
// after visiting. City tabs in route order (+ General + All), filter chips by
// meal / kid-friendly / status, a big tappable vote button (per-member `votes`
// map, one toggleable vote each — built so the kids will actually tap it),
// tap-card detail sheet with link-out / mark-visited+rate / edit / delete, and
// a quick-add FAB. Promotable from the research board (spec 11). The "Tonight?"
// shortcut filters to dinner ideas for the current city during the trip.

import { useState } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState, Field, FilterChip, Input, Select, StatusChip, Textarea } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import { Sun } from '../ui/primitives.jsx';
import { ROUTE, getTodayInfo } from '../../tripData.js';
import './food.css';

const CUISINE_ICO = {
  ramen: '🍜', sushi: '🍣', kaiseki: '🍱', izakaya: '🍶', sweets: '🍡', konbini: '🏪', other: '🍴',
};
const CUISINE_LABEL = {
  ramen: 'Ramen', sushi: 'Sushi', kaiseki: 'Kaiseki', izakaya: 'Izakaya',
  sweets: 'Sweets', konbini: 'Konbini', other: 'Other',
};
const CUISINES = Object.keys(CUISINE_ICO);

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

const STATUSES = ['idea', 'planned', 'visited'];
const STATUS_LABEL = { idea: 'Idea', planned: 'Planned', visited: 'Visited' };

const CITIES = ROUTE.map((r) => r.city); // route order
const GENERAL = 'general';

const EMPTY_FORM = {
  name: '', city: GENERAL, cuisine: 'other', meal: [], kidFriendly: false,
  url: '', notes: '', cost: '', lat: '', lng: '', status: 'idea',
};

/* vote helpers — votes is a map { [memberName]: 1 } */
const voteCount = (votes) => (votes ? Object.keys(votes).length : 0);
const hasVote = (votes, name) => !!(votes && name && votes[name]);
/* updateItem is a shallow patch, so always write the WHOLE new votes object */
function toggledVotes(votes, name) {
  const next = { ...(votes || {}) };
  if (next[name]) delete next[name];
  else next[name] = 1;
  return next;
}

/* Drop empty optionals; build meal[] and ll[] when present. */
function cleanForm(form) {
  const out = {
    name: form.name.trim(),
    city: form.city,
    cuisine: form.cuisine,
    kidFriendly: !!form.kidFriendly,
    status: form.status,
    meal: Array.isArray(form.meal) ? form.meal.filter((m) => MEALS.includes(m)) : [],
  };
  for (const k of ['url', 'notes', 'cost']) {
    const v = (form[k] || '').trim();
    if (v) out[k] = v;
  }
  const lat = parseFloat(form.lat);
  const lng = parseFloat(form.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) out.ll = [lat, lng];
  return out;
}

/* ---- read-only Sun rating (mirrors JournalPage's SunRating, ro pips) ------- */
function SunRating({ value }) {
  return (
    <div className="sun-rating sun-rating--ro" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="sun-rating__pip">
          <Sun size={16} color={n <= value ? 'var(--accent)' : 'var(--line-strong)'} />
        </span>
      ))}
    </div>
  );
}

/* interactive rating for "mark visited + rate" */
function SunPicker({ value, onChange }) {
  return (
    <div className="sun-rating" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="sun-rating__btn"
          aria-label={`${n} sun${n > 1 ? 's' : ''}`}
          aria-pressed={n <= value}
          onClick={() => onChange(n)}
        >
          <Sun size={26} color={n <= value ? 'var(--accent)' : 'var(--line-strong)'} />
        </button>
      ))}
    </div>
  );
}

/* ---- vote button (big — kids will tap it) ---------------------------------- */
function VoteButton({ votes, memberName, onToggle, big }) {
  const count = voteCount(votes);
  const mine = hasVote(votes, memberName);
  return (
    <button
      type="button"
      className={'vote-btn' + (big ? ' vote-btn--big' : '') + (mine ? ' vote-btn--on' : '')}
      aria-pressed={mine}
      aria-label={mine ? `Voted — ${count}. Tap to remove your vote.` : `${count} votes. Tap to vote.`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <span className="vote-btn__glyph" aria-hidden="true">{mine ? '♥' : '♡'}</span>
      <span className="vote-btn__count">{count}</span>
    </button>
  );
}

/* ---- meal multi-select (chips) --------------------------------------------- */
function MealPicker({ value, onChange }) {
  const toggle = (m) => {
    const set = new Set(value || []);
    if (set.has(m)) set.delete(m);
    else set.add(m);
    onChange(MEALS.filter((x) => set.has(x))); // keep canonical order
  };
  return (
    <div className="food-meals">
      {MEALS.map((m) => (
        <FilterChip key={m} sm selected={(value || []).includes(m)} onClick={() => toggle(m)}>
          {MEAL_LABEL[m]}
        </FilterChip>
      ))}
    </div>
  );
}

/* ---- add / edit form -------------------------------------------------------- */
function FoodForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim().length > 0;

  return (
    <form
      className="food-form"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(cleanForm(form)); }}
    >
      <Field label="Name">
        <Input value={form.name} onChange={set('name')} placeholder="Ichiran Ramen" required />
      </Field>
      <div className="food-form__pair">
        <Field label="City">
          <Select value={form.city} onChange={set('city')}>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={GENERAL}>General</option>
          </Select>
        </Field>
        <Field label="Cuisine">
          <Select value={form.cuisine} onChange={set('cuisine')}>
            {CUISINES.map((c) => <option key={c} value={c}>{CUISINE_LABEL[c]}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Meals" hint="When would we eat here?">
        <MealPicker value={form.meal} onChange={(meal) => setForm((f) => ({ ...f, meal }))} />
      </Field>
      <label className="food-form__toggle">
        <input
          type="checkbox"
          checked={!!form.kidFriendly}
          onChange={(e) => setForm((f) => ({ ...f, kidFriendly: e.target.checked }))}
        />
        <span>Kid-friendly</span>
      </label>
      <Field label="Link (optional)" hint="Map, blog, or official site.">
        <Input type="url" value={form.url} onChange={set('url')} placeholder="https://…" />
      </Field>
      <Field label="Notes" hint="Why it's worth a stop.">
        <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Tonkotsu broth, solo booths — easy with kids." />
      </Field>
      <Field label="Cost (optional)" hint="Freeform — “¥900/bowl”.">
        <Input value={form.cost} onChange={set('cost')} placeholder="¥900/bowl" />
      </Field>
      <div className="food-form__pair">
        <Field label="Lat (optional)">
          <Input type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="35.6762" />
        </Field>
        <Field label="Lng (optional)">
          <Input type="number" step="any" value={form.lng} onChange={set('lng')} placeholder="139.6503" />
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
function FoodDetail({ item, memberName, onVote, onEdit, onDelete, onMarkVisited, onClose }) {
  const [rating, setRating] = useState(item.rating || 0);
  const cityLabel = item.city === GENERAL ? 'General' : item.city;
  const meals = (item.meal || []).map((m) => MEAL_LABEL[m] || m).join(' · ');
  const rows = [
    ['Cuisine', `${CUISINE_ICO[item.cuisine] || '🍴'} ${CUISINE_LABEL[item.cuisine] || item.cuisine}`],
    ['City', cityLabel],
    ['Meals', meals],
    ['Status', STATUS_LABEL[item.status] || item.status],
    ['Cost', item.cost],
    ['Coords', Array.isArray(item.ll) ? item.ll.join(', ') : ''],
    ['Notes', item.notes],
  ].filter(([, v]) => v);

  return (
    <BottomSheet title={item.name} onClose={onClose}>
      <div className="food-detail__top">
        <StatusChip status={item.status} label={STATUS_LABEL[item.status]} />
        {item.kidFriendly && <span className="food-kid-badge">🧒 Kid-friendly</span>}
        <span className="food-detail__spacer" />
        <VoteButton votes={item.votes} memberName={memberName} onToggle={onVote} big />
      </div>

      {item.url && (
        <a className="food-detail__link" href={item.url} target="_blank" rel="noopener noreferrer">
          Open link ↗
        </a>
      )}

      <div className="food-detail__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="food-detail__row">
            <span className="food-detail__label">{label}</span>
            <span className="food-detail__value">{value}</span>
          </div>
        ))}
        {item.status === 'visited' && item.rating > 0 && (
          <div className="food-detail__row">
            <span className="food-detail__label">Rating</span>
            <span className="food-detail__value"><SunRating value={item.rating} /></span>
          </div>
        )}
      </div>

      {item.researchId && (
        <div className="food-detail__from">From the research board.</div>
      )}

      {/* Mark visited + rate */}
      <div className="food-visit">
        <div className="food-visit__head">{item.status === 'visited' ? 'Update rating' : 'Been here? Rate it'}</div>
        <SunPicker value={rating} onChange={setRating} />
        <Button
          variant="secondary"
          block
          disabled={rating < 1}
          onClick={() => onMarkVisited(rating)}
        >
          {item.status === 'visited' ? 'Save rating' : 'Mark visited'}
        </Button>
      </div>

      <div className="food-detail__actions">
        <Button variant="secondary" block onClick={onEdit}>Edit</Button>
        <Button variant="destructive" block onClick={onDelete}>Delete</Button>
      </div>
    </BottomSheet>
  );
}

/* ---- card ------------------------------------------------------------------- */
function FoodCard({ item, memberName, onOpen, onVote }) {
  return (
    <div
      className="food-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <div className="food-card__head">
        <span className="food-card__cuisine" aria-hidden="true">{CUISINE_ICO[item.cuisine] || '🍴'}</span>
        <span className="food-card__title">{item.name}</span>
        <StatusChip status={item.status} label={STATUS_LABEL[item.status]} />
      </div>
      <div className="food-card__tags">
        {item.kidFriendly && <span className="food-kid-badge food-kid-badge--sm">🧒 Kid-friendly</span>}
        {item.status === 'visited' && item.rating > 0 && <SunRating value={item.rating} />}
      </div>
      {item.notes && <div className="food-card__note">{item.notes}</div>}
      <div className="food-card__foot">
        <span className="food-card__cuisinetag">{CUISINE_LABEL[item.cuisine] || item.cuisine}</span>
        <VoteButton votes={item.votes} memberName={memberName} onToggle={onVote} big />
      </div>
    </div>
  );
}

/* ---- page ------------------------------------------------------------------- */
export default function FoodPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  const memberName = member?.name || '';
  const { docs, loading, error } = useCollection(['food']);

  const today = getTodayInfo();
  const duringTrip = today.phase === 'during';
  const currentCity = today.stop?.city || '';

  const [tab, setTab] = useState('all'); // 'all' | 'general' | <city>
  const [mealFilter, setMealFilter] = useState('all');
  const [kidOnly, setKidOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tonight, setTonight] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'food')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The food list isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const selected = docs.find((d) => d.id === selectedId) || null;

  /* "Tonight?" shortcut: during the trip → current city + dinner + not visited.
     Pre-trip it just narrows to dinner ideas across the board. */
  const visible = docs.filter((d) => {
    if (tonight) {
      if (!(d.meal || []).includes('dinner')) return false;
      if (d.status === 'visited') return false;
      if (duringTrip && currentCity && d.city !== currentCity) return false;
      return true;
    }
    if (tab !== 'all' && d.city !== tab) return false;
    if (mealFilter !== 'all' && !(d.meal || []).includes(mealFilter)) return false;
    if (kidOnly && !d.kidFriendly) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  /* sort: vote count desc, then name */
  visible.sort((a, b) => {
    const vc = voteCount(b.votes) - voteCount(a.votes);
    if (vc) return vc;
    return (a.name || '').localeCompare(b.name || '');
  });

  const closeDetail = () => { setSelectedId(null); setEditing(false); setConfirmDelete(false); };

  const vote = (item) => {
    updateItem(['food', item.id], { votes: toggledVotes(item.votes, memberName) }).catch(console.error);
  };
  const submitAdd = (data) => {
    setAddOpen(false);
    addItem(['food'], { ...data, votes: {} }, { activity: { verb: 'added', title: data.name, link: '/portal/food' } }).catch(console.error);
  };
  const submitEdit = (data) => {
    setEditing(false);
    updateItem(['food', selected.id], data).catch(console.error);
  };
  const markVisited = (rating) => {
    updateItem(['food', selected.id], { status: 'visited', rating }).catch(console.error);
  };
  const doDelete = () => {
    const id = selected.id;
    closeDetail();
    removeItem(['food', id]).catch(console.error);
  };

  /* edit form initial — flatten ll back into the flat form shape */
  const editInitial = () => ({
    ...EMPTY_FORM,
    name: selected.name || '',
    city: selected.city || GENERAL,
    cuisine: selected.cuisine || 'other',
    meal: Array.isArray(selected.meal) ? selected.meal : [],
    kidFriendly: !!selected.kidFriendly,
    url: selected.url || '',
    notes: selected.notes || '',
    cost: selected.cost || '',
    lat: Array.isArray(selected.ll) ? String(selected.ll[0]) : '',
    lng: Array.isArray(selected.ll) ? String(selected.ll[1]) : '',
    status: selected.status || 'idea',
  });

  return (
    <div className="food">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Where we eat</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>FOOD</h1>

      {/* "Tonight?" shortcut */}
      <div className="food__filters">
        <FilterChip sm selected={tonight} onClick={() => setTonight((v) => !v)}>
          {tonight ? '✓ Tonight?' : '🌙 Tonight?'}
        </FilterChip>
        {tonight && duringTrip && currentCity && (
          <span className="food__tonight-note">{currentCity} · dinner</span>
        )}
      </div>

      {/* city tabs — route order + General + All (hidden while Tonight is on) */}
      {!tonight && (
        <>
          <div className="food__tabs">
            <FilterChip sm selected={tab === 'all'} onClick={() => setTab('all')}>All</FilterChip>
            {CITIES.map((c) => (
              <FilterChip key={c} sm selected={tab === c} onClick={() => setTab(c)}>{c}</FilterChip>
            ))}
            <FilterChip sm selected={tab === GENERAL} onClick={() => setTab(GENERAL)}>General</FilterChip>
          </div>

          {/* meal + kid-friendly filters */}
          <div className="food__filters">
            <FilterChip sm selected={mealFilter === 'all'} onClick={() => setMealFilter('all')}>Any meal</FilterChip>
            {MEALS.map((m) => (
              <FilterChip key={m} sm selected={mealFilter === m} onClick={() => setMealFilter(m)}>
                {MEAL_LABEL[m]}
              </FilterChip>
            ))}
            <FilterChip sm selected={kidOnly} onClick={() => setKidOnly((v) => !v)}>
              {kidOnly ? '✓ Kid-friendly' : '🧒 Kid-friendly'}
            </FilterChip>
          </div>

          {/* status filter */}
          <div className="food__filters">
            <FilterChip sm selected={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterChip>
            {STATUSES.map((s) => (
              <FilterChip key={s} sm selected={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {STATUS_LABEL[s]}
              </FilterChip>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the food list — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading the menu…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No spots yet. Add the first place to eat with the + button." />
      )}

      {!loading && !error && docs.length > 0 && visible.length === 0 && (
        <div className="metaline" style={{ padding: '24px 0', textAlign: 'center' }}>
          Nothing here for this filter yet.
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="food__grid">
          {visible.map((item) => (
            <FoodCard
              key={item.id}
              item={item}
              memberName={memberName}
              onOpen={() => setSelectedId(item.id)}
              onVote={() => vote(item)}
            />
          ))}
        </div>
      )}

      <button className="food-fab" onClick={() => setAddOpen(true)} aria-label="Add a place to eat">+</button>

      {addOpen && (
        <BottomSheet title="Add a place to eat" onClose={() => setAddOpen(false)}>
          <FoodForm initial={EMPTY_FORM} onSubmit={submitAdd} submitLabel="Add spot" />
        </BottomSheet>
      )}

      {selected && !editing && (
        <FoodDetail
          item={selected}
          memberName={memberName}
          onVote={() => vote(selected)}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onMarkVisited={markVisited}
          onClose={closeDetail}
        />
      )}

      {selected && editing && (
        <BottomSheet title="Edit spot" onClose={() => setEditing(false)}>
          <FoodForm initial={editInitial()} onSubmit={submitEdit} submitLabel="Save changes" />
        </BottomSheet>
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete this spot?"
          body={`“${selected.name}” will be removed for everyone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
