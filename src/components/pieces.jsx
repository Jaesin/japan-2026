// pieces.jsx — small shared building blocks used by both posters.
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
