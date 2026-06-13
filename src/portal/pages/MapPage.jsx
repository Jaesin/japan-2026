// MapPage — Live Trip Map (spec 24). A full-bleed-ish Leaflet map with
// toggleable layer chips, a day-filter strip, and a "Fit today" button (during
// the trip). All pin data comes from already-subscribed Firestore collections
// (config/main, itinerary, accommodations) so it renders from cache offline —
// no new queries. Tiles are the only online dependency.
//
// DEFERRED future layers (their collections don't exist yet — do NOT add chips):
//   • Food list (spec 18) — chopsticks pins, off by default
//   • Check-ins (spec 21) — pulsing red glow pins
//
// The actual Leaflet plumbing lives in ../components/TripMap.jsx (a portal-side
// reuse of RouteMap's vanilla-Leaflet patterns; the poster's RouteMap is left
// untouched per CLAUDE.md).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../data/useCollection.js';
import { useDoc } from '../../data/useDoc.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import { ROUTE, TRIP_DAYS as TRIP_DAYS_FALLBACK, getTodayInfo } from '../../tripData.js';
import TripMap from '../components/TripMap.jsx';
import L from 'leaflet';
import './mappage.css';

const TRIP_START_FALLBACK = '2026-07-04';

/* deterministic doc id for a Date offset from the start (local, no UTC shift) */
function dateIdFromStart(startIso, offsetDays) {
  const [y, m, d] = startIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function fmtShort(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function todayId() {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function cityForDay(routeStops, dayNum) {
  let stop = routeStops[0];
  for (const r of routeStops) if (r.day <= dayNum) stop = r;
  return stop?.city || '';
}

/* timeline order: scheduled (HH:MM) ascending, then unscheduled in array order */
function orderedActs(activities) {
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

const ALL = 'all';

export default function MapPage() {
  const navigate = useNavigate();
  const { features, loading: featuresLoading } = useFeatures();
  const { data: configMain } = useDoc(['config', 'main']);
  const { docs: itinDocs } = useCollection(['itinerary']);
  const { docs: stays } = useCollection(['accommodations']);

  const [layers, setLayers] = useState({ route: true, itinerary: true, stays: true });
  const [selectedDay, setSelectedDay] = useState(ALL); // ALL or a dateId
  const [me, setMe] = useState(null);        // [lat,lng] | null
  const [meError, setMeError] = useState('');
  const [card, setCard] = useState(null);    // tapped pin mini-card
  const [fitKey, setFitKey] = useState('init');
  const [fitToday, setFitToday] = useState(false);

  const info = getTodayInfo();
  const route = Array.isArray(configMain?.route) && configMain.route.length ? configMain.route : ROUTE;

  /* trip day list (dateId + dayNum + city), preferring itinerary docs */
  const days = useMemo(() => {
    if (itinDocs.length) {
      return [...itinDocs]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => ({
          dateId: d.id,
          dayNum: d.dayNum,
          city: d.city || cityForDay(route, d.dayNum),
          activities: d.activities || [],
        }));
    }
    const startIso = configMain?.startDate || TRIP_START_FALLBACK;
    const tripDays = configMain?.tripDays || TRIP_DAYS_FALLBACK;
    return Array.from({ length: tripDays }, (_, i) => ({
      dateId: dateIdFromStart(startIso, i),
      dayNum: i + 1,
      city: cityForDay(route, i + 1),
      activities: [],
    }));
  }, [itinDocs, configMain, route]);

  /* activities-with-coords for the selected day (or all), in timeline order */
  const itinByDay = useMemo(() => {
    const out = [];
    for (const d of days) {
      if (selectedDay !== ALL && d.dateId !== selectedDay) continue;
      orderedActs(d.activities)
        .filter((a) => Array.isArray(a.ll) && a.ll.length === 2)
        .forEach((a, i) => out.push({ ...a, dayNum: d.dayNum, dateId: d.dateId, seq: i + 1 }));
    }
    return out;
  }, [days, selectedDay]);

  /* dashed polyline: only when a single day is selected (its acts in order) */
  const polyline = useMemo(() => {
    if (selectedDay === ALL) return null;
    return itinByDay.map((a) => a.ll);
  }, [selectedDay, itinByDay]);

  /* build the marker list from the enabled layers */
  const markers = useMemo(() => {
    const out = [];
    if (layers.route) {
      route.forEach((r, i) => {
        if (!Array.isArray(r.ll)) return;
        out.push({
          id: `route-${i}`, ll: r.ll, kind: 'route',
          label: r.city,
          onTap: (m) => setCard({ title: r.city, sub: r.jp || `Day ${r.day}`, ll: m.ll }),
        });
      });
    }
    if (layers.itinerary) {
      itinByDay.forEach((a) => {
        out.push({
          id: `itin-${a.dateId}-${a.id}`, ll: a.ll, kind: 'itin', dayNum: a.dayNum, seq: a.seq,
          label: a.title,
          onTap: (m) => setCard({
            title: a.title,
            sub: `Day ${a.dayNum}${a.time ? ` · ${a.time}` : ''}${a.locationName ? ` · ${a.locationName}` : ''}`,
            link: '/portal/itinerary', linkLabel: 'View in itinerary', ll: m.ll,
          }),
        });
      });
    }
    if (layers.stays) {
      stays.forEach((s) => {
        if (!Array.isArray(s.ll) || s.ll.length !== 2) return;
        out.push({
          id: `stay-${s.id}`, ll: s.ll, kind: 'stay',
          label: s.name,
          onTap: (m) => setCard({
            title: s.name,
            sub: [s.city, s.address].filter(Boolean).join(' · '),
            link: '/portal/accommodations', linkLabel: 'View stay', ll: m.ll,
          }),
        });
      });
    }
    if (me) {
      out.push({ id: 'me', ll: me, kind: 'me', label: 'You are here' });
    }
    return out;
  }, [layers, route, itinByDay, stays, me]);

  /* onFit handler: "Fit today" zooms to today's itinerary pins + tonight's
     stay; otherwise (default) fit to route bounds. */
  const onFit = useMemo(() => {
    return (map) => {
      let lls = [];
      if (fitToday && info.phase === 'during') {
        const tid = todayId();
        const todayDoc = days.find((d) => d.dateId === tid);
        if (todayDoc) {
          orderedActs(todayDoc.activities)
            .filter((a) => Array.isArray(a.ll) && a.ll.length === 2)
            .forEach((a) => lls.push(a.ll));
        }
        // tonight's stay: a stay whose nights[] includes today
        const tonight = stays.find((s) => Array.isArray(s.nights) && s.nights.includes(tid) && Array.isArray(s.ll));
        if (tonight) lls.push(tonight.ll);
      }
      if (!lls.length) {
        lls = route.filter((r) => Array.isArray(r.ll)).map((r) => r.ll);
      }
      if (lls.length > 1) map.fitBounds(L.latLngBounds(lls), { padding: [44, 44] });
      else if (lls.length === 1) map.setView(lls[0], 13);
    };
  }, [fitToday, info.phase, days, stays, route]);

  /* feature gate */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'map')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            The map isn&rsquo;t switched on yet. Flip the toggle in Settings.
          </p>
        </div>
      </div>
    );
  }

  const toggleLayer = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  const locateMe = () => {
    setMeError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMeError('Location not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        setMe(ll);
        setFitKey(`me-${Date.now()}`);
      },
      () => setMeError('Location permission denied.'),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const fitTodayNow = () => {
    setFitToday(true);
    setFitKey(`today-${Date.now()}`);
  };

  return (
    <div className="mappage">
      <div className="mappage__head">
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>Everything, spatially</span>
        <h1 className="disp mappage__title">MAP</h1>
      </div>

      {/* layer chips + day strip */}
      <div className="mappage__chips">
        <button
          className={'mp-chip' + (layers.route ? ' mp-chip--on' : '')}
          aria-pressed={layers.route}
          onClick={() => toggleLayer('route')}
        >Route</button>
        <button
          className={'mp-chip' + (layers.itinerary ? ' mp-chip--on' : '')}
          aria-pressed={layers.itinerary}
          onClick={() => toggleLayer('itinerary')}
        >Itinerary</button>
        <button
          className={'mp-chip' + (layers.stays ? ' mp-chip--on' : '')}
          aria-pressed={layers.stays}
          onClick={() => toggleLayer('stays')}
        >Stays</button>
        <button className="mp-chip mp-chip--action" onClick={locateMe}>Locate me</button>
        {info.phase === 'during' && (
          <button className="mp-chip mp-chip--action" onClick={fitTodayNow}>Fit today</button>
        )}
      </div>

      <div className="mappage__strip">
        <button
          className={'mp-day' + (selectedDay === ALL ? ' mp-day--on' : '')}
          onClick={() => setSelectedDay(ALL)}
        >
          <span className="mp-day__date">All</span>
          <span className="mp-day__city">days</span>
        </button>
        {days.map((d) => (
          <button
            key={d.dateId}
            className={'mp-day' + (selectedDay === d.dateId ? ' mp-day--on' : '')}
            onClick={() => setSelectedDay(d.dateId)}
          >
            <span className="mp-day__date">{fmtShort(d.dateId)}</span>
            <span className="mp-day__city">{d.city}</span>
          </button>
        ))}
      </div>

      {meError && <div className="mappage__err metaline">{meError}</div>}

      <div className="mappage__map">
        <TripMap markers={markers} polyline={polyline} fitKey={fitKey} onFit={onFit} />

        {card && (
          <div className="mp-card" role="dialog">
            <button className="mp-card__close" aria-label="Close" onClick={() => setCard(null)}>×</button>
            <div className="mp-card__title">{card.title}</div>
            {card.sub && <div className="mp-card__sub">{card.sub}</div>}
            {card.link && (
              <button
                className="mp-card__link"
                onClick={() => navigate(card.link)}
              >{card.linkLabel || 'View details'} →</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
