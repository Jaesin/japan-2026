// TodayDashboard — the /portal landing page when the (hidden) `today` flag is
// on (spec 20). An ASSEMBLY screen: little new data, lots of glue. It pulls
// from itinerary (12), transport (16), accommodations (13), budget (14),
// tasks (10), packing (15) and research (11) and shows "now" at a glance.
//
// Two modes keyed off getTodayInfo().phase:
//   'during' → today's plan, transit, tonight's bed, quick actions, spend
//   'before' → countdown hero, tasks due this week, packing %, latest research
// 'after' falls back to a friendly trip-complete hero (never broken).
//
// Every section is a modular sub-component; the spec warns section order may
// shuffle later, so each is independent and renders nothing (or a one-line
// placeholder) when it has no data — never a broken/empty card.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../data/useCollection.js';
import { useDoc } from '../../data/useDoc.js';
import { updateItem, setItem } from '../../data/mutate.js';
import { Button } from '../ui/ui.jsx';
import { SunBurst } from '../ui/primitives.jsx';
import { ROUTE, getTodayInfo } from '../../tripData.js';
import './today.css';

const FALLBACK_FX = 23;        // THB per ¥100 (matches BudgetPage)
const TOKYO_LL = [35.6762, 139.6503];

/* ---- date helpers (local-safe; mirror the other pages) --------------------- */
function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/* "Today" as a YYYY-MM-DD id, honouring the ?fakeDate dev override via
   getTodayInfo — we recompute the base date the same way it does. */
function todayId() {
  // getTodayInfo doesn't return the resolved Date, but dayNum + TRIP_START let
  // us reconstruct it for the during phase; for before/after we still want the
  // real (possibly-faked) calendar date, so derive from the same source.
  const info = getTodayInfo();
  if (info.phase === 'during') {
    const dt = new Date(2026, 6, 4 + (info.dayNum - 1)); // Jul 4 2026 + (day-1)
    return ymd(dt);
  }
  // before/after: fall back to the (faked or real) device date used by the
  // override; reuse the same query parse so countdown previews line up.
  return ymd(resolveBaseDate());
}
/* Resolve the same base date getTodayInfo uses (fakeDate or now). Kept local
   so we don't change tripData's public surface. */
function resolveBaseDate() {
  if (typeof window !== 'undefined' && window.location) {
    const { search, hash } = window.location;
    const pick = (qs) => {
      const i = (qs || '').indexOf('?');
      if (i < 0) return null;
      return new URLSearchParams(qs.slice(i + 1)).get('fakeDate');
    };
    const raw = pick(search) || pick(hash);
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
}
function fmtLong(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
/* current HH:MM in 24h, honouring fakeDate's date but real wall-clock time */
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---- itinerary sort (mirror ItineraryPage.sortedActivities) ----------------- */
function sortedActivities(activities) {
  const list = (activities || []).map((a, i) => ({ ...a, _i: i }));
  return list.sort((a, b) => {
    const at = a.time || '';
    const bt = b.time || '';
    if (at && bt) return at.localeCompare(bt) || a._i - b._i;
    if (at) return -1;
    if (bt) return 1;
    return a._i - b._i;
  });
}

/* ---- THB conversion (mirror BudgetPage) ------------------------------------- */
function toTHB(entry, fxRate) {
  if (entry.amountTHB) return entry.amountTHB;
  if (entry.amountJPY) return (entry.amountJPY * fxRate) / 100;
  return 0;
}

/* google maps deep link — prefer ll, else address (mirror AccommodationsPage) */
function mapsUrl(stay) {
  let query;
  if (Array.isArray(stay.ll) && stay.ll.length === 2) query = `${stay.ll[0]},${stay.ll[1]}`;
  else if (stay.address) query = stay.address;
  else query = stay.name || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/* coords for today's city — match today's itinerary city against ROUTE, else
   the during-phase stop, else Tokyo. */
function cityLL(cityName) {
  const hit = ROUTE.find((r) => r.city.toLowerCase() === String(cityName || '').toLowerCase());
  return hit?.ll || TOKYO_LL;
}

/* =========================================================================== */
/* Weather strip — Open-Meteo, no key, cached in localStorage.                 */
/* =========================================================================== */
function WeatherStrip({ city, ll }) {
  const [view, setView] = useState(null); // { line, stale }
  const cacheKey = `japan2026.weather.${city || 'tokyo'}`;

  useEffect(() => {
    let cancelled = false;

    // Seed from cache immediately so we never block render / flash empty.
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.line) setView({ line: cached.line, stale: true });
      }
    } catch { /* ignore bad cache */ }

    const [lat, lng] = ll;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
      + `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max`
      + `&timezone=Asia%2FTokyo&forecast_days=2`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('weather'))))
      .then((data) => {
        if (cancelled) return;
        const dly = data?.daily;
        if (!dly || !dly.temperature_2m_max) return;
        const min = Math.round(dly.temperature_2m_min[0]);
        const max = Math.round(dly.temperature_2m_max[0]);
        const pp = dly.precipitation_probability_max?.[0];
        const line = `${min}° / ${max}°`
          + (pp != null ? ` · ☔ ${pp}%` : '');
        setView({ line, stale: false });
        try { localStorage.setItem(cacheKey, JSON.stringify({ line, ts: Date.now() })); } catch { /* quota */ }
      })
      .catch(() => { /* offline → keep the cached (stale) line if any */ });

    return () => { cancelled = true; };
  }, [cacheKey, ll]);

  if (!view) return null;
  return (
    <div className="today-weather">
      <span className="today-weather__line">{view.line}</span>
      {view.stale && <span className="today-weather__stale">(offline)</span>}
    </div>
  );
}

/* =========================================================================== */
/* DURING — header band                                                        */
/* =========================================================================== */
function HeaderBand({ dayNum, city, dateIso }) {
  return (
    <div className="today-head">
      <div className="today-head__line">
        <span className="today-head__day">Day {dayNum}</span>
        <span className="today-head__sep">·</span>
        <span className="today-head__city">{city}</span>
        <span className="today-head__sep">·</span>
        <span className="today-head__date">{fmtLong(dateIso)}</span>
      </div>
      <WeatherStrip city={city} ll={cityLL(city)} />
    </div>
  );
}

/* =========================================================================== */
/* DURING — today's plan                                                       */
/* =========================================================================== */
function TodaysPlan({ dateIso, navigate }) {
  const { data, loading } = useDoc(['itinerary', dateIso]);
  const activities = useMemo(() => data?.activities || [], [data]);
  const ordered = useMemo(() => sortedActivities(activities), [activities]);

  // "now" = latest scheduled activity whose time ≤ current time; "next" = the
  // following scheduled one. Unscheduled items never count as now/next.
  const { nowId, nextId } = useMemo(() => {
    const t = nowHHMM();
    const scheduled = ordered.filter((a) => a.time);
    let now = null;
    for (const a of scheduled) if (a.time <= t) now = a;
    let next = null;
    if (now) {
      const i = scheduled.findIndex((a) => a.id === now.id);
      next = scheduled[i + 1] || null;
    } else {
      next = scheduled[0] || null;
    }
    return { nowId: now?.id || null, nextId: next?.id || null };
  }, [ordered]);

  const toggleDone = (act, e) => {
    e.stopPropagation();
    const next = activities.map((a) => (a.id === act.id ? { ...a, done: !a.done } : a));
    // Day doc already exists if we read activities from it; merge keeps it safe.
    if (data) updateItem(['itinerary', dateIso], { activities: next }).catch(console.error);
    else setItem(['itinerary', dateIso], { activities: next }, { merge: true }).catch(console.error);
  };

  return (
    <section className="today-sec">
      <div className="today-sec__head">Today&rsquo;s plan</div>
      {loading ? (
        <div className="today-empty">Loading the day…</div>
      ) : ordered.length === 0 ? (
        <div className="today-empty">Nothing planned for today yet.</div>
      ) : (
        <div className="today-plan">
          {ordered.map((a) => {
            const tag = a.id === nowId ? 'now' : a.id === nextId ? 'next' : null;
            return (
              <div
                key={a.id}
                className={'today-plan__row'
                  + (tag ? ` today-plan__row--${tag}` : '')
                  + (a.done ? ' today-plan__row--done' : '')}
                role="button"
                tabIndex={0}
                onClick={() => navigate('/portal/itinerary')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/portal/itinerary'); } }}
              >
                <button
                  type="button"
                  className={'today-plan__check' + (a.done ? ' today-plan__check--on' : '')}
                  aria-pressed={!!a.done}
                  aria-label={a.done ? 'Mark not done' : 'Mark done'}
                  onClick={(e) => toggleDone(a, e)}
                />
                <span className="today-plan__time">{a.time || '·'}</span>
                <span className="today-plan__main">
                  <span className="today-plan__title">{a.title}</span>
                  {a.locationName && <span className="today-plan__loc">{a.locationName}</span>}
                </span>
                {tag && <span className={`today-plan__tag today-plan__tag--${tag}`}>{tag === 'now' ? 'Now' : 'Next'}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* =========================================================================== */
/* DURING — transit today                                                      */
/* =========================================================================== */
/* minutes between current wall-clock and a HH:MM today → friendly countdown */
function depCountdown(depTime) {
  if (!depTime) return null;
  const [h, m] = depTime.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const now = new Date();
  const dep = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const diffMin = Math.round((dep - now) / 60000);
  if (diffMin < 0) return 'departed';
  if (diffMin === 0) return 'departing now';
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  const parts = [];
  if (hrs) parts.push(`${hrs}h`);
  parts.push(`${mins}m`);
  return `departs in ${parts.join(' ')}`;
}

function TransitToday({ dateIso, navigate }) {
  const { docs } = useCollection(['transport']);
  const legs = useMemo(
    () => docs
      .filter((l) => l.date === dateIso)
      .sort((a, b) => (a.depTime || '99:99').localeCompare(b.depTime || '99:99')),
    [docs, dateIso],
  );

  // Re-render once a minute so the countdown stays live.
  const [, tick] = useState(0);
  useEffect(() => {
    if (legs.length === 0) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [legs.length]);

  if (legs.length === 0) return null;
  return (
    <section className="today-sec">
      <div className="today-sec__head">Transit today</div>
      <div className="today-list">
        {legs.map((leg) => {
          const cd = depCountdown(leg.depTime);
          return (
            <div
              key={leg.id}
              className="today-row"
              role="button"
              tabIndex={0}
              onClick={() => navigate('/portal/transport')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/portal/transport'); } }}
            >
              <span className="today-row__main">
                <span className="today-row__title">{[leg.carrier, `${leg.from} → ${leg.to}`].filter(Boolean).join(' · ')}</span>
                <span className="today-row__meta">
                  {[leg.depTime && `Dep ${leg.depTime}`, cd].filter(Boolean).join(' · ')}
                </span>
              </span>
              {cd && (
                <span className={'today-row__cd' + (cd === 'departed' ? ' today-row__cd--past' : '')}>
                  {cd === 'departed' ? 'departed' : cd.replace('departs in ', '')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================================== */
/* DURING — tonight (accommodation)                                            */
/* =========================================================================== */
function Tonight({ dateIso, navigate }) {
  const { docs } = useCollection(['accommodations']);
  const [copied, setCopied] = useState(false);
  const stay = useMemo(
    () => docs.find((d) => Array.isArray(d.nights) && d.nights.includes(dateIso)) || null,
    [docs, dateIso],
  );

  if (!stay) return null;

  const copyAddress = (e) => {
    e.stopPropagation();
    if (!stay.address) return;
    navigator.clipboard.writeText(stay.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(console.error);
  };

  return (
    <section className="today-sec">
      <div className="today-sec__head">Tonight</div>
      <div
        className="today-stay"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/portal/accommodations')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/portal/accommodations'); } }}
      >
        <div className="today-stay__name">{stay.name}</div>
        <div className="today-stay__meta">
          {[stay.city, stay.checkInTime && `Check-in ${stay.checkInTime}`].filter(Boolean).join(' · ')}
        </div>
        {stay.accessNotes && (
          <div className="today-stay__access">
            <span className="today-stay__access-label">Access</span> {stay.accessNotes}
          </div>
        )}
        {(stay.address || stay.ll) && (
          <div className="today-stay__acts">
            <a
              className="today-stay__act today-stay__act--primary"
              href={mapsUrl(stay)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Open in Maps
            </a>
            <button
              type="button"
              className="today-stay__act"
              onClick={copyAddress}
              disabled={!stay.address}
            >
              {copied ? 'Copied ✓' : 'Copy address'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================================== */
/* DURING — quick actions                                                      */
/* =========================================================================== */
function QuickActions({ navigate }) {
  return (
    <section className="today-sec">
      <div className="today-actions">
        <button className="today-action" onClick={() => navigate('/portal/budget')}>
          <span className="today-action__ico" aria-hidden="true">➕</span>
          <span className="today-action__lab">Expense</span>
        </button>
        {/* Check-in (spec 21): jump to the check-in flow on the dispatches page. */}
        <button className="today-action" onClick={() => navigate('/portal/checkins')}>
          <span className="today-action__ico" aria-hidden="true">📍</span>
          <span className="today-action__lab">Check in</span>
        </button>
        <button className="today-action" onClick={() => navigate('/portal/journal')}>
          <span className="today-action__ico" aria-hidden="true">📓</span>
          <span className="today-action__lab">Journal</span>
        </button>
      </div>
    </section>
  );
}

/* =========================================================================== */
/* DURING — today's spend chip                                                 */
/* =========================================================================== */
function SpendChip({ dateIso }) {
  const { docs } = useCollection(['budget']);
  const { data: config } = useDoc(['config', 'main']);
  const fxRate = config?.fxRate || FALLBACK_FX;

  const { jpy, thb, count } = useMemo(() => {
    let j = 0;
    let t = 0;
    let c = 0;
    for (const e of docs) {
      if (e.kind === 'actual' && e.date === dateIso) {
        c += 1;
        j += e.amountJPY != null ? e.amountJPY : (e.amountTHB ? (e.amountTHB * 100) / fxRate : 0);
        t += toTHB(e, fxRate);
      }
    }
    return { jpy: j, thb: t, count: c };
  }, [docs, dateIso, fxRate]);

  if (count === 0) return null;
  return (
    <div className="today-spend">
      <span className="today-spend__label">Today&rsquo;s spend</span>
      <span className="today-spend__amt">
        ¥{Math.round(jpy).toLocaleString()}
        <span className="today-spend__thb"> · ฿{Math.round(thb).toLocaleString()}</span>
      </span>
    </div>
  );
}

/* =========================================================================== */
/* PRE-TRIP — countdown hero                                                   */
/* =========================================================================== */
function CountdownHero({ daysToGo }) {
  return (
    <div className="today-hero">
      <SunBurst size={120} disc={64} rays={22} color="var(--accent)" style={{ opacity: 0.9 }} />
      <div className="today-hero__num">{daysToGo}</div>
      <div className="today-hero__lab">{daysToGo === 1 ? 'DAY TO GO' : 'DAYS TO GO'}</div>
    </div>
  );
}

/* =========================================================================== */
/* PRE-TRIP — tasks due this week                                              */
/* =========================================================================== */
function TasksDueWeek({ baseIso, navigate }) {
  const { docs } = useCollection(['tasks']);
  const horizon = useMemo(() => {
    const [y, m, d] = baseIso.split('-').map(Number);
    return ymd(new Date(y, m - 1, d + 7));
  }, [baseIso]);

  const due = useMemo(
    () => docs
      .filter((t) => t.status !== 'done' && t.dueDate && t.dueDate >= baseIso && t.dueDate <= horizon)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [docs, baseIso, horizon],
  );

  if (due.length === 0) return null;
  return (
    <section className="today-sec">
      <div className="today-sec__head">Due this week</div>
      <div className="today-list">
        {due.map((t) => (
          <div
            key={t.id}
            className="today-row"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/portal/tasks')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/portal/tasks'); } }}
          >
            <span className="today-row__main">
              <span className="today-row__title">{t.title}</span>
              <span className="today-row__meta">{[t.assignee && t.assignee !== 'anyone' ? t.assignee : null, `Due ${fmtLong(t.dueDate)}`].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================================== */
/* PRE-TRIP — packing progress (final week only)                              */
/* =========================================================================== */
function PackingProgress({ daysToGo, navigate }) {
  const { docs } = useCollection(['packing']);
  // Spec: only in the final week.
  if (daysToGo > 7) return null;
  const total = docs.length;
  if (total === 0) return null;
  const packed = docs.filter((d) => d.packed).length;
  const pct = Math.round((packed / total) * 100);

  return (
    <section className="today-sec">
      <div className="today-sec__head">Packing</div>
      <div
        className="today-pack"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/portal/packing')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/portal/packing'); } }}
      >
        <div className="today-pack__head">
          <span>{packed} / {total} packed</span>
          <span className="today-pack__pct">{pct}%</span>
        </div>
        <div className="today-pack__track">
          <div className={'today-pack__fill' + (pct >= 100 ? ' today-pack__fill--done' : '')} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  );
}

/* =========================================================================== */
/* PRE-TRIP — latest research                                                  */
/* =========================================================================== */
function LatestResearch({ navigate }) {
  // Spec 41's activity feed isn't built; until then show the 3 most-recently
  // created research cards as a light "recently added" list. Swap to the feed
  // when spec 41 lands.
  const { docs } = useCollection(['research']);
  const latest = useMemo(() => {
    const toMs = (c) => (c?.seconds ? c.seconds * 1000 : (c?.toMillis ? c.toMillis() : 0));
    return [...docs]
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 3);
  }, [docs]);

  if (latest.length === 0) return null;
  return (
    <section className="today-sec">
      <div className="today-sec__head">Recently added</div>
      <div className="today-list">
        {latest.map((r) => (
          <div
            key={r.id}
            className="today-row"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/portal/research')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/portal/research'); } }}
          >
            <span className="today-row__main">
              <span className="today-row__title">{r.title}</span>
              <span className="today-row__meta">{[r.city, r.category].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================================== */
/* Page                                                                        */
/* =========================================================================== */
export default function TodayDashboard({ enabled = [] }) {
  const navigate = useNavigate();
  const info = getTodayInfo();
  const dateIso = todayId();

  if (info.phase === 'during') {
    return (
      <div className="today" style={{ padding: 'var(--gutter)' }}>
        <HeaderBand dayNum={info.dayNum} city={info.stop.city} dateIso={dateIso} />
        <TodaysPlan dateIso={dateIso} navigate={navigate} />
        <TransitToday dateIso={dateIso} navigate={navigate} />
        <Tonight dateIso={dateIso} navigate={navigate} />
        <QuickActions navigate={navigate} />
        <SpendChip dateIso={dateIso} />
      </div>
    );
  }

  if (info.phase === 'after') {
    return (
      <div className="today" style={{ padding: 'var(--gutter)' }}>
        <div className="today-hero">
          <SunBurst size={120} disc={64} rays={22} color="var(--accent)" style={{ opacity: 0.9 }} />
          <div className="today-hero__lab today-hero__lab--done">おかえり — welcome home</div>
          <p className="metaline" style={{ textAlign: 'center', maxWidth: 280 }}>
            The trip&rsquo;s a wrap. The journal, budget, and photos are all still here.
          </p>
          {enabled.length > 0 && (
            <Button variant="secondary" onClick={() => navigate('/portal/journal')}>Open the journal</Button>
          )}
        </div>
      </div>
    );
  }

  // 'before'
  return (
    <div className="today" style={{ padding: 'var(--gutter)' }}>
      <CountdownHero daysToGo={info.daysToGo} />
      <TasksDueWeek baseIso={dateIso} navigate={navigate} />
      <PackingProgress daysToGo={info.daysToGo} navigate={navigate} />
      <LatestResearch navigate={navigate} />
      {/* If every section above is empty, the page still reads as the countdown
          hero — never blank. */}
    </div>
  );
}
