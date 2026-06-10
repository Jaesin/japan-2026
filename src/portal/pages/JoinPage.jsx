// JoinPage — /#/join?key=<token>[&name=<hint>] invite flow (specs 01/04),
// adapted from artifacts/portal_handoff/screens/JoinFlow/JoinFlow.jsx.
// Per spec 04 (revised): after silent anonymous sign-in we READ the invite doc
// (invites are publicly readable — the token is the capability).
//  - Device invite (memberName present): skip the name form entirely and
//    register with the invite's memberName (the ?name= param is display-only —
//    the stored value comes from the doc, preventing URL tampering).
//  - User invite (no memberName): show the required free-text name form
//    (1–40 chars); ?name= merely pre-fills it as a hint.
// A missing invite doc — or a denied members/{uid} write — → "link isn't active".

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { getTodayInfo } from '../../tripData.js';
import { db, ensureSignedIn, TRIP_ID } from '../../firebase.js';
import { useMember } from '../../auth/useMember.js';
import { Button, Field, Input } from '../ui/ui.jsx';
import { Fuji, SunBurst } from '../ui/primitives.jsx';
import '../styles/tokens.css';
import '../styles/components.css';

function usePrefersDark() {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/* Poster-style hero band — both directions, straight from the handoff. */
function Hero({ dark }) {
  return dark ? (
    <div style={{ position: 'relative', height: 220, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 86, background: 'var(--indigo)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 54, background: 'var(--pink)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, background: 'var(--orange)' }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 26, transform: 'translateX(-50%)', width: 104, height: 104, borderRadius: '50%', background: 'var(--accent)' }} />
      <Fuji width={320} color="#15203a" snow="#2c3f66" style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)' }} />
    </div>
  ) : (
    <div style={{ position: 'relative', height: 200, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: -150, right: -160 }}>
        <SunBurst size={420} disc={150} rays={24} color="var(--accent)" />
      </div>
    </div>
  );
}

function countdownLine() {
  const info = getTodayInfo();
  if (info.phase === 'before') {
    return `${info.daysToGo} day${info.daysToGo === 1 ? '' : 's'} until departure. We'll see you at the gate.`;
  }
  if (info.phase === 'during') {
    return `The trip is live — Day ${info.dayNum}, ${info.stop.city}. Jump in.`;
  }
  return 'The wheels have touched back down — come see how it went.';
}

export default function JoinPage() {
  const dark = usePrefersDark();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteKey = params.get('key') || '';
  const nameHint = params.get('name') || '';
  const { status, member, join, loading } = useMember();

  const [step, setStep] = useState('welcome'); // welcome | name
  const [name, setName] = useState(nameHint); // ?name= pre-fills as a hint only
  const [fieldError, setFieldError] = useState(null);
  const [linkDead, setLinkDead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState(undefined); // undefined = not read yet
  const [autoErr, setAutoErr] = useState(null); // device-invite auto-join failure
  const [retryTick, setRetryTick] = useState(0); // bump to re-run the auto-join
  const autoJoined = useRef(false); // device invite: register once per attempt

  // Spec 04 step 1+2: silent anonymous sign-in, then read the invite doc to
  // learn whether this is a device invite (memberName present).
  useEffect(() => {
    if (!inviteKey) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await ensureSignedIn();
        const snap = await getDoc(doc(db, 'trips', TRIP_ID, 'invites', inviteKey));
        if (cancelled) return;
        if (!snap.exists()) setLinkDead(true);
        else setInvite(snap.data());
      } catch {
        if (!cancelled) setLinkDead(true); // unreadable invite ≈ dead link
      }
    })();
    return () => { cancelled = true; };
  }, [inviteKey]);

  // Device invite: skip the name form, register immediately with the
  // invite's memberName.
  const inviteMemberName = invite?.memberName;
  useEffect(() => {
    if (!inviteMemberName || autoJoined.current) return;
    if (loading || status === 'member') return;
    autoJoined.current = true;
    join(inviteKey, inviteMemberName).catch((err) => {
      if (err?.code === 'permission-denied') setLinkDead(true);
      else setAutoErr(err?.message || 'Something went wrong — try again.');
    });
  }, [inviteMemberName, loading, status, inviteKey, join, retryTick]);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      setFieldError('A name, 1–40 characters — whatever the family calls you.');
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await join(inviteKey, trimmed); // status flips to 'member' → done screen
    } catch (err) {
      if (err?.code === 'permission-denied') setLinkDead(true);
      else setFieldError(err?.message || 'Something went wrong — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  let body;
  if (loading && status !== 'member') {
    body = <div className="metaline" style={{ marginTop: 24, textAlign: 'center' }}>Checking your boarding pass…</div>;
  } else if (status === 'member') {
    // Success — also what an already-joined device sees when re-tapping its link.
    const displayName = member?.name || name.trim() || 'traveler';
    body = (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'center', alignItems: 'center' }}>
        <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>⛩</span>
        <div className="disp" style={{ fontSize: 40, lineHeight: 0.9, marginTop: 16 }}>You're in,<br />{displayName}.</div>
        <p style={{ fontFamily: 'var(--font-jp)', fontSize: 15, lineHeight: 1.5, opacity: 0.85, marginTop: 12, maxWidth: 300 }}>
          {countdownLine()}
        </p>
        <div style={{ width: '100%', marginTop: 24, padding: '14px', background: 'var(--surface)', border: '1px dashed var(--line-strong)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left' }}>
          <span style={{ fontSize: 22 }}>📲</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Add to Home Screen</div>
            <div className="metaline" style={{ marginTop: 2 }}>Tap Share → "Add to Home Screen" so the trip's one tap away.</div>
          </div>
        </div>
        <div style={{ marginTop: 'auto', width: '100%', paddingTop: 24 }}>
          <Button variant="primary" block onClick={() => navigate('/portal')}>Enter the portal</Button>
        </div>
      </div>
    );
  } else if (!inviteKey || linkDead) {
    // No key in the URL, or the write was denied: invalid/revoked link.
    body = (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="disp" style={{ fontSize: 36, lineHeight: 0.9 }}>This link isn't active</div>
        <p style={{ fontFamily: 'var(--font-jp)', fontSize: 15, lineHeight: 1.55, opacity: 0.85, marginTop: 14, maxWidth: 320 }}>
          Family links are personal and can be retired. This one isn't boarding
          anyone right now — ask Jaesin for a fresh one and you'll be aboard in
          ten seconds.
        </p>
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <Button variant="secondary" block onClick={() => navigate('/')}>Back to the poster</Button>
        </div>
      </div>
    );
  } else if (invite === undefined) {
    // Signed in; still reading the invite doc (spec 04 step 2).
    body = <div className="metaline" style={{ marginTop: 24, textAlign: 'center' }}>Checking your boarding pass…</div>;
  } else if (invite.memberName) {
    // Device invite — registration runs automatically, no name form.
    body = (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="disp" style={{ fontSize: 36, lineHeight: 0.9 }}>Welcome back,<br />{invite.memberName}.</div>
        <p style={{ fontFamily: 'var(--font-jp)', fontSize: 15, lineHeight: 1.55, opacity: 0.85, marginTop: 14, maxWidth: 320 }}>
          {autoErr || 'Adding this device to your account…'}
        </p>
        {autoErr && (
          <div style={{ marginTop: 'auto', paddingTop: 24 }}>
            <Button variant="primary" block onClick={() => {
              setAutoErr(null);
              autoJoined.current = false;
              setRetryTick((t) => t + 1); // re-run the auto-join effect
            }}>Try again</Button>
          </div>
        )}
      </div>
    );
  } else if (step === 'welcome') {
    body = (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>You're invited</div>
        <div className="disp" style={{ fontSize: 52, lineHeight: 0.86, marginTop: 8 }}>
          JAPAN<br />2026
        </div>
        <p style={{ fontFamily: 'var(--font-jp)', fontSize: 16, lineHeight: 1.55, opacity: 0.85, marginTop: 14, maxWidth: 320 }}>
          The Mulenex family is crossing the Land of the Rising Sun — Tokyo to
          Osaka, eight days this July. This is the family's pocket headquarters:
          the plan, the map, the running tab. Come aboard.
        </p>
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <Button variant="primary" block onClick={() => setStep('name')}>Join the trip</Button>
          <div style={{ textAlign: 'center', marginTop: 12 }} className="metaline">Private · family + Hermes</div>
        </div>
      </div>
    );
  } else {
    // Name step — spec 04: required free text, 1–40 chars.
    body = (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="disp" style={{ fontSize: 36, lineHeight: 0.9 }}>Who's boarding?</div>
        <div className="metaline" style={{ marginTop: 6 }}>
          Your name goes on your check-ins, tasks, and votes.
        </div>
        <form
          style={{ marginTop: 18 }}
          onSubmit={(e) => { e.preventDefault(); if (!submitting) submit(); }}
        >
          <Field label="Your name" error={fieldError}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mai"
              maxLength={40}
              autoFocus
              autoComplete="name"
            />
          </Field>
          <div style={{ paddingTop: 8 }}>
            <Button variant="primary" block disabled={submitting || !name.trim()}>
              {submitting ? 'Stamping your pass…' : name.trim() ? `Continue as ${name.trim()}` : 'Enter your name'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="portal" style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--shell-edge)' }}>
      <div style={{ width: '100%', maxWidth: 480, height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <Hero dark={dark} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px var(--gutter) 24px', display: 'flex', flexDirection: 'column' }}>
          {body}
        </div>
      </div>
    </div>
  );
}
