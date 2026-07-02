// PosterDark.jsx — Direction B "Sunset Express" (dark mode).
// Flat sunset-band hero → tagline + live "today" → itinerary → map → dispatches.
import { dark as T } from '../theme';
import { SAMPLE_CHECKINS, getTodayInfo, relativeTime } from '../tripData';
import { Sun, Fuji } from './motifs';
import { Eyebrow, Credits, TodayBadge, FeedHeader, CheckinCard, EmptyDispatch, PostcardStrip } from './pieces';
import RouteMap from './RouteMap';
import { lastSeenFromCheckins } from './checkinUtils';

export default function PosterDark({ checkins = SAMPLE_CHECKINS, postcards = [] }) {
  const info = getTodayInfo();
  const F = T.fonts;
  const lastSeen = lastSeenFromCheckins(checkins);
  return (
    <div style={{ background: T.night, color: T.cream, fontFamily: F.body }}>
      {/* ── Hero: flat sunset bands + sun behind Fuji ── */}
      <div style={{ position: 'relative', height: 380, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: T.night }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: T.indigo }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, background: T.pink }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, background: T.orange }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)', width: 168, height: 168, borderRadius: '50%', background: T.accent }} />
        <Fuji width={520} color={T.fuji.fill} snow={T.fuji.snow} style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)' }} />
        <div style={{ position: 'relative', padding: '26px 30px 0', textAlign: 'center' }}>
          <Eyebrow color={T.muted}>The Mulenex Family Presents</Eyebrow>
          <div style={{ fontFamily: F.display, fontSize: 132, lineHeight: 0.78, letterSpacing: 2, color: T.cream, marginTop: 8, textShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>JAPAN</div>
          <div style={{ fontSize: 12, letterSpacing: 5, fontWeight: 600, marginTop: 6, color: T.cream }}>SUMMER 2026</div>
        </div>
      </div>

      {/* ── Tagline + live "today" ── */}
      <div style={{ padding: '22px 30px 0' }}>
        <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0, color: T.cream, opacity: 0.85, textAlign: 'center', maxWidth: 380, marginInline: 'auto' }}>
          One family. Two weeks. The last train into the sunset over the Land of the Rising Sun.
        </p>
        <div style={{ marginTop: 22, padding: '18px 0', borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <TodayBadge info={info} accent={T.orange} ink={T.cream} muted={T.muted} font={F.body} />
          <Sun size={42} color={T.accent} />
        </div>
      </div>

      {/* ── Itinerary overview ── */}
      <div style={{ padding: '20px 30px 6px' }}>
        <Credits font={F.body} displayFont={F.display} label={T.muted} value={T.cream} line={T.line} rows={[
          ['Featuring', 'Osaka · Nara · Kyoto · Tokyo', true],
          ['Runtime', '11 days'],
          ['Premieres', 'July 3, 2026'],
        ]} />
      </div>

      {/* ── Route map ── */}
      <div style={{ padding: '14px 30px 0' }}>
        <Eyebrow color={T.muted} style={{ marginBottom: 10 }}>The Route</Eyebrow>
        <div style={{ border: `1px solid ${T.line}` }}>
          <RouteMap skin={T.map.skin} tiles={T.map.tiles} height={196} accent={T.accent} ink={T.cream} lastSeenIdx={lastSeen.idx} label={lastSeen.label} />
        </div>
      </div>

      {/* ── Dispatches (check-in feed) ── */}
      <div style={{ padding: '22px 30px 28px' }}>
        <FeedHeader ink={T.cream} accent={T.accent} muted={T.muted} font={F.body} displayFont={F.display} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {checkins.length === 0 ? (
            <EmptyDispatch accent={T.accent} ink={T.cream} paper={T.cardBg} muted={T.muted} font={F.body} displayFont={F.display} />
          ) : (
            checkins.slice(0, 2).map((c, i) => (
              <CheckinCard key={c.id || i} {...c} when={c.when || relativeTime(c.at)} accent={T.accent} ink={T.cream} paper={T.cardBg} muted={T.muted} font={F.body} displayFont={F.display} />
            ))
          )}
        </div>
      </div>

      {/* ── Postcards strip (spec 22) — additive; rendered only when present ── */}
      {postcards.length > 0 && (
        <PostcardStrip
          postcards={postcards.map((p) => ({ ...p, when: p.when || relativeTime(p.at) }))}
          accent={T.accent} ink={T.cream} paper={T.cardBg} muted={T.muted} line={T.line} font={F.body} displayFont={F.display}
        />
      )}
    </div>
  );
}
