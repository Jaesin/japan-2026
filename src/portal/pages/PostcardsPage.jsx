// PostcardsPage — photo dispatches (spec 22). The visual sibling of CheckinsPage:
// a member picks a photo, it's resized + compressed in the browser to a small
// JPEG data-URL (Option A — no Firebase Storage), optionally tagged with a place,
// and posted. The write lands in the public-read `postcards` collection, which
// the public poster subscribes to and renders as a retro photo-card strip.
//
// Privacy: re-encoding the photo through a <canvas> strips all EXIF metadata,
// including GPS — surfaced in the UI as a feature. Accommodations etc. are never
// involved; the confirm button says "Post to the public page" so nobody is
// surprised it's public.

import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { useMember } from '../../auth/useMember.js';
import { Button, EmptyState, Field, Input } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import { relativeTime } from '../../tripData.js';
import { fileToPostcardJpeg } from './postcardImage.js';
import './postcards.css';

const CAPTION_MAX = 100;
// Hard ceiling on the stored data-URL string (firestore.rules mirrors this).
const MAX_IMG_BYTES = 700000;

function approxKB(dataUrl) {
  // data-URL length ≈ byte count for the base64 body; close enough for display.
  return Math.round((dataUrl?.length || 0) / 1024);
}

/* ---- post flow (bottom sheet) --------------------------------------------- */
function PostcardFlow({ memberName, onClose, onPost }) {
  const [img, setImg] = useState(null);       // resized JPEG data-URL
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [jp, setJp] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const dataUrl = await fileToPostcardJpeg(file, { maxEdge: 1280, maxBytes: MAX_IMG_BYTES });
      setImg(dataUrl);
    } catch (ex) {
      setImg(null);
      setErr(
        ex && ex.code === 'too-large'
          ? "That photo is too large even after shrinking — try a smaller crop."
          : "Couldn't read that image — please pick another.",
      );
    } finally {
      setBusy(false);
    }
  };

  const canPost = !!img && !busy;

  const post = () => {
    if (!img) return;
    if (img.length >= MAX_IMG_BYTES) {
      setErr("That photo is too large even after shrinking — try a smaller crop.");
      return;
    }
    const payload = { img, at: serverTimestamp() };
    const cap = caption.trim();
    if (cap) payload.caption = cap;
    const pl = place.trim();
    if (pl) payload.place = pl;
    const j = jp.trim();
    if (j) payload.jp = j;
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) payload.ll = [la, ln];
    if (memberName) payload.by = memberName;

    addItem(['postcards'], payload, {
      activity: { verb: 'added', title: `Postcard · ${cap || pl || 'photo'}`, link: '/portal/postcards' },
    }).catch(console.error);
    onPost();
  };

  return (
    <BottomSheet title="New postcard" onClose={onClose}>
      <div className="postcard-flow">
        {/* 1 · pick a photo */}
        <div className="postcard-flow__group">
          <label className="postcard-flow__pick">
            {img ? 'Choose a different photo' : '📷 Choose a photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              style={{ display: 'none' }}
            />
          </label>
          {busy && <div className="postcard-flow__busy metaline">Shrinking your photo…</div>}
          {err && <div className="postcard-flow__err">{err}</div>}
        </div>

        {/* 2 · preview */}
        {img && (
          <div className="postcard-flow__group postcard-flow__preview">
            <div className="postcard-flow__previewlabel">This is what the poster will show</div>
            <img className="postcard-flow__previewimg" src={img} alt="Postcard preview" />
            <div className="postcard-flow__size">~{approxKB(img)} KB · resized for the web</div>
          </div>
        )}

        {/* 3 · caption + optional place */}
        <div className="postcard-flow__group">
          <Field label="Caption (optional)" hint="One line for the poster.">
            <Input
              value={caption}
              maxLength={CAPTION_MAX}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              placeholder="Golden hour over the torii."
            />
          </Field>
          <Field label="Place (optional)">
            <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Fushimi Inari" />
          </Field>
          <Field label="Japanese label (optional)">
            <Input value={jp} onChange={(e) => setJp(e.target.value)} placeholder="伏見稲荷" />
          </Field>
          <div className="postcard-flow__pair">
            <Field label="Lat (optional)">
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="34.9671" />
            </Field>
            <Field label="Lng (optional)">
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="135.7727" />
            </Field>
          </div>
          <p className="postcard-flow__privacy metaline">Location data is stripped from the photo.</p>
        </div>

        {/* 4 · confirm */}
        <Button variant="primary" block disabled={!canPost} onClick={post}>
          Post to the public page
        </Button>
        <p className="postcard-flow__notice metaline">
          Postcards appear on the public trip page for everyone.
        </p>
      </div>
    </BottomSheet>
  );
}

/* ---- enlarge view (bottom sheet) ------------------------------------------ */
function PostcardView({ item, onClose, onDelete }) {
  const when = relativeTime(item.at);
  const dlName = `postcard-${(item.caption || item.place || 'photo')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'photo'}.jpg`;
  return (
    <BottomSheet title="Postcard" onClose={onClose}>
      <div className="postcard-view">
        <img className="postcard-view__img" src={item.img} alt={item.caption || item.place || 'Postcard'} />
        {item.caption && <div className="postcard-view__caption">{item.caption}</div>}
        {(item.place || item.jp || when) && (
          <div className="postcard-view__meta">
            {item.place && <span>{item.place}</span>}
            {item.jp && <span className="postcard-view__jp">{item.jp}</span>}
            {when && <span style={{ marginLeft: 'auto' }}>{when}</span>}
          </div>
        )}
        <div className="postcard-view__actions">
          <a className="btn btn--secondary postcard-view__download" href={item.img} download={dlName}>
            Download
          </a>
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ---- page ----------------------------------------------------------------- */
export default function PostcardsPage() {
  const { features, loading: featuresLoading } = useFeatures();
  const { member } = useMember();
  const memberName = member?.name || '';
  const { docs, loading, error } = useCollection(['postcards'], {
    orderBy: [['at', 'desc']],
    limit: 60,
  });

  const [flowOpen, setFlowOpen] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'postcards')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            Postcards aren&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const viewing = docs.find((d) => d.id === viewId) || null;
  const confirming = docs.find((d) => d.id === confirmId) || null;
  const doDelete = () => {
    const id = confirmId;
    setConfirmId(null);
    setViewId(null);
    removeItem(['postcards', id]).catch(console.error);
  };

  return (
    <div className="postcards">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Photo dispatches</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 16px', fontWeight: 400 }}>POSTCARDS</h1>

      <Button variant="primary" block onClick={() => setFlowOpen(true)}>New postcard</Button>

      {error && (
        <div className="metaline" style={{ color: 'var(--danger)', marginTop: 16 }}>
          Couldn&rsquo;t load postcards — check your connection and try again.
        </div>
      )}
      {loading && !error && <div className="metaline" style={{ marginTop: 16 }}>Loading postcards…</div>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState line="No postcards yet. Tap New postcard to post your first photo." />
      )}

      {!loading && !error && docs.length > 0 && (
        <div className="postcard-grid">
          {docs.map((item) => (
            <button
              key={item.id}
              type="button"
              className="postcard-thumb"
              onClick={() => setViewId(item.id)}
              aria-label={`Open postcard${item.caption ? `: ${item.caption}` : ''}`}
            >
              <img src={item.img} alt={item.caption || item.place || 'Postcard'} loading="lazy" />
              {(item.caption || item.place) && (
                <span className="postcard-thumb__cap">{item.caption || item.place}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {flowOpen && (
        <PostcardFlow
          memberName={memberName}
          onClose={() => setFlowOpen(false)}
          onPost={() => setFlowOpen(false)}
        />
      )}

      {viewing && (
        <PostcardView
          item={viewing}
          onClose={() => setViewId(null)}
          onDelete={() => setConfirmId(viewing.id)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Delete this postcard?"
          body={`This photo will be removed from the public page.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
