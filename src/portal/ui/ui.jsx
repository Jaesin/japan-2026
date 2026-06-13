/* ui.jsx — the component kit atoms. Classes from ../styles/components.css.
   All read CSS vars, so both directions come free.
   ESM port of artifacts/portal_handoff/components/ui/ui.jsx (window globals →
   named exports; window.PORTAL.{CAT_ICON,yen} → imports from ../format.js). */

import { lazy, Suspense } from 'react';
import { SunBurst } from './primitives.jsx';
import { CAT_ICON, yen } from '../format.js';

/* ============================== MARKDOWN ==================================== */
/* The markdown renderer is heavy (react-markdown + remark stack). Keep it in a
   lazily-loaded chunk so it only downloads when a note that actually contains
   markdown is rendered. While the chunk loads, show the raw text (pre-wrap) so
   content is never blank. */
const LazyMarkdownNote = lazy(() => import('./MarkdownNote.jsx'));

/* Cheap heuristic: does this string contain markdown worth parsing? Headings,
   emphasis, lists, links, code, blockquotes, tables, rules. If not, we render
   plain text and never load the markdown chunk at all. */
const MD_PATTERN = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|)|\*\*|__|\[[^\]]+\]\([^)]+\)|`[^`]+`|~~|(^|\n)([-*_])\s*\3\s*\3/;
function looksLikeMarkdown(text) {
  return typeof text === 'string' && MD_PATTERN.test(text);
}

/* MarkdownText — auto-detecting note renderer. Plain strings stay plain text
   (zero extra JS); anything with markdown syntax renders via the lazy chunk.
   `className` styles the plain-text fallback container. */
function MarkdownText({ children, className }) {
  const text = children || '';
  if (!looksLikeMarkdown(text)) {
    return <div className={className} style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
  }
  return (
    <Suspense fallback={<div className={className} style={{ whiteSpace: 'pre-wrap' }}>{text}</div>}>
      <LazyMarkdownNote source={text} />
    </Suspense>
  );
}

/* ============================== BUTTONS ===================================== */
function Button({ variant = 'secondary', size, block, disabled, children, onClick, style }) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block'].filter(Boolean).join(' ');
  return <button className={cls} disabled={disabled} onClick={onClick} style={style}>{children}</button>;
}
function QuickAction({ ico, label, onClick }) {
  return (
    <button className="qbtn" onClick={onClick}>
      <span className="qbtn__ico">{ico}</span>
      <span className="qbtn__lab">{label}</span>
    </button>
  );
}

/* ============================== INPUTS ====================================== */
function Field({ label, error, hint, children }) {
  return (
    <label className={'field' + (error ? ' field--error' : '')}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {error && <span className="field__error">{error}</span>}
      {!error && hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
function Input(props) { return <input className="input" {...props} />; }
function Textarea(props) { return <textarea className="textarea" {...props} />; }
function AmountInput({ suffix = '¥', ...props }) {
  return (
    <span className="amount">
      <input className="input" inputMode="numeric" {...props} />
      <span className="amount__suffix">{suffix}</span>
    </span>
  );
}
function Select({ children, ...props }) {
  return <span className="select-wrap"><select className="select" {...props}>{children}</select></span>;
}

/* ============================== CHIPS ======================================= */
function FilterChip({ selected, children, onClick, sm }) {
  return (
    <button className={'chip' + (sm ? ' chip--sm' : '')} aria-pressed={!!selected} onClick={onClick}>{children}</button>
  );
}
const STATUS_LABEL = { open:'Open', doing:'Doing', done:'Done', idea:'Idea', shortlist:'Shortlist',
  booked:'Booked', rejected:'Rejected', overdue:'Overdue' };
function StatusChip({ status, label }) {
  return <span className={`status status--${status}`}>{label || STATUS_LABEL[status] || status}</span>;
}
function CatChip({ cat }) {
  const ico = CAT_ICON[cat] || '•';
  return <span className="cat"><span className="cat__ico">{ico}</span>{cat}</span>;
}

/* ============================== LIST ROWS =================================== */
function ListRow({ title, meta, done, accessory, chev, onClick, children }) {
  return (
    <button className="row" onClick={onClick}>
      {children}
      <span className="row__main">
        <div className={'row__title' + (done ? ' row__title--done' : '')}>{title}</div>
        {meta && <div className="row__meta">{meta}</div>}
      </span>
      {accessory && <span className="row__acc">{accessory}</span>}
      {chev && <span className="row__chev" />}
    </button>
  );
}
function CheckRow({ title, meta, checked, onToggle, accessory }) {
  return (
    <button className="row" onClick={onToggle} aria-pressed={checked}>
      <span className={'check' + (checked ? ' check--on' : '')} />
      <span className="row__main">
        <div className={'row__title' + (checked ? ' row__title--done' : '')}>{title}</div>
        {meta && <div className="row__meta">{meta}</div>}
      </span>
      {accessory && <span className="row__acc">{accessory}</span>}
    </button>
  );
}
function DragHandle() {
  return <span className="drag"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <g fill="currentColor"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/>
    <circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/>
    <circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></g></svg></span>;
}

/* ============================== CARDS ======================================= */
function Vote({ count, on, onClick }) {
  return (
    <button className={'vote' + (on ? ' vote--on' : '')} onClick={onClick}>
      <span className="vote__sun" /> {count}
    </button>
  );
}
function ResearchCard({ item, voted, onVote }) {
  const ico = CAT_ICON[item.cat] || '•';
  return (
    <div className={'card' + (item.pinned ? ' card--pinned' : '')}>
      {item.pinned && <div className="card__pinflag"><span style={{fontSize:11}}>📌</span> Decided</div>}
      <div className="card__head">
        <div className="card__title">{item.title}</div>
        <StatusChip status={item.status} />
      </div>
      <div className="card__note">{item.note}</div>
      <div className="card__foot">
        <span className="cat"><span className="cat__ico">{ico}</span>{item.cat}</span>
        <Vote count={item.votes} on={voted} onClick={onVote} />
      </div>
    </div>
  );
}

/* ============================== BARS ======================================== */
function ProgressBar({ label, pct, done }) {
  return (
    <div className="progress">
      {label && <div className="progress__head">
        <span className="progress__label">{label}</span>
        <span className="progress__pct">{pct}%</span>
      </div>}
      <div className="progress__track">
        <div className={'progress__fill' + (done || pct >= 100 ? ' progress__fill--done' : '')} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}
function SummaryBar({ estimate, actual }) {
  const over = actual > estimate;
  const max = Math.max(estimate, actual);
  const fillPct = (actual / max) * 100;
  const capPct = (estimate / max) * 100;
  return (
    <div className={'summary' + (over ? ' summary--over' : '')}>
      <div className="summary__head">
        <span className="summary__nums"><b>{yen(actual)}</b> spent</span>
        <span className="summary__nums" style={{ color: 'var(--text-muted)' }}>of {yen(estimate)}</span>
      </div>
      <div className="summary__track">
        <div className="summary__fill" style={{ width: fillPct + '%' }} />
        <div className="summary__cap" style={{ left: capPct + '%' }} />
      </div>
      <div className="summary__legend">
        {over ? `Over estimate by ${yen(actual - estimate)}` : `${yen(estimate - actual)} remaining`}
      </div>
    </div>
  );
}

/* ============================== RATING ===================================== */
function Rating({ value = 0, onChange, sm, readOnly }) {
  return (
    <span className={'rating' + (sm ? ' rating--sm' : '')}>
      {[1,2,3,4,5].map(n => (
        <button key={n} className={'rating__sun' + (n <= value ? ' rating__sun--on' : '')}
          disabled={readOnly} onClick={() => onChange && onChange(n)} aria-label={`${n} suns`} />
      ))}
    </span>
  );
}

/* ============================== EMPTY STATE ================================ */
function EmptyState({ line, action, onAction }) {
  return (
    <div className="empty">
      <span className="empty__motif"><SunBurst size={84} disc={42} rays={20} color="var(--accent)" style={{ opacity: .9 }} /></span>
      <div className="empty__line">{line}</div>
      {action && <Button variant="primary" onClick={onAction}>{action}</Button>}
    </div>
  );
}

/* ============================== TODAY-STRIP ================================ */
function TodayStrip({ phase = 'during', daysToGo = 25, dayNum = 5, city = 'Kyoto' }) {
  return (
    <div className="todaystrip">
      {phase === 'before'
        ? <><span className="todaystrip__num">{daysToGo} DAYS TO GO</span>
            <span className="todaystrip__lab">Now boarding · The Mulenex Family</span></>
        : <><span className="todaystrip__num">DAY {dayNum}</span>
            <span className="todaystrip__lab">· {city} · Today live</span></>}
      <span className="todaystrip__sun" />
    </div>
  );
}

export { Button, QuickAction, Field, Input, Textarea, AmountInput, Select,
  FilterChip, StatusChip, CatChip, STATUS_LABEL, ListRow, CheckRow, DragHandle,
  Vote, ResearchCard, ProgressBar, SummaryBar, Rating, EmptyState, TodayStrip,
  MarkdownText };
