// Japanese TTS voice selection — mirrors the picker in the sibling `jerno`
// project. The chosen Azure voice id is passed to t10n-client's speak/prefetch
// as `opts.voice`; the audio cache is keyed by voice, so switching just
// re-warms clips for the new voice (see @jaesin/t10n-client speaker.ts).
//
// Scope: this is a personal, per-device playback preference, so it lives in
// localStorage — not in the shared Firestore `config` (which would force one
// voice on the whole family). No security-rules / schema change needed.

import { useEffect, useState } from 'react';

// Curated set of GA Azure ja-JP neural voices. `ja-JP-NanamiNeural` is the
// worker's default (DEFAULT_VOICES.ja), so it stays first.
export const JA_VOICES = [
  { id: 'ja-JP-NanamiNeural', label: 'Nanami', blurb: 'Female · warm (default)' },
  { id: 'ja-JP-KeitaNeural', label: 'Keita', blurb: 'Male · steady' },
  { id: 'ja-JP-AoiNeural', label: 'Aoi', blurb: 'Female · bright' },
  { id: 'ja-JP-DaichiNeural', label: 'Daichi', blurb: 'Male · friendly' },
  { id: 'ja-JP-MayuNeural', label: 'Mayu', blurb: 'Female · gentle' },
  { id: 'ja-JP-NaokiNeural', label: 'Naoki', blurb: 'Male · calm' },
  { id: 'ja-JP-ShioriNeural', label: 'Shiori', blurb: 'Female · clear' },
];

export const DEFAULT_VOICE_ID = JA_VOICES[0].id;

// A neutral sample so the preview button in Settings is meaningful.
export const SAMPLE_PHRASE = 'はじめまして、よろしくお願いします。';

const STORAGE_KEY = 'japan2026.voice.ja';

function isKnown(id) {
  return JA_VOICES.some((v) => v.id === id);
}

/** Read the stored voice id, falling back to the default for unset/unknown. */
export function getStoredVoice() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return id && isKnown(id) ? id : DEFAULT_VOICE_ID;
  } catch {
    return DEFAULT_VOICE_ID;
  }
}

/**
 * `[voiceId, setVoiceId]` backed by localStorage, kept in sync across the
 * app's screens (and other tabs) via the `storage` event plus a same-tab
 * custom event — so picking a voice in Settings updates the Phrasebook live.
 */
export function useVoice() {
  const [voiceId, setVoiceId] = useState(getStoredVoice);

  useEffect(() => {
    const sync = () => setVoiceId(getStoredVoice());
    window.addEventListener('storage', sync);
    window.addEventListener('japan2026:voicechange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('japan2026:voicechange', sync);
    };
  }, []);

  const select = (id) => {
    const next = isKnown(id) ? id : DEFAULT_VOICE_ID;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore — private mode / quota; in-memory state still updates */
    }
    setVoiceId(next);
    // Notify other hook instances in this tab (storage event only fires cross-tab).
    window.dispatchEvent(new Event('japan2026:voicechange'));
  };

  return [voiceId, select];
}
