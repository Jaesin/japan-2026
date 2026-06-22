// PhrasebookPage — phrasebook (spec 19). Live Firestore phrases/{autoId},
// category accordion (show-cards first, expanded by default), tap-row opens a
// full-screen show-card, Web Speech API ja-JP playback, FAB + BottomSheet to
// add custom phrases, inline delete per row.

import { useState, useRef, useEffect } from 'react';
import { useSpeaker } from '@jaesin/t10n-client/react';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useVoice } from '../voice.js';
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

/* ---- text-to-speech (t10n-client: cloud TTS with web-speech fallback) -------- */
function useTTS(voice) {
  const { speak: speakerSpeak, cancel, speaking: anySpeaking, capabilities, engineFor, prefetch } = useSpeaker();
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);

  const supported = capabilities.cloud || capabilities.device;

  const speak = (id, text) => {
    if (activeIdRef.current === id) {
      cancel();
      setActiveId(null);
      activeIdRef.current = null;
      return;
    }
    activeIdRef.current = id;
    setActiveId(id);
    speakerSpeak(text, {
      lang: 'ja',
      voice,
      onDone: () => {
        if (activeIdRef.current === id) {
          setActiveId(null);
          activeIdRef.current = null;
        }
      },
    });
  };

  const stop = () => {
    if (activeIdRef.current === null) return;
    cancel();
    setActiveId(null);
    activeIdRef.current = null;
  };

  // Clear if the speaker stops externally (e.g. browser navigates away).
  useEffect(() => {
    if (!anySpeaking && activeIdRef.current !== null) {
      setActiveId(null);
      activeIdRef.current = null;
    }
  }, [anySpeaking]);

  return { supported, speaking: activeId, speak, stop, engineFor, prefetch, capabilities };
}

/* Warm the cloud TTS clip for a phrase once its row scrolls into view, so a
   later tap plays cloud audio (and the engine ring flips dashed → solid).
   Returns a ref-callback to attach to each row element. */
function useVisiblePrefetch(prefetch, enabled, voice) {
  const observerRef = useRef(null);
  const targetsRef = useRef(new Map()); // el → japanese text

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const items = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const text = targetsRef.current.get(entry.target);
          if (text) items.push({ text, lang: 'ja', voice });
          obs.unobserve(entry.target);
          targetsRef.current.delete(entry.target);
        }
        if (items.length) void prefetch(items); // warm() skips already-cached clips
      },
      { rootMargin: '200px' }, // start a little before the row is on-screen
    );
    observerRef.current = obs;
    for (const el of targetsRef.current.keys()) obs.observe(el);
    return () => { obs.disconnect(); observerRef.current = null; };
    // Re-arm on voice change so rows scrolled past warm the newly-selected voice.
  }, [prefetch, enabled, voice]);

  return (text) => (el) => {
    if (!el || !text) return;
    targetsRef.current.set(el, text);
    observerRef.current?.observe(el);
  };
}

function SpeakerIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* The glyph is left-weighted in its viewBox (cone left, waves right), so
         nudge it right to optically center it inside the EngineRing. */}
      <g transform="translate(2.5 0)">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={active ? 'currentColor' : 'none'} />
        {active
          ? <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          : <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
      </g>
    </svg>
  );
}

/* Animated waveform shown while a clip is playing. */
function Waveform() {
  return (
    <span className="waveform" aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  );
}

/* Ring around the speaker icon, drawn as SVG so the dash length is exact.
   Solid → cloud clip ready; dashed → device (web-speech) fallback. */
function EngineRing({ engine }) {
  if (engine !== 'cloud' && engine !== 'device') return null;
  return (
    <svg className="speak-btn__ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="none"
        stroke="currentColor" strokeWidth="1.5"
        strokeDasharray={engine === 'device' ? '6 4' : undefined} />
    </svg>
  );
}

/* Speaker button. The ring reports which engine a tap will use *now*:
   - solid circle  → cloud TTS clip is ready (cached)
   - dashed circle → will fall back to device (web-speech)
   While playing, the icon swaps to an animated waveform. */
function SpeakButton({ id, text, speaking, speak, engineFor, voice }) {
  const engine = engineFor(text, { lang: 'ja', voice }); // 'cloud' | 'device' | null
  const isPlaying = speaking === id;
  return (
    <button
      className="speak-btn"
      onClick={(e) => { e.stopPropagation(); speak(id, text); }}
      aria-label={isPlaying ? 'Stop' : 'Speak Japanese'}
    >
      <EngineRing engine={engine} />
      {isPlaying ? <Waveform /> : <SpeakerIcon active={false} />}
    </button>
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
  const [voice] = useVoice();
  const { supported, speaking, speak, stop, engineFor, prefetch, capabilities } = useTTS(voice);
  const rowRef = useVisiblePrefetch(prefetch, supported && capabilities.cloud, voice);

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

  // Closing the show-card should also stop any in-progress playback.
  const closeShowcard = () => {
    stop();
    setSelected(null);
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
                ref={rowRef(phrase.japanese)}
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
                  <SpeakButton id={phrase.id} text={phrase.japanese} speaking={speaking} speak={speak} engineFor={engineFor} voice={voice} />
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
        <div className="showcard" onClick={closeShowcard}>
          <div className="showcard__inner" onClick={(e) => e.stopPropagation()}>
            <div className="showcard__jp">{selected.japanese || selected.english}</div>
            {selected.romaji && <div className="showcard__romaji">{selected.romaji}</div>}
            <div className="showcard__en">{selected.english}</div>
            <div className="showcard__actions">
              {supported && selected.japanese && (
                <SpeakButton id={selected.id} text={selected.japanese} speaking={speaking} speak={speak} engineFor={engineFor} voice={voice} />
              )}
              <Button variant="secondary" onClick={closeShowcard}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
