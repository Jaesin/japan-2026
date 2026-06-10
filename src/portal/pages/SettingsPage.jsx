// SettingsPage — stub (specs 03/04 build the real page here: feature-flag
// toggles, member list + revoke, device invite links. Always reachable for
// members — never behind a flag).

import { EmptyState } from '../ui/ui.jsx';

export default function SettingsPage() {
  return (
    <div style={{ padding: 'var(--gutter)' }}>
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Control room</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 0', fontWeight: 400 }}>SETTINGS</h1>
      <div className="card" style={{ marginTop: 18 }}>
        <EmptyState line="Switches, members, and family links land here shortly — under construction." />
      </div>
    </div>
  );
}
