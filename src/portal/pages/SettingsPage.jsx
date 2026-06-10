// SettingsPage — specs 03/04: feature-flag switches (rendered from the keys
// present in config/features), members list + revoke, device invite links.
// Always reachable for members — never behind a flag.

import { Fragment, useState } from 'react';
import { Button, EmptyState, Field, Input } from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import { FEATURES, FEATURE_GROUPS } from '../features.js';
import { useFeatures } from '../../data/useFeatures.js';
import { useCollection } from '../../data/useCollection.js';
import { removeItem, setItem, updateItem } from '../../data/mutate.js';
import { useMember } from '../../auth/useMember.js';
import './settings.css';

/* ---- helpers --------------------------------------------------------------- */

// Firestore Timestamp | Date | millis → "Jun 10, 2026" ("—" while the server
// timestamp is still pending in the local cache).
function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// 28-char [A-Za-z0-9] capability token via crypto.getRandomValues.
// Rejection-sampled (bytes ≥ 248 discarded) so all 62 chars are equally likely.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function mintToken() {
  const out = [];
  while (out.length < 28) {
    const buf = new Uint8Array(40);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (out.length < 28 && b < 248) out.push(ALPHABET[b % 62]);
    }
  }
  return out.join('');
}

// Join URL derived from the current location — works on localhost and prod.
const joinUrl = (token) => `${location.origin}${location.pathname}#/join?key=${token}`;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---- local atoms ------------------------------------------------------------ */

// Accessible switch — no switch exists in the kit (see settings.css).
function Switch({ on, onToggle, label, disabled }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={!!on}
      aria-label={label} disabled={disabled} onClick={onToggle}>
      <span className="switch__track"><span className="switch__thumb" /></span>
    </button>
  );
}

function LockGlyph() {
  return (
    <span className="lock" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10" width="14" height="10" rx="1.5" />
        <path d="M8 10 V7 a4 4 0 0 1 8 0 v3" />
      </svg>
    </span>
  );
}

function SectionHead({ label, action }) {
  return (
    <div className="settings__head">
      <span className="eyebrow">{label}</span>
      {action}
    </div>
  );
}

/* ---- Features section -------------------------------------------------------- */

function FeaturesSection({ onToast }) {
  const { features, loading } = useFeatures();
  const registry = new Map(FEATURES.map((f) => [f.id, f]));
  const keys = Object.keys(features);

  // Spec 03: toggles grouped like the specs index (Planning / During the trip /
  // Other). Unknown keys — and registry entries with no recognized group — land
  // in "Other". Within a group: registry order first, then unknowns A→Z.
  const groupOf = (key) => {
    const g = registry.get(key)?.group;
    return FEATURE_GROUPS.some((fg) => fg.id === g) ? g : 'other';
  };
  const byKey = (a, b) => {
    const ia = FEATURES.findIndex((f) => f.id === a);
    const ib = FEATURES.findIndex((f) => f.id === b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return a.localeCompare(b);
  };
  const groups = FEATURE_GROUPS
    .map((g) => ({ ...g, keys: keys.filter((k) => groupOf(k) === g.id).sort(byKey) }))
    .filter((g) => g.keys.length > 0);

  const toggle = async (key) => {
    try {
      // Single-field update so concurrent toggles don't stomp each other (spec 03).
      await updateItem(['config', 'features'], { [key]: !(features[key] === true) });
    } catch {
      onToast("Couldn't save — check your connection");
    }
  };

  return (
    <section className="settings__section">
      <SectionHead label="Features" />
      <div className="settings__list">
        <div className="row row--static row--locked">
          <LockGlyph />
          <span className="row__main">
            <div className="row__title">Settings</div>
            <div className="row__meta">Always on — the control room can't switch itself off.</div>
          </span>
          <span className="row__on">Always on</span>
        </div>
        {groups.map((group) => (
          <Fragment key={group.id}>
            <div className="settings__group">{group.label}</div>
            {group.keys.map((key) => {
              const meta = registry.get(key);
              const on = features[key] === true;
              return (
                <div className="row row--static" key={key}>
                  <span className="row__main">
                    <div className="row__title">{meta ? meta.label : key}</div>
                    <div className="row__meta">{meta ? meta.blurb : 'Not in this build yet — flag only.'}</div>
                  </span>
                  <Switch on={on} label={`${meta ? meta.label : key} — ${on ? 'on' : 'off'}`}
                    onToggle={() => toggle(key)} />
                </div>
              );
            })}
          </Fragment>
        ))}
        {!loading && keys.length === 0 && (
          <EmptyState line="No switches yet — features appear here as they're developed, off until flipped on." />
        )}
      </div>
    </section>
  );
}

/* ---- Users section (spec 04) -------------------------------------------------- */

function MembersSection({ invites, onToast }) {
  const { uid } = useMember();
  const { docs: members, loading } = useCollection(['members']);
  const [revoking, setRevoking] = useState(null); // member doc pending confirm

  const inviteById = new Map(invites.map((i) => [i.id, i]));
  const sorted = [...members].sort(
    (a, b) => (a.joinedAt?.toMillis?.() ?? Infinity) - (b.joinedAt?.toMillis?.() ?? Infinity),
  );

  const revoke = async (m) => {
    setRevoking(null);
    try {
      await removeItem(['members', m.id]);
      onToast(`${m.name} revoked`);
    } catch {
      onToast("Couldn't revoke — check your connection");
    }
  };

  return (
    <section className="settings__section">
      <SectionHead label="Members" />
      <div className="settings__list">
        {sorted.map((m) => {
          const invite = inviteById.get(m.inviteToken);
          const self = m.id === uid;
          return (
            <div className="row row--static" key={m.id}>
              <span className="row__main">
                <div className="row__title">{m.name}{self ? ' · this device' : ''}</div>
                <div className="row__meta">
                  Joined {fmtDate(m.joinedAt)} · via {invite ? invite.label : 'revoked link'}
                </div>
              </span>
              <Button size="sm" variant="destructive" onClick={() => setRevoking(m)}>Revoke</Button>
            </div>
          );
        })}
        {!loading && members.length === 0 && (
          <EmptyState line="No members yet — share a device link below to let the family in." />
        )}
      </div>
      {revoking && (
        <ConfirmDialog
          title={`Revoke ${revoking.name}?`}
          body={revoking.id === uid
            ? `Careful — this is THIS device. ${revoking.name} (you) will lose portal access here immediately.`
            : `${revoking.name} will lose access on that device immediately.`}
          confirmLabel="Revoke"
          onConfirm={() => revoke(revoking)}
          onCancel={() => setRevoking(null)}
        />
      )}
    </section>
  );
}

function InvitesSection({ invites, loading, onToast }) {
  const [revoking, setRevoking] = useState(null); // invite doc pending confirm
  const [sheet, setSheet] = useState(null); // null | {phase:'form'} | {phase:'done', token, label}
  const [label, setLabel] = useState('');
  const [labelErr, setLabelErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const sorted = [...invites].sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? Infinity) - (a.createdAt?.toMillis?.() ?? Infinity),
  );

  const copyLink = async (token) => {
    onToast((await copyText(joinUrl(token))) ? 'Link copied' : "Couldn't copy — copy it manually");
  };

  const revoke = async (inv) => {
    setRevoking(null);
    try {
      await removeItem(['invites', inv.id]);
      onToast(`Link "${inv.label}" revoked`);
    } catch {
      onToast("Couldn't revoke — check your connection");
    }
  };

  const create = async () => {
    const trimmed = label.trim();
    if (!trimmed) { setLabelErr('A label is required — whose device is this for?'); return; }
    setSaving(true);
    try {
      const token = mintToken();
      await setItem(['invites', token], { label: trimmed });
      setSheet({ phase: 'done', token, label: trimmed });
      setLabel('');
      setLabelErr(null);
    } catch {
      setLabelErr("Couldn't create the link — check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const closeSheet = () => { setSheet(null); setLabel(''); setLabelErr(null); };

  return (
    <section className="settings__section">
      <SectionHead label="Device links"
        action={<Button size="sm" variant="primary" onClick={() => setSheet({ phase: 'form' })}>New device link</Button>} />
      <div className="settings__list">
        {sorted.map((inv) => (
          <div className="row row--static" key={inv.id}>
            <span className="row__main">
              <div className="row__title">{inv.label}</div>
              <div className="row__meta">Created {fmtDate(inv.createdAt)}</div>
            </span>
            <span className="row__acc">
              <Button size="sm" variant="secondary" onClick={() => copyLink(inv.id)}>Copy link</Button>
              <Button size="sm" variant="destructive" onClick={() => setRevoking(inv)}>Revoke</Button>
            </span>
          </div>
        ))}
        {!loading && invites.length === 0 && (
          <EmptyState line="No device links yet — mint one per phone and hand it over." />
        )}
      </div>

      {revoking && (
        <ConfirmDialog
          title={`Revoke link "${revoking.label}"?`}
          body="New joins via this link stop immediately; devices that already joined keep access (revoke them under Members)."
          confirmLabel="Revoke"
          onConfirm={() => revoke(revoking)}
          onCancel={() => setRevoking(null)}
        />
      )}

      {sheet?.phase === 'form' && (
        <BottomSheet title="New device link" onClose={closeSheet}
          submit={<Button variant="primary" block disabled={saving} onClick={create}>
            {saving ? 'Creating…' : 'Create link'}</Button>}>
          <Field label="Label" error={labelErr}
            hint={`Whose device this link is for — e.g. "Mai's phone".`}>
            <Input value={label} autoFocus placeholder="Mai's phone"
              onChange={(e) => { setLabel(e.target.value); setLabelErr(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          </Field>
        </BottomSheet>
      )}

      {sheet?.phase === 'done' && (
        <BottomSheet title="Link ready" onClose={closeSheet}
          submit={<Button variant="secondary" block onClick={closeSheet}>Done</Button>}>
          <div className="linkdone">
            Send this to <b>{sheet.label}</b> — opening it joins that device to the portal.
          </div>
          <span className="linkbox">{joinUrl(sheet.token)}</span>
          <Button variant="primary" block onClick={() => copyLink(sheet.token)}>Copy link</Button>
        </BottomSheet>
      )}
    </section>
  );
}

/* ---- Page -------------------------------------------------------------------- */

export default function SettingsPage() {
  const [toast, setToast] = useState(null);
  const { docs: invites, loading: invitesLoading } = useCollection(['invites']);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast.t);
    showToast.t = window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="settings">
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Control room</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 0', fontWeight: 400 }}>SETTINGS</h1>

      <FeaturesSection onToast={showToast} />
      <MembersSection invites={invites} onToast={showToast} />
      <InvitesSection invites={invites} loading={invitesLoading} onToast={showToast} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
