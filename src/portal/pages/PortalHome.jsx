// PortalHome — minimal /portal landing (spec 02 dashboard placeholder until
// spec 20): a card per enabled feature, EmptyState when nothing's switched
// on yet. The today-strip lives in the shell above this.

import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../ui/ui.jsx';
import { TabIco } from '../ui/primitives.jsx';
import { isEnabled } from '../../data/useFeatures.js';
import TodayDashboard from './TodayDashboard.jsx';

export default function PortalHome({ enabled = [], features = {}, loading = false }) {
  const navigate = useNavigate();

  // Spec 20: when the (hidden) `today` flag is on, the home page becomes the
  // rich Today Dashboard. Otherwise keep the original feature-card grid.
  if (isEnabled(features, 'today')) {
    return <TodayDashboard enabled={enabled} />;
  }

  return (
    <div style={{ padding: 'var(--gutter)' }}>
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Family headquarters</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 0', fontWeight: 400 }}>
        THE PORTAL
      </h1>
      {enabled.length > 0 ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {enabled.map((f) => (
            <button
              key={f.id}
              className="card"
              onClick={() => navigate(f.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left' }}
            >
              <span className="tab__ico" style={{ color: 'var(--accent)' }}>
                <TabIco name={f.ico} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="card__title">{f.label}</span>
                <div className="metaline" style={{ marginTop: 2 }}>{f.blurb}</div>
              </span>
              <span className="row__chev" />
            </button>
          ))}
        </div>
      ) : loading ? (
        <div className="metaline" style={{ marginTop: 24 }}>Checking what's open…</div>
      ) : (
        <EmptyState
          line="Nothing's switched on yet — features light up here as they're ready. Watch this space."
          action="Open Settings"
          onAction={() => navigate('/portal/settings')}
        />
      )}
    </div>
  );
}
