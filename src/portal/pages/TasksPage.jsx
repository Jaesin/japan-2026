// TasksPage — stub (spec 10 builds the real task board here; route + flag
// gating are already wired in PortalShell).

import { EmptyState } from '../ui/ui.jsx';

export default function TasksPage() {
  return (
    <div style={{ padding: 'var(--gutter)' }}>
      <div className="eyebrow" style={{ color: 'var(--accent)' }}>Before we fly</div>
      <h1 className="disp" style={{ fontSize: 40, lineHeight: 0.9, margin: '6px 0 0', fontWeight: 400 }}>TASKS</h1>
      <div className="card" style={{ marginTop: 18 }}>
        <EmptyState line="The task board is still being laid out — the crew is on it. Check back soon." />
      </div>
    </div>
  );
}
