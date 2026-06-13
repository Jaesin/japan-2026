// pieces.jsx — small shared building blocks used by both posters.
import { useEffect, useRef, useState } from 'react';
import { Sun } from './motifs';

// Uppercase tracked eyebrow label.
// NOTE: in the prototype a direct-edit forced every Eyebrow to cream, which
// is correct over the red sun but invisible on the cream paper. In production
// pass `color` per instance: theme.muted on paper, theme.paper/cream over the sun.
export function Eyebrow({ children, color, style = {} }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 5, fontWeight: 700, color, textTransform: 'uppercase', ...style }}>
      {children}
    </div>
  );
}

// "Credits"-style overview rows. rows = [label, value, isHeadline?][]
export function Credits({ rows, label, value, line, font, displayFont }) {
  return (
    <div style={{ fontFamily: font }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '96px 1fr', gap: 14, padding: '11px 0',
          borderTop: i === 0 ? 'none' : `1px solid ${line}`, alignItems: 'baseline',
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: label, textTransform: 'uppercase', paddingTop: 2 }}>{r[0]}</div>
          <div style={{ fontFamily: r[2] ? displayFont : font, fontSize: r[2] ? 19 : 14.5, color: value, fontWeight: r[2] ? 400 : 500, letterSpacing: r[2] ? 0.4 : 0 }}>{r[1]}</div>
        </div>
      ))}
    </div>
  );
}

// Live "where today" line. Reads getTodayInfo() output (see tripData.js).
export function TodayBadge({ info, accent, ink, muted, font }) {
  if (info.phase === 'before') {
    return (
      <div style={{ fontFamily: font }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: muted, fontWeight: 700, whiteSpace: 'nowrap' }}>NOW BOARDING</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 52, fontWeight: 800, color: accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{info.daysToGo}</span>
          <span style={{ fontSize: 15, color: ink, fontWeight: 600, lineHeight: 1.1 }}>days until<br />departure</span>
        </div>
      </div>
    );
  }
  if (info.phase === 'during') {
    return (
      <div style={{ fontFamily: font }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: muted, fontWeight: 600 }}>TODAY · LIVE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1 }}>DAY {info.dayNum}</span>
          <span style={{ fontSize: 22, color: ink, fontWeight: 700 }}>· {info.stop.city}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: font }}>
      <div style={{ fontSize: 13, letterSpacing: 4, color: muted, fontWeight: 600 }}>THAT'S A WRAP</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginTop: 4 }}>Home from Japan</div>
    </div>
  );
}

// Dispatches feed header.
export function FeedHeader({ ink, accent, muted, font, displayFont }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 0 3px ${accent}33` }} />
        <span style={{ fontFamily: displayFont, fontSize: 22, color: ink, letterSpacing: 0.5 }}>Dispatches</span>
      </div>
      <span style={{ fontSize: 10, letterSpacing: 1.5, color: muted, fontWeight: 700, textTransform: 'uppercase' }}>Live July 4</span>
    </div>
  );
}

// Pre-trip / empty dispatch state — a single tasteful line in the SAME card
// shell as CheckinCard (matched container styling), shown when there are zero
// real check-ins so the feed never sits on stale sample data.
export function EmptyDispatch({ accent, ink, paper, muted, font, displayFont }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center', padding: '14px',
      background: paper, border: `1px solid ${muted}33`, borderLeft: `4px solid ${accent}`,
      fontFamily: font,
    }}>
      <Sun size={26} color={accent} style={{ marginTop: 0, opacity: 0.5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: displayFont, fontSize: 18, color: ink, letterSpacing: 0.3 }}>Dispatches begin July 4</div>
        <div style={{ fontSize: 12.5, color: ink, opacity: 0.78, lineHeight: 1.45, marginTop: 3 }}>The first postcard lands when the family does.</div>
      </div>
    </div>
  );
}

// ── Postcards strip (spec 22) ──────────────────────────────────────────────
// An ADDITIVE poster section: a horizontal strip of retro photo-cards, each a
// member's posted photo on a cream/paper border with a slight alternating
// rotation, caption, place + relative time. Matches CheckinCard's border/color/
// font idioms (all colors via the passed theme tokens — works in both modes).
// Newest first, max 12. The data-URL images are heavy, so each <img src> is
// deferred until the strip scrolls into view (IntersectionObserver); a neutral
// paper placeholder holds the layout so nothing jumps. Tapping a card opens a
// lightweight full-screen overlay; tap anywhere to dismiss.

// One photo card. Defers its real src until `armed` (strip is in view).
function PostcardCard({ card, rot, armed, onOpen, ink, paper, muted, line, font, displayFont }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      style={{
        flex: '0 0 auto', width: 188, padding: 10, paddingBottom: 12,
        background: paper, border: `1px solid ${line}`,
        boxShadow: `0 1px 0 ${muted}22`, transform: `rotate(${rot}deg)`,
        cursor: 'pointer', textAlign: 'left', fontFamily: font,
        WebkitTapHighlightColor: 'transparent', display: 'block',
      }}
      aria-label={`Open postcard${card.caption ? `: ${card.caption}` : ''}`}
    >
      <div style={{ width: '100%', aspectRatio: '4 / 3', background: `${muted}14`, border: `1px solid ${muted}22`, overflow: 'hidden' }}>
        {armed && card.img && (
          <img
            src={card.img}
            alt={card.caption || card.place || 'Postcard'}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>
      {card.caption && (
        <div style={{ fontFamily: displayFont, fontSize: 16, color: ink, letterSpacing: 0.3, lineHeight: 1.15, marginTop: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.caption}
        </div>
      )}
      {(card.place || card.when) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, marginTop: card.caption ? 3 : 9 }}>
          {card.place && <span style={{ fontSize: 11.5, color: ink, opacity: 0.8, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.place}</span>}
          {card.when && <span style={{ fontSize: 10.5, color: muted, fontWeight: 600, whiteSpace: 'nowrap', flex: '0 0 auto' }}>{card.when}</span>}
        </div>
      )}
    </button>
  );
}

export function PostcardStrip({ postcards = [], accent, ink, paper, muted, line, font, displayFont }) {
  const cards = postcards.slice(0, 12);
  const stripRef = useRef(null);
  const [armed, setArmed] = useState(false); // images mount only once in view
  const [open, setOpen] = useState(null);    // the enlarged card, or null

  useEffect(() => {
    if (armed) return undefined;
    const el = stripRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setArmed(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setArmed(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  if (cards.length === 0) return null;

  return (
    <div style={{ padding: '4px 30px 28px' }}>
      <FeedHeaderLabel label="Postcards" sub="From the road" ink={ink} accent={accent} muted={muted} font={font} displayFont={displayFont} />
      <div
        ref={stripRef}
        style={{
          display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, marginInline: -30, paddingInline: 30,
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}
      >
        {cards.map((c, i) => (
          <PostcardCard
            key={c.id || i}
            card={c}
            rot={i % 2 === 0 ? -1.5 : 1.5}
            armed={armed}
            onOpen={setOpen}
            ink={ink} paper={paper} muted={muted} line={line} font={font} displayFont={displayFont}
          />
        ))}
      </div>

      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out', fontFamily: font,
          }}
        >
          <img
            src={open.img}
            alt={open.caption || open.place || 'Postcard'}
            style={{ maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain', background: paper, padding: 8, border: `1px solid ${line}` }}
          />
          {(open.caption || open.place || open.when) && (
            <div style={{ marginTop: 14, textAlign: 'center', color: '#fff', maxWidth: 420 }}>
              {open.caption && <div style={{ fontFamily: displayFont, fontSize: 20, letterSpacing: 0.3 }}>{open.caption}</div>}
              <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>
                {[open.place, open.when].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Section header in the FeedHeader voice, reused by the postcard strip so it
// sits flush with the dispatch feed above it.
function FeedHeaderLabel({ label, sub, ink, accent, muted, font, displayFont }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 0 3px ${accent}33` }} />
        <span style={{ fontFamily: displayFont, fontSize: 22, color: ink, letterSpacing: 0.5 }}>{label}</span>
      </div>
      <span style={{ fontSize: 10, letterSpacing: 1.5, color: muted, fontWeight: 700, textTransform: 'uppercase' }}>{sub}</span>
    </div>
  );
}

// A single public check-in / "dispatch" postcard.
export function CheckinCard({ place, note, when, accent, ink, paper, muted, font, displayFont }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px',
      background: paper, border: `1px solid ${muted}33`, borderLeft: `4px solid ${accent}`,
      fontFamily: font,
    }}>
      <Sun size={26} color={accent} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, color: ink, letterSpacing: 0.3, flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place}</span>
          <span style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap', fontWeight: 600, flex: '0 0 auto' }}>{when}</span>
        </div>
        <div style={{ fontSize: 12.5, color: ink, opacity: 0.78, lineHeight: 1.45, marginTop: 3 }}>{note}</div>
      </div>
    </div>
  );
}
