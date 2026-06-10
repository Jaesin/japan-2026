/* primitives.jsx — motifs reused from the poster + functional icons + avatar.
   ESM port of artifacts/portal_handoff/components/ui/primitives.jsx
   (window globals → named exports; no logic changes besides the added
   `settings` icon, which the always-on Settings nav item needs). */

/* ---- Poster motifs (ported from public-pages motifs.jsx) ------------------ */
function Sun({ size = 24, color = 'var(--accent)', ring = null, style = {} }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color,
    boxShadow: ring ? `0 0 0 ${Math.max(2, Math.round(size*0.08))}px ${ring}` : 'none',
    flexShrink: 0, ...style }} />;
}
function SunBurst({ size = 200, disc = 120, color = 'var(--accent)', rays = 24, style = {} }) {
  const seg = 360 / (rays * 2);
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        background: `repeating-conic-gradient(${color} 0deg ${seg}deg, transparent ${seg}deg ${seg*2}deg)` }} />
      <div style={{ position: 'absolute', borderRadius: '50%', background: color,
        width: disc, height: disc, left: (size-disc)/2, top: (size-disc)/2 }} />
    </div>
  );
}
function Fuji({ width = 200, color = 'currentColor', snow, style = {} }) {
  const h = width * 0.42;
  return (
    <svg width={width} height={h} viewBox="0 0 260 110" style={{ display: 'block', ...style }} aria-hidden="true">
      <polygon points="130,8 232,110 28,110" fill={color} />
      <polygon points="130,8 168,46 150,40 138,52 124,42 110,52 96,46" fill={snow || 'var(--bg)'} />
    </svg>
  );
}

/* ---- Functional icons (minimal geometric strokes) ------------------------- */
function Ico({ d, fill, size = 22, sw = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}
const ICONS = {
  today: (p) => <Ico {...p} d={<><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>
    <g stroke="currentColor"><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/>
    <line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/>
    <line x1="5.3" y1="5.3" x2="7" y2="7"/><line x1="17" y1="17" x2="18.7" y2="18.7"/>
    <line x1="18.7" y1="5.3" x2="17" y2="7"/><line x1="7" y1="17" x2="5.3" y2="18.7"/></g></>} />,
  itinerary: (p) => <Ico {...p} d={<><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/>
    <path d="M6 8.2 V13 a3 3 0 0 0 3 3 H15.8" strokeDasharray="2.4 2.4"/></>} />,
  tasks: (p) => <Ico {...p} d={<><rect x="4" y="4" width="16" height="16" rx="1.5"/>
    <path d="M8 12.5 l2.5 2.5 L16 9"/></>} />,
  budget: (p) => <Ico {...p} d={<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5 v9 M9.3 10 h5.4 M9.3 13 h5.4"/></>} />,
  more: (p) => <Ico {...p} d={<><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>} />,
  packing: (p) => <Ico {...p} d={<><rect x="5" y="8" width="14" height="12" rx="1.5"/><path d="M9 8 V6 a3 3 0 0 1 6 0 V8"/></>} />,
  food: (p) => <Ico {...p} d={<><path d="M6 3 v7 a2 2 0 0 0 4 0 V3 M8 10 V21 M17 3 c-2 1-2 6 0 7 V21"/></>} />,
  research: (p) => <Ico {...p} d={<><circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="21" y2="21"/></>} />,
  docs: (p) => <Ico {...p} d={<><path d="M7 3 h7 l4 4 v14 H7 Z"/><path d="M14 3 v4 h4 M10 13 h5 M10 16 h5"/></>} />,
  journal: (p) => <Ico {...p} d={<><path d="M5 4 h11 a3 3 0 0 1 3 3 v13 H8 a3 3 0 0 1-3-3 Z"/><path d="M8 20 a3 3 0 0 1 0-6 h11"/></>} />,
  map: (p) => <Ico {...p} d={<><path d="M9 4 L4 6 v14 l5-2 6 2 5-2 V4 l-5 2-6-2 Z"/><path d="M9 4 v14 M15 6 v14"/></>} />,
  plus: (p) => <Ico {...p} d={<><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></>} />,
  pin: (p) => <Ico {...p} d={<><path d="M12 21 c5-6 7-9 7-12 a7 7 0 0 0-14 0 c0 3 2 6 7 12 Z"/><circle cx="12" cy="9" r="2.4"/></>} />,
  bed: (p) => <Ico {...p} d={<><path d="M3 8 v11 M3 12 h18 v7 M21 12 V10 a2 2 0 0 0-2-2 H9 v4"/></>} />,
  /* added for the app shell: Settings (slider stack, same geometric voice) */
  settings: (p) => <Ico {...p} d={<><line x1="4" y1="6.5" x2="20" y2="6.5"/>
    <line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17.5" x2="20" y2="17.5"/>
    <circle cx="9" cy="6.5" r="2.3" fill="currentColor" stroke="none"/>
    <circle cx="15.5" cy="12" r="2.3" fill="currentColor" stroke="none"/>
    <circle cx="7" cy="17.5" r="2.3" fill="currentColor" stroke="none"/></>} />,
};
function TabIco({ name, size = 22 }) { const F = ICONS[name]; return F ? F({ size }) : null; }

/* ---- Avatar --------------------------------------------------------------- */
function Avatar({ member, size = 'md', mode = 'initial' }) {
  if (!member) return null;
  const cls = 'avatar' + (size === 'lg' ? ' avatar--lg' : size === 'sm' ? ' avatar--sm' : '') + (member.bot ? ' avatar--bot' : '');
  const content = member.bot ? '🤖' : mode === 'emoji' ? member.emoji : member.initial;
  return <span className={cls} style={member.bot ? {} : { background: member.color }} title={member.name}>{content}</span>;
}
function AvatarStack({ members, size = 'sm' }) {
  return <span className="avatar-stack">{members.map(m => <Avatar key={m.id} member={m} size={size} />)}</span>;
}

export { Sun, SunBurst, Fuji, TabIco, ICONS, Avatar, AvatarStack };
