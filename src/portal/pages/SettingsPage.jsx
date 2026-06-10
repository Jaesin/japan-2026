// SettingsPage — specs 03/04: feature-flag switches (rendered from the keys
// present in config/features) and the Members section — people grouped by
// name, each expanding to its registered devices (revoke / add device), plus
// an "Invite someone" CTA. Always reachable for members — never behind a flag.

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
// Device invites carry the person's name as a display hint (spec 04: the
// stored name still comes from the invite doc, not the URL).
const joinUrl = (token, name) =>
  `${location.origin}${location.pathname}#/join?key=${token}`
  + (name ? `&name=${encodeURIComponent(name)}` : '');

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

/* ---- Users section (spec 04, revised) ------------------------------------------ */

// Shared invite-minting sheet. kind 'device' → { label, memberName } and the
// URL carries &name=; kind 'invite' → { label } only (recipient sets their
// own name during join). The label is optional in both.
function InviteSheet({ kind, memberName, onClose, onToast }) {
  const device = kind === 'device';
  const [label, setLabel] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // { token, label }

  const create = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const trimmed = label.trim() || (device ? 'New device' : 'Invite link');
      const token = mintToken();
      await setItem(['invites', token],
        device ? { label: trimmed, memberName } : { label: trimmed });
      setDone({ token, label: trimmed });
    } catch {
      setErr("Couldn't create the link — check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const url = joinUrl(done.token, device ? memberName : null);
    const copy = async () => {
      onToast((await copyText(url)) ? 'Link copied' : "Couldn't copy — copy it manually");
    };
    return (
      <BottomSheet title="Link ready" onClose={onClose}
        submit={<Button variant="secondary" block onClick={onClose}>Done</Button>}>
        <div className="linkdone">
          {device
            ? <>Open this on your other device — it joins as <b>{memberName}</b>, no questions asked.</>
            : <>Send this to <b>{done.label}</b> — they pick their own name when they open it.</>}
        </div>
        <span className="linkbox">{url}</span>
        <Button variant="primary" block onClick={copy}>Copy link</Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={device ? 'Add a device' : 'Invite someone'} onClose={onClose}
      submit={<Button variant="primary" block disabled={saving} onClick={create}>
        {saving ? 'Creating…' : 'Create link'}</Button>}>
      <Field label="Label (optional)" error={err}
        hint={device
          ? 'Which device is this — e.g. "iPad" or "MacBook".'
          : `Who's this for — e.g. "Mai's phone".`}>
        <Input value={label} autoFocus placeholder={device ? 'New device' : "Mai's phone"}
          onChange={(e) => { setLabel(e.target.value); setErr(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
      </Field>
    </BottomSheet>
  );
}

function Chevron({ open }) {
  return (
    <span className={`person__chev${open ? ' person__chev--open' : ''}`} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </span>
  );
}

function MembersSection({ invites, onToast }) {
  const { uid, member } = useMember();
  const { docs: members, loading } = useCollection(['members']);
  const [open, setOpen] = useState(() => new Set()); // expanded person names
  const [revoking, setRevoking] = useState(null); // member (device) doc pending confirm
  const [sheet, setSheet] = useState(null); // null | { kind: 'device' | 'invite' }

  const inviteById = new Map(invites.map((i) => [i.id, i]));
  const currentName = member?.name;

  // Person identity = members grouped by name (spec 04); people and their
  // devices both ordered by earliest join.
  const people = [];
  const byName = new Map();
  const sorted = [...members].sort(
    (a, b) => (a.joinedAt?.toMillis?.() ?? Infinity) - (b.joinedAt?.toMillis?.() ?? Infinity),
  );
  for (const m of sorted) {
    let person = byName.get(m.name);
    if (!person) {
      person = { name: m.name, devices: [] };
      byName.set(m.name, person);
      people.push(person);
    }
    person.devices.push(m);
  }

  const toggle = (name) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const revoke = async (m) => {
    setRevoking(null);
    try {
      await removeItem(['members', m.id]);
      onToast('Device revoked');
    } catch {
      onToast("Couldn't revoke — check your connection");
    }
  };

  const deviceLabel = (m) => inviteById.get(m.inviteToken)?.label || 'revoked link';

  return (
    <section className="settings__section">
      <SectionHead label="Members" />
      <div className="settings__list">
        {people.map((person) => {
          const expanded = open.has(person.name);
          const mine = person.name === currentName;
          const n = person.devices.length;
          return (
            <Fragment key={person.name}>
              <button type="button" className="row person" aria-expanded={expanded}
                onClick={() => toggle(person.name)}>
                <Chevron open={expanded} />
                <span className="row__main">
                  <span className="row__title">{person.name}{mine ? ' · you' : ''}</span>
                </span>
                <span className="person__count">{n} device{n === 1 ? '' : 's'}</span>
              </button>
              {expanded && (
                <div className="devicelist">
                  {person.devices.map((m) => (
                    <div className="row row--static device" key={m.id}>
                      <span className="row__main">
                        <span className="row__title">
                          {deviceLabel(m)}{m.id === uid ? ' · this device' : ''}
                        </span>
                        <span className="row__meta">Joined {fmtDate(m.joinedAt)}</span>
                      </span>
                      <Button size="sm" variant="destructive" onClick={() => setRevoking(m)}>Revoke</Button>
                    </div>
                  ))}
                  {mine && (
                    <button type="button" className="row adddevice"
                      onClick={() => setSheet({ kind: 'device' })}>
                      <span className="row__main">
                        <span className="row__title adddevice__label">+ Add device</span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
        {!loading && people.length === 0 && (
          <EmptyState line="No members yet — invite someone below to let the family in." />
        )}
      </div>

      <div className="settings__invitecta">
        <Button variant="primary" block onClick={() => setSheet({ kind: 'invite' })}>
          Invite someone
        </Button>
      </div>

      {revoking && (
        <ConfirmDialog
          title={`Revoke ${revoking.name}'s ${deviceLabel(revoking)}?`}
          body={revoking.id === uid
            ? `Careful — this is THE DEVICE YOU'RE USING RIGHT NOW. Revoke it and you (${revoking.name}) lose portal access here immediately; you'll need a fresh invite to get back in.`
            : `${revoking.name}'s ${deviceLabel(revoking)} will lose access immediately.`}
          confirmLabel="Revoke"
          onConfirm={() => revoke(revoking)}
          onCancel={() => setRevoking(null)}
        />
      )}

      {sheet && (
        <InviteSheet kind={sheet.kind} memberName={currentName}
          onClose={() => setSheet(null)} onToast={onToast} />
      )}
    </section>
  );
}

/* ---- Page -------------------------------------------------------------------- */

export default function SettingsPage() {
  const [toast, setToast] = useState(null);
  const { docs: invites } = useCollection(['invites']);

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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
