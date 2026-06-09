// motifs.jsx — pure presentational poster shapes (no state, no deps).

// Hinomaru sun disc.
export function Sun({ size = 120, color = '#C5302B', ring = null, style = {} }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      boxShadow: ring ? `0 0 0 ${Math.round(size * 0.04)}px ${ring}` : 'none',
      flexShrink: 0, ...style,
    }} />
  );
}

// Rising-sun burst: a disc with radiating rays (CSS conic-gradient).
// Render it LARGER than its container and clip the container with
// overflow:hidden so the rays bleed off the edges (see PosterLight hero).
export function SunBurst({ size = 360, disc = 230, color = '#C5302B', rayColor = null, rays = 24, style = {} }) {
  const seg = 360 / (rays * 2);
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `repeating-conic-gradient(${rayColor || color} 0deg ${seg}deg, transparent ${seg}deg ${seg * 2}deg)`,
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%', background: color,
        width: disc, height: disc, left: (size - disc) / 2, top: (size - disc) / 2,
      }} />
    </div>
  );
}

// Flat geometric Mt. Fuji (snow-capped). width drives height (~0.42 ratio).
export function Fuji({ width = 260, color = '#1F1B16', snow = '#F4ECD8', style = {} }) {
  const h = width * 0.42;
  return (
    <svg width={width} height={h} viewBox="0 0 260 110" style={{ display: 'block', ...style }} aria-hidden="true">
      <polygon points="130,8 232,110 28,110" fill={color} />
      <polygon points="130,8 168,46 150,40 138,52 124,42 110,52 96,46" fill={snow} />
    </svg>
  );
}
