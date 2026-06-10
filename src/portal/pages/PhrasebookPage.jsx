// PhrasebookPage — phrasebook (spec 19). Live Firestore phrases/{autoId},
// category accordion (show-cards first, expanded by default), tap-row opens a
// full-screen show-card, Web Speech API ja-JP playback, FAB + BottomSheet to
// add custom phrases, inline delete per row.

import { useState, useEffect } from 'react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { Button, EmptyState, Field, Input, Select } from '../ui/ui.jsx';
import { BottomSheet } from '../ui/overlays.jsx';
import './phrasebook.css';

const CATEGORY_ORDER = ['show-card', 'etiquette', 'logistics', 'numbers', 'custom'];
const CATEGORY_LABEL = {
  'show-card': 'Show cards',
  etiquette: 'Etiquette',
  logistics: 'Logistics & tips',
  numbers: 'Numbers',
  custom: 'My phrases',
};

/* ---- text-to-speech (Web Speech API) ---------------------------------------- */
function useTTS() {
  const [speaking, setSpeaking] = useState(null); // phrase id currently speaking
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // voices load async on some browsers
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!supported) return;
    const handler = () => forceUpdate((n) => n + 1);
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
  }, [supported]);

  const speak = (id, text) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    if (speaking === id) { setSpeaking(null); return; }
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ja-JP';
    utt.rate = 0.85;
    const jaVoice = window.speechSynthesis.getVoices().find((v) => v.lang === 'ja-JP');
    if (jaVoice) utt.voice = jaVoice;
    utt.onend = () => setSpeaking(null);
    utt.onerror = () => setSpeaking(null);
    setSpeaking(id);
    window.speechSynthesis.speak(utt);
  };

  return { supported, speaking, speak };
}

function SpeakerIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={active ? 'currentColor' : 'none'} />
      {active
        ? <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        : <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
    </svg>
  );
}

/* ---- add-phrase sheet -------------------------------------------------------- */
function AddSheet({ onClose }) {
  const [japanese, setJapanese] = useState('');
  const [romaji, setRomaji] = useState('');
  const [english, setEnglish] = useState('');
  const [category, setCategory] = useState('custom');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const en = english.trim();
    if (!en || busy) return;
    setBusy(true);
    try {
      await addItem(['phrases'], {
        japanese: japanese.trim(),
        romaji: romaji.trim(),
        english: en,
        category,
        sortKey: Date.now(),
        pinned: false,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      title="Add a phrase"
      onClose={onClose}
      submit={(
        <Button block disabled={!english.trim() || busy} onClick={submit}>
          {busy ? 'Adding…' : 'Add phrase'}
        </Button>
      )}
    >
      <div className="phrase-form">
        <Field label="Japanese (optional)">
          <Input value={japanese} onChange={(e) => setJapanese(e.target.value)} placeholder="ありがとう" />
        </Field>
        <Field label="Romaji (optional)">
          <Input value={romaji} onChange={(e) => setRomaji(e.target.value)} placeholder="Arigatō" />
        </Field>
        <Field label="English">
          <Input value={english} onChange={(e) => setEnglish(e.target.value)} placeholder="Thank you" />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </Select>
        </Field>
      </div>
    </BottomSheet>
  );
}

/* ---- page -------------------------------------------------------------------- */
export default function PhrasebookPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { docs, loading, error } = useCollection(['phrases']);

  const [expanded, setExpanded] = useState(() => new Set(['show-card']));
  const [selected, setSelected] = useState(null); // phrase shown full-screen
  const [addOpen, setAddOpen] = useState(false);
  const { supported, speaking, speak } = useTTS();

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'phrases')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The phrasebook isn&rsquo;t switched on yet. Flip the toggle in Settings to open it.
          </p>
        </div>
      </div>
    );
  }

  const toggleSection = (cat) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const remove = (id) => {
    removeItem(['phrases', id]).catch(console.error);
  };

  const byCategory = (cat) => docs
    .filter((d) => (d.category || 'custom') === cat)
    .sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));

  return (
    <div className="phrasebook">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Quick reference</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 24px', fontWeight: 400 }}>PHRASEBOOK</h1>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)' }}>
          Couldn&rsquo;t load the phrasebook — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline">Loading phrases…</div>}
      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No phrases yet. Tap + to add the first one." />
      )}

      {!loading && !error && CATEGORY_ORDER.map((cat) => {
        const phrases = byCategory(cat);
        if (phrases.length === 0) return null;
        const open = expanded.has(cat);
        return (
          <div key={cat} className="phrase-section">
            <button
              className={'phrase-section__head' + (open ? ' phrase-section__head--open' : '')}
              aria-expanded={open}
              onClick={() => toggleSection(cat)}
            >
              <span className="eyebrow phrase-section__label">{CATEGORY_LABEL[cat]}</span>
              <span className="phrase-section__count">{phrases.length}</span>
              <span className="phrase-section__chev" aria-hidden="true" />
            </button>
            {open && phrases.map((phrase) => (
              <div
                key={phrase.id}
                className="phrase-row"
                role="button"
                tabIndex={0}
                onClick={() => setSelected(phrase)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(phrase); } }}
              >
                <div className="phrase-row__main">
                  {phrase.japanese && <div className="phrase-row__jp">{phrase.japanese}</div>}
                  {phrase.romaji && <div className="phrase-row__romaji">{phrase.romaji}</div>}
                  <div className="phrase-row__en">{phrase.english}</div>
                </div>
                {supported && phrase.japanese && (
                  <button
                    className={`speak-btn${speaking === phrase.id ? ' speak-btn--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); speak(phrase.id, phrase.japanese); }}
                    aria-label="Speak Japanese"
                  >
                    <SpeakerIcon active={speaking === phrase.id} />
                  </button>
                )}
                <button
                  className="phrase-row__del"
                  onClick={(e) => { e.stopPropagation(); remove(phrase.id); }}
                  aria-label={`Delete "${phrase.english}"`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        );
      })}

      <button className="phrase-fab" onClick={() => setAddOpen(true)} aria-label="Add phrase">+</button>

      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}

      {selected && (
        <div className="showcard" onClick={() => setSelected(null)}>
          <div className="showcard__inner" onClick={(e) => e.stopPropagation()}>
            <div className="showcard__jp">{selected.japanese || selected.english}</div>
            {selected.romaji && <div className="showcard__romaji">{selected.romaji}</div>}
            <div className="showcard__en">{selected.english}</div>
            <div className="showcard__actions">
              {supported && selected.japanese && (
                <button className={`speak-btn${speaking === selected.id ? ' speak-btn--active' : ''}`}
                  onClick={() => speak(selected.id, selected.japanese)} aria-label="Speak">
                  <SpeakerIcon active={speaking === selected.id} />
                </button>
              )}
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
