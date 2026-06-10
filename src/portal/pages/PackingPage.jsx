// PackingPage — packing lists (spec 15). Live Firestore packing/{autoId},
// person tabs (distinct persons + the current member, "shared" last) with
// per-person progress, items grouped by category, tap-row toggle packed,
// inline add per category, and a "Copy list to…" bottom sheet that clones a
// person's list (packed reset) onto another person.

import { useState, useMemo } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState } from '../ui/ui.jsx';
import { BottomSheet } from '../ui/overlays.jsx';
import './packing.css';

const CATEGORIES = ['clothing', 'toiletries', 'electronics', 'documents', 'kids', 'other'];
const SHARED = 'shared';

/* persons: distinct values + the current member, alphabetical, shared last */
function personList(docs, memberName) {
  const set = new Set(docs.map((d) => d.person).filter(Boolean));
  if (memberName) set.add(memberName);
  const names = [...set].filter((p) => p !== SHARED).sort((a, b) => a.localeCompare(b));
  if (set.has(SHARED) || set.size === 0) names.push(SHARED);
  return names;
}

/* ---- inline add row --------------------------------------------------------- */
function AddRow({ onAdd, category }) {
  const [value, setValue] = useState('');
  const commit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue('');
  };
  return (
    <div className="packing__add">
      <input
        value={value}
        placeholder={`Add to ${category}…`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        aria-label={`Add item to ${category}`}
      />
    </div>
  );
}

/* ---- page -------------------------------------------------------------------- */
export default function PackingPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  const { docs, loading, error } = useCollection(['packing']);

  const [selected, setSelected] = useState(null); // null = default to own tab
  const [copyOpen, setCopyOpen] = useState(false);

  const memberName = member?.name || null;
  const persons = useMemo(() => personList(docs, memberName), [docs, memberName]);

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'packing')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            Packing lists aren&rsquo;t switched on yet. Flip the toggle in Settings to open them.
          </p>
        </div>
      </div>
    );
  }

  const person = selected && persons.includes(selected)
    ? selected
    : (memberName && persons.includes(memberName) ? memberName : persons[0]);

  const mine = docs
    .filter((d) => d.person === person)
    .sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));

  const counts = (p) => {
    const items = docs.filter((d) => d.person === p);
    return { packed: items.filter((d) => d.packed).length, total: items.length };
  };

  const toggle = (item) => {
    updateItem(['packing', item.id], { packed: !item.packed }).catch(console.error);
  };

  const add = (category) => (value) => {
    addItem(['packing'], {
      person, item: value, category, qty: 1, packed: false, sortKey: Date.now(),
    }).catch(console.error);
  };

  const copyTo = (target) => {
    setCopyOpen(false);
    for (const d of mine) {
      addItem(['packing'], {
        person: target, item: d.item, category: d.category || 'other',
        qty: d.qty || 1, packed: false, sortKey: d.sortKey || Date.now(),
      }).catch(console.error);
    }
    setSelected(target);
  };

  return (
    <div className="packing">
      <div className="packing__head">
        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>Into the suitcases</div>
          <h1 className="disp packing__title">PACKING</h1>
        </div>
        {mine.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setCopyOpen(true)}>
            Copy list to…
          </Button>
        )}
      </div>

      {/* person tabs */}
      <div className="packing__tabs">
        {persons.map((p) => {
          const { packed, total } = counts(p);
          const active = p === person;
          return (
            <button
              key={p}
              className={'packing__tab' + (active ? ' packing__tab--active' : '')}
              aria-pressed={active}
              onClick={() => setSelected(p)}
            >
              <span className="packing__tab-label">
                <span className="packing__tab-name">{p === SHARED ? 'Shared' : p}</span>
                <span className="packing__tab-count">{packed}/{total}</span>
              </span>
              <span className="packing__progress">
                <span
                  className="packing__progress-fill"
                  style={{ width: total ? `${(packed / total) * 100}%` : 0 }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load packing lists — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading packing lists…</div>}

      {!loading && !error && mine.length === 0 && (
        <EmptyState line={`Nothing on ${person === SHARED ? 'the shared list' : `${person}'s list`} yet. Add the first item below.`} />
      )}

      {!loading && !error && (
        <div className="packing__groups">
          {CATEGORIES.map((cat) => {
            const items = mine.filter((d) => (d.category || 'other') === cat);
            // Show every category once the list exists, so each has an add row;
            // on a fresh empty tab show them all too — the add row IS the entry point.
            return (
              <div key={cat} className="packing__group">
                <div className="eyebrow packing__group-head">{cat}</div>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={'packing__row' + (item.packed ? ' packing__row--packed' : '')}
                    role="checkbox"
                    aria-checked={!!item.packed}
                    tabIndex={0}
                    onClick={() => toggle(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(item); } }}
                  >
                    <span className="packing__check" aria-hidden="true" />
                    <span className="packing__item">{item.item}</span>
                    {(item.qty || 1) > 1 && <span className="packing__qty">×{item.qty}</span>}
                  </div>
                ))}
                <AddRow category={cat} onAdd={add(cat)} />
              </div>
            );
          })}
        </div>
      )}

      {copyOpen && (
        <BottomSheet title={`Copy ${person === SHARED ? 'shared list' : `${person}'s list`} to…`} onClose={() => setCopyOpen(false)}>
          <div className="packing__copy-list">
            {persons.filter((p) => p !== person).map((p) => (
              <Button key={p} variant="secondary" block onClick={() => copyTo(p)}>
                {p === SHARED ? 'Shared' : p}
              </Button>
            ))}
            {persons.length <= 1 && (
              <div className="metaline">No one else to copy to yet.</div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
