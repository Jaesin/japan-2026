/* nav.jsx — bottom tab bar (mobile) + left sidebar (desktop ≥768).
   ESM port of artifacts/portal_handoff/components/ui/nav.jsx. Markup is
   unchanged; the one adaptation is that the item lists come in as props
   instead of the prototype's hardcoded TABS/MORE_ITEMS — the shell builds
   them live from feature flags (spec 03: nav renders only enabled features,
   plus Settings always). Items: { id, label, ico }. */

import { TabIco } from './primitives.jsx';

function TabBar({ tabs = [], active, onNav }) {
  return (
    <nav className="tabbar">
      {tabs.map(t => (
        <button key={t.id} className={'tab' + (active === t.id ? ' tab--active' : '')} onClick={() => onNav(t.id)}>
          <span className="tab__ico"><TabIco name={t.ico} /></span>
          <span className="tab__lab">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Sidebar({ items = [], active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="disp">JAPAN</div>
        <div className="eyebrow" style={{ color: 'var(--text-muted)' }}>The Mulenex Family · 2026</div>
      </div>
      <nav style={{ paddingTop: 8 }}>
        {items.map(t => (
          <button key={t.id} className={'navitem' + (active === t.id ? ' navitem--active' : '')} onClick={() => onNav(t.id)}>
            <span className="tab__ico"><TabIco name={t.ico} size={20} /></span>{t.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export { TabBar, Sidebar };
