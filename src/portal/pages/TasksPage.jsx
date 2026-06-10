// TasksPage — the task board (spec 10). Live Firestore tasks/{id}, grouped by
// status (doing → open → done-collapsed), priority/dueDate sort, overdue
// badges, assignee + category filter chips (persisted to localStorage),
// one-tap status cycling, add via floating "+" → bottom sheet, tap row →
// detail sheet with edit-all-fields + delete (confirm).
// Visual language adapted from artifacts/portal_handoff/screens/TaskBoard.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../data/useCollection.js';
import { addItem, removeItem, updateItem } from '../../data/mutate.js';
import { isEnabled, useFeatures } from '../../data/useFeatures.js';
import {
  Button, EmptyState, Field, FilterChip, Input, Select, Textarea,
} from '../ui/ui.jsx';
import { BottomSheet, ConfirmDialog } from '../ui/overlays.jsx';
import './tasks.css';

/* Spec-10 category list (differs from the handoff's CAT_ICON keys, so the
   icon map lives here rather than in format.js). */
const CATEGORIES = ['flights', 'stay', 'transport', 'activities', 'documents', 'packing', 'budget', 'other'];
const CAT_ICO = {
  flights: '✈️', stay: '🛏', transport: '🚄', activities: '⛩',
  documents: '📄', packing: '🎒', budget: '💴', other: '📦',
};

const STATUSES = ['open', 'doing', 'done'];
const STATUS_LABELS = { open: 'Open', doing: 'Doing', done: 'Done' };
const NEXT_STATUS = { open: 'doing', doing: 'done', done: 'open' };
const PRIORITIES = ['high', 'normal', 'low'];
const PRI_ORDER = { high: 0, normal: 1, low: 2 };
const GROUPS = [
  { key: 'doing', label: 'In progress' },
  { key: 'open', label: 'To do' },
  { key: 'done', label: 'Done' },
];

const FILTER_KEY = 'japan2026.tasks.filters';

/* ---- dates (no libraries — dueDate is a YYYY-MM-DD string) ---------------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDue(due) {
  const [, m, d] = due.split('-').map(Number);
  return m >= 1 && m <= 12 && d ? `${MONTHS[m - 1]} ${d}` : due;
}
function isOverdue(task, today) {
  return Boolean(task.dueDate) && task.dueDate < today && task.status !== 'done';
}

/* priority (high → low), then dueDate ascending with nulls last, then title */
function compareTasks(a, b) {
  const p = (PRI_ORDER[a.priority] ?? 1) - (PRI_ORDER[b.priority] ?? 1);
  if (p !== 0) return p;
  const ad = a.dueDate || '￿';
  const bd = b.dueDate || '￿';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

function readFilters() {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_KEY));
    return { who: raw?.who || 'all', cat: raw?.cat || 'all' };
  } catch {
    return { who: 'all', cat: 'all' };
  }
}

/* ---- row ------------------------------------------------------------------ */
function TaskRow({ task, overdue, onOpen, onCycle }) {
  const done = task.status === 'done';
  const meta = [
    `${CAT_ICO[task.category] || '•'} ${task.category || 'other'}`,
    task.dueDate ? `Due ${formatDue(task.dueDate)}` : null,
    task.assignee && task.assignee !== 'anyone' ? task.assignee : null,
    task.priority === 'high' ? 'high priority' : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="row tasks__row">
      <button
        className="tasks__cycle"
        onClick={onCycle}
        aria-label={`Status: ${STATUS_LABELS[task.status] || task.status}. Tap to change.`}
      >
        <span className={`tcheck tcheck--${task.status}`} />
      </button>
      <button className="row__main tasks__rowmain" onClick={onOpen}>
        <div className={'row__title' + (done ? ' row__title--done' : '')}>{task.title}</div>
        {meta && <div className="row__meta">{meta}</div>}
      </button>
      {overdue && (
        <span className="row__acc">
          <span className="status status--overdue status--no-dot">Overdue</span>
        </span>
      )}
    </div>
  );
}

/* ---- add / edit sheet ------------------------------------------------------ */
function TaskSheet({ sheetTitle, initial, memberNames, submitLabel, isNew, onSubmit, onClose, onDelete }) {
  const [d, setD] = useState(initial);
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));
  const pick = (k, v) => () => setD((p) => ({ ...p, [k]: v }));
  const canSubmit = d.title.trim().length > 0;
  const submit = () => { if (canSubmit) onSubmit(d); };

  // Keep an assignee that's no longer a member selectable rather than blanking.
  const assignees = ['anyone', ...memberNames];
  if (d.assignee && !assignees.includes(d.assignee)) assignees.push(d.assignee);

  return (
    <BottomSheet
      title={sheetTitle}
      onClose={onClose}
      submit={
        <div style={{ display: 'grid', gap: 10 }}>
          <Button variant="primary" block disabled={!canSubmit} onClick={submit}>{submitLabel}</Button>
          {onDelete && <Button variant="destructive" block onClick={onDelete}>Delete task</Button>}
        </div>
      }
    >
      <Field label="Title">
        <Input
          autoFocus
          value={d.title}
          placeholder="What needs doing?"
          onChange={set('title')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
      </Field>
      {!isNew && (
        <div className="field">
          <span className="field__label">Status</span>
          <div className="tasks__chips">
            {STATUSES.map((s) => (
              <FilterChip key={s} selected={d.status === s} onClick={pick('status', s)}>{STATUS_LABELS[s]}</FilterChip>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <span className="field__label">Priority</span>
        <div className="tasks__chips">
          {PRIORITIES.map((p) => (
            <FilterChip key={p} selected={d.priority === p} onClick={pick('priority', p)}>{p}</FilterChip>
          ))}
        </div>
      </div>
      <Field label="Assignee">
        <Select value={d.assignee} onChange={set('assignee')}>
          {assignees.map((n) => <option key={n} value={n}>{n === 'anyone' ? 'Anyone' : n}</option>)}
        </Select>
      </Field>
      <Field label="Category">
        <Select value={d.category} onChange={set('category')}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_ICO[c]} {c}</option>)}
        </Select>
      </Field>
      <Field label="Due date">
        <Input type="date" value={d.dueDate} onChange={set('dueDate')} />
      </Field>
      <Field label="Notes">
        <Textarea value={d.notes} placeholder="Details, links, findings…" onChange={set('notes')} />
      </Field>
    </BottomSheet>
  );
}

/* ---- page ------------------------------------------------------------------ */
export default function TasksPage() {
  const navigate = useNavigate();
  const { features, loading: featuresLoading } = useFeatures();
  const { docs: tasks, loading: tasksLoading, error: tasksError } = useCollection(['tasks']);
  const { docs: members } = useCollection(['members']);

  const [filters, setFilters] = useState(readFilters);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);   // task being viewed/edited
  const [confirming, setConfirming] = useState(null); // task pending delete

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      /* storage unavailable — filters just won't persist */
    }
  }, [filters]);

  const memberNames = useMemo(
    () => [...new Set(members.map((m) => m.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [members],
  );

  /* Feature gate — wait on the flags doc, never render a broken page. */
  if (featuresLoading) {
    return <div className="metaline" style={{ padding: 'var(--gutter)' }}>Checking what&rsquo;s open…</div>;
  }
  if (!isEnabled(features, 'tasks')) {
    return (
      <div style={{ padding: 'var(--gutter)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="disp" style={{ fontSize: 28, lineHeight: 0.95 }}>NOT OPEN YET</div>
          <p className="metaline" style={{ lineHeight: 1.5, maxWidth: 260 }}>
            This section isn&rsquo;t switched on yet. It&rsquo;ll appear in the menu the moment it is.
          </p>
          <Button variant="secondary" onClick={() => navigate('/portal')}>Back home</Button>
        </div>
      </div>
    );
  }

  const today = todayString();
  const { who, cat } = filters;
  const filtered = tasks.filter(
    (t) => (who === 'all' || (t.assignee || 'anyone') === who)
        && (cat === 'all' || (t.category || 'other') === cat),
  );

  const cycle = (t) => {
    updateItem(['tasks', t.id], { status: NEXT_STATUS[t.status] || 'open' }).catch(console.error);
  };

  const addTask = (d) => {
    const data = {
      title: d.title.trim(),
      status: 'open',
      priority: PRIORITIES.includes(d.priority) ? d.priority : 'normal',
      assignee: d.assignee || 'anyone',
      category: d.category || 'other',
    };
    if (d.dueDate) data.dueDate = d.dueDate;
    if (d.notes.trim()) data.notes = d.notes.trim();
    addItem(['tasks'], data).catch(console.error);
    setAdding(false);
  };

  const saveTask = (d) => {
    updateItem(['tasks', editing.id], {
      title: d.title.trim(),
      status: STATUSES.includes(d.status) ? d.status : 'open',
      priority: PRIORITIES.includes(d.priority) ? d.priority : 'normal',
      assignee: d.assignee || 'anyone',
      category: d.category || 'other',
      dueDate: d.dueDate,
      notes: d.notes.trim(),
    }).catch(console.error);
    setEditing(null);
  };

  const deleteTask = (t) => {
    removeItem(['tasks', t.id]).catch(console.error);
    setConfirming(null);
    setEditing(null);
  };

  return (
    <div className="tasks">
      <div className="tasks__head">
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>Before we fly</div>
        <h1 className="disp tasks__title">TASKS</h1>
      </div>

      {/* assignee filter */}
      <div className="tasks__filters">
        <FilterChip sm selected={who === 'all'} onClick={() => setFilters((f) => ({ ...f, who: 'all' }))}>Everyone</FilterChip>
        {memberNames.map((n) => (
          <FilterChip key={n} sm selected={who === n} onClick={() => setFilters((f) => ({ ...f, who: n }))}>{n}</FilterChip>
        ))}
        <FilterChip sm selected={who === 'anyone'} onClick={() => setFilters((f) => ({ ...f, who: 'anyone' }))}>Anyone</FilterChip>
      </div>

      {/* category filter */}
      <div className="tasks__filters tasks__filters--last">
        <FilterChip sm selected={cat === 'all'} onClick={() => setFilters((f) => ({ ...f, cat: 'all' }))}>All types</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} sm selected={cat === c} onClick={() => setFilters((f) => ({ ...f, cat: c }))}>
            {CAT_ICO[c]} {c}
          </FilterChip>
        ))}
      </div>

      {tasksError && (
        <div className="metaline" style={{ padding: '14px var(--gutter)', color: 'var(--danger)' }}>
          Couldn&rsquo;t load tasks — check your connection and try again.
        </div>
      )}
      {tasksLoading && !tasksError && (
        <div className="metaline" style={{ padding: '14px var(--gutter)' }}>Loading tasks…</div>
      )}

      {!tasksLoading && !tasksError && filtered.length === 0 && (
        tasks.length === 0 ? (
          <EmptyState
            line="Nothing on the board yet. Add the first task and the planning begins."
            action="Add a task"
            onAction={() => setAdding(true)}
          />
        ) : (
          <EmptyState
            line="No tasks match this filter. Clear it, or add the first one for this list."
            action="Clear filters"
            onAction={() => setFilters({ who: 'all', cat: 'all' })}
          />
        )
      )}

      {!tasksLoading && !tasksError && filtered.length > 0 && GROUPS.map((g) => {
        const items = filtered.filter((t) => t.status === g.key).sort(compareTasks);
        if (!items.length) return null;
        const collapsible = g.key === 'done';
        const collapsed = collapsible && !showDone;
        const Head = collapsible ? 'button' : 'div';
        return (
          <div key={g.key}>
            <Head
              className="tasks__grouphead"
              onClick={collapsible ? () => setShowDone((v) => !v) : undefined}
              aria-expanded={collapsible ? !collapsed : undefined}
            >
              <span className="eyebrow">{g.label}</span>
              <span className="metaline">{items.length}</span>
              {collapsible && <span className={'tasks__chev' + (collapsed ? ' tasks__chev--closed' : '')} />}
            </Head>
            {!collapsed && items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                overdue={isOverdue(t, today)}
                onOpen={() => setEditing(t)}
                onCycle={() => cycle(t)}
              />
            ))}
          </div>
        );
      })}

      <button className="tasks__fab" aria-label="Add task" onClick={() => setAdding(true)}>+</button>

      {adding && (
        <TaskSheet
          sheetTitle="New task"
          isNew
          submitLabel="Add task"
          memberNames={memberNames}
          initial={{ title: '', status: 'open', priority: 'normal', assignee: 'anyone', category: 'other', dueDate: '', notes: '' }}
          onSubmit={addTask}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <TaskSheet
          key={editing.id}
          sheetTitle="Task"
          submitLabel="Save changes"
          memberNames={memberNames}
          initial={{
            title: editing.title || '',
            status: STATUSES.includes(editing.status) ? editing.status : 'open',
            priority: PRIORITIES.includes(editing.priority) ? editing.priority : 'normal',
            assignee: editing.assignee || 'anyone',
            category: editing.category || 'other',
            dueDate: editing.dueDate || '',
            notes: editing.notes || '',
          }}
          onSubmit={saveTask}
          onClose={() => setEditing(null)}
          onDelete={() => setConfirming(editing)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Delete this task?"
          body="This removes the task for everyone. This can't be undone."
          onCancel={() => setConfirming(null)}
          onConfirm={() => deleteTask(confirming)}
        />
      )}
    </div>
  );
}
