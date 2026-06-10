// PortalShell — the portal frame (spec 02), adapted from
// artifacts/portal_handoff/PortalShell.jsx: TodayStrip header (live
// getTodayInfo), TabBar (mobile) / Sidebar (≥768px, via CSS), member gate,
// and the /portal/* routes. Nav shows ONLY features flagged true in
// config/features (spec 03), plus Home and Settings (always).

import { useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TRIP_DAYS, getTodayInfo } from '../tripData.js';
import { useMember } from '../auth/useMember.js';
import { isEnabled, useFeatures } from '../data/useFeatures.js';
import { FEATURES, HOME_ITEM, MORE_TAB, SETTINGS_ITEM } from './features.js';
import { Sidebar, TabBar } from './ui/nav.jsx';
import { Button, TodayStrip } from './ui/ui.jsx';
import { ActionSheet } from './ui/overlays.jsx';
import { SunBurst, TabIco } from './ui/primitives.jsx';
import PortalHome from './pages/PortalHome.jsx';
import TasksPage from './pages/TasksPage.jsx';
import PackingPage from './pages/PackingPage.jsx';
import PhrasebookPage from './pages/PhrasebookPage.jsx';
import TransportPage from './pages/TransportPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import './styles/tokens.css';
import './styles/components.css';

const MAX_TABS = 5; // bottom bar slots; beyond that the tail goes to a More sheet

function CenteredCard({ children }) {
  return (
    <div className="portal" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 360, width: '100%', textAlign: 'center', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

/* Non-members hitting /portal/* — friendly, never a broken state (spec 02). */
function NeedsLinkPage() {
  const navigate = useNavigate();
  return (
    <CenteredCard>
      <SunBurst size={84} disc={42} rays={20} color="var(--accent)" style={{ opacity: 0.9 }} />
      <div className="disp" style={{ fontSize: 30, lineHeight: 0.95 }}>FAMILY ONLY<br />BEYOND THIS POINT</div>
      <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 280 }}>
        This area opens with a family link. If you're meant to be aboard,
        ask Jaesin for yours — then tap it and you're in.
      </p>
      <Button variant="secondary" onClick={() => navigate('/')} style={{ marginTop: 6 }}>
        Back to the poster
      </Button>
    </CenteredCard>
  );
}

function ShellLoading() {
  return (
    <CenteredCard>
      <SunBurst size={64} disc={32} rays={20} color="var(--accent)" style={{ opacity: 0.5 }} />
      <div className="metaline">Checking your boarding pass…</div>
    </CenteredCard>
  );
}

/* Disabled/unknown feature URL — friendly card, covers stale bookmarks (spec 03). */
function FeatureClosedPage({ loading = false }) {
  const navigate = useNavigate();
  if (loading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what's open…</div>;
  }
  return (
    <div style={{ padding: 'var(--gutter)' }}>
      <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
        <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
          This section isn't switched on yet. It'll appear in the menu the
          moment it is.
        </p>
        <Button variant="secondary" onClick={() => navigate('/portal')}>Back home</Button>
      </div>
    </div>
  );
}

export default function PortalShell() {
  const { status, loading: memberLoading } = useMember();
  const { features, loading: featuresLoading } = useFeatures();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (memberLoading) return <ShellLoading />;
  if (status !== 'member') return <NeedsLinkPage />;

  // Nav: Home + enabled features (key present AND true) + Settings (always).
  const enabled = FEATURES.filter((f) => isEnabled(features, f.id));
  const items = [HOME_ITEM, ...enabled, SETTINGS_ITEM];

  const overflow = items.length > MAX_TABS;
  const tabs = overflow ? [...items.slice(0, MAX_TABS - 1), MORE_TAB] : items;
  const moreItems = overflow ? items.slice(MAX_TABS - 1) : [];

  const activeId = (items.find((i) => i.path !== '/portal' && pathname.startsWith(i.path)) || HOME_ITEM).id;
  const activeTab = moreItems.some((i) => i.id === activeId) ? 'more' : activeId;

  const onNav = (id) => {
    if (id === 'more') return setMoreOpen(true);
    const item = items.find((i) => i.id === id);
    if (item) navigate(item.path);
  };

  // Today strip: the poster's live-date band, slimmed (spec 02 §7).
  const info = getTodayInfo();
  const strip =
    info.phase === 'before' ? { phase: 'before', daysToGo: info.daysToGo }
    : info.phase === 'during' ? { phase: 'during', dayNum: info.dayNum, city: info.stop.city }
    : { phase: 'during', dayNum: TRIP_DAYS, city: 'Trip complete' };

  return (
    <div className="portal shell">
      <Sidebar items={items} active={activeId} onNav={onNav} />
      <div className="shell__col">
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <TodayStrip {...strip} />
        </div>
        <div className="shell__scroll">
          <Routes>
            <Route index element={<PortalHome enabled={enabled} loading={featuresLoading} />} />
            <Route
              path="tasks"
              element={isEnabled(features, 'tasks') ? <TasksPage /> : <FeatureClosedPage loading={featuresLoading} />}
            />
            <Route
              path="packing"
              element={isEnabled(features, 'packing') ? <PackingPage /> : <FeatureClosedPage loading={featuresLoading} />}
            />
            <Route
              path="phrases"
              element={isEnabled(features, 'phrases') ? <PhrasebookPage /> : <FeatureClosedPage loading={featuresLoading} />}
            />
            <Route
              path="transport"
              element={isEnabled(features, 'transport') ? <TransportPage /> : <FeatureClosedPage loading={featuresLoading} />}
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<FeatureClosedPage loading={featuresLoading} />} />
          </Routes>
        </div>
        <TabBar tabs={tabs} active={activeTab} onNav={onNav} />
      </div>
      {moreOpen && (
        <ActionSheet
          title="More"
          items={moreItems.map((m) => ({
            label: m.label,
            ico: <TabIco name={m.ico} size={20} />,
            onClick: () => navigate(m.path),
          }))}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </div>
  );
}
