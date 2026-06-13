// PosterLight.jsx — Direction A "Rising Sun" (light mode).
// V1b corner rising-sun hero → live "today" band → itinerary → map → dispatches.
import { light as T } from '../theme';
import { SAMPLE_CHECKINS, getTodayInfo, relativeTime } from '../tripData';
import { Sun, SunBurst, Fuji } from './motifs';
import { Eyebrow, Credits, TodayBadge, FeedHeader, CheckinCard, EmptyDispatch, PostcardStrip } from './pieces';
import RouteMap from './RouteMap';
import { lastSeenFromCheckins } from './checkinUtils';

export default function PosterLight({ checkins = SAMPLE_CHECKINS, postcards = [] }) {
  const info = getTodayInfo();
  const F = T.fonts;
  const lastSeen = lastSeenFromCheckins(checkins);
  return (
    <div style={{ background: T.paper, color: T.ink, fontFamily: F.body }}>
      {/* ── Hero: V1b corner rising sun (rays clipped above the byline) ── */}
      <div style={{ position: 'relative', padding: '26px 30px 0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 366, overflow: 'hidden', pointerEvents: 'none' }}>
          <SunBurst size={1530} disc={342} color={T.accent} rays={24} style={{ position: 'absolute', top: -724, right: -736 }} />
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* eyebrow overlaps the sun → cream for legibility (see Eyebrow note) */}
          <Eyebrow color={T.paper}>Est. Summer</Eyebrow>
          <div style={{ fontFamily: F.jp, fontSize: 19, color: T.paper, writingMode: 'vertical-rl', letterSpacing: 3, height: 128, textAlign: 'center' }}>日本の旅</div>
        </div>
        <div style={{ position: 'relative', marginTop: 86 }}>
          <div style={{ fontFamily: F.display, fontSize: 150, lineHeight: 0.82, letterSpacing: -2, color: T.ink }}>JAPAN</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <span style={{ height: 2, width: 38, background: T.accent }} />
            <span style={{ fontSize: 13, letterSpacing: 4, fontWeight: 700 }}>THE MULENEX FAMILY · 2026</span>
          </div>
          <p style={{ fontFamily: F.jp, fontSize: 16.5, lineHeight: 1.5, color: T.ink, opacity: 0.82, margin: '16px 0 0', maxWidth: 360 }}>
            This summer, one family crosses the Land of the Rising Sun — from the neon canyons of Tokyo to the temple-lit hills of Kyoto.
          </p>
        </div>
        <div style={{ marginTop: 26, marginLeft: -30, marginRight: -30 }}>
          <Fuji width={540} color={T.ink} snow={T.paper} style={{ marginBottom: -2 }} />
        </div>
      </div>

      {/* ── Live "today" / countdown band ── */}
      <div style={{ background: T.ink, color: T.paper, padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TodayBadge info={info} accent={T.gold} ink={T.paper} muted={'rgba(244,236,216,0.55)'} font={F.body} />
        <Sun size={44} color={T.accent} ring={'rgba(244,236,216,0.15)'} />
      </div>

      {/* ── Itinerary overview ── */}
      <div style={{ padding: '24px 30px 6px' }}>
        <Eyebrow color={T.muted} style={{ marginBottom: 10 }}>The Itinerary</Eyebrow>
        <Credits font={F.body} displayFont={F.display} label={T.muted} value={T.ink} line={T.line} rows={[
          ['Featuring', 'Tokyo · Hakone · Kyoto · Nara · Osaka', true],
          ['Runtime', '10 days across Honshū'],
          ['Premieres', 'July 4, 2026'],
          ['Status', 'Route still being charted'],
        ]} />
      </div>

      {/* ── Route map ── */}
      <div style={{ padding: '14px 30px 0' }}>
        <Eyebrow color={T.muted} style={{ marginBottom: 10 }}>The Route</Eyebrow>
        <div style={{ border: `1px solid ${T.line}` }}>
          <RouteMap skin={T.map.skin} tiles={T.map.tiles} height={200} accent={T.accent} ink={T.ink} lastSeenIdx={lastSeen.idx} label={lastSeen.label} />
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>Map © OpenStreetMap · CARTO</div>
      </div>

      {/* ── Dispatches (check-in feed) ── */}
      <div style={{ padding: '22px 30px 28px' }}>
        <FeedHeader ink={T.ink} accent={T.accent} muted={T.muted} font={F.body} displayFont={F.display} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {checkins.length === 0 ? (
            <EmptyDispatch accent={T.accent} ink={T.ink} paper={T.cardBg} muted={T.muted} font={F.body} displayFont={F.display} />
          ) : (
            checkins.slice(0, 2).map((c, i) => (
              <CheckinCard key={c.id || i} {...c} when={c.when || relativeTime(c.at)} accent={T.accent} ink={T.ink} paper={T.cardBg} muted={T.muted} font={F.body} displayFont={F.display} />
            ))
          )}
        </div>
      </div>

      {/* ── Postcards strip (spec 22) — additive; rendered only when present ── */}
      {postcards.length > 0 && (
        <PostcardStrip
          postcards={postcards.map((p) => ({ ...p, when: p.when || relativeTime(p.at) }))}
          accent={T.accent} ink={T.ink} paper={T.cardBg} muted={T.muted} line={T.line} font={F.body} displayFont={F.display}
        />
      )}
    </div>
  );
}
