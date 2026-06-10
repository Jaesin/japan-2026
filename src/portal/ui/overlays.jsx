/* overlays.jsx — bottom sheet, action sheet, confirm dialog.
   ESM port of artifacts/portal_handoff/components/ui/overlays.jsx
   (window globals → named exports; no logic changes). */

import { Button } from './ui.jsx';

function BottomSheet({ title, onClose, children, submit }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__grip" />
        <div className="sheet__bar">
          <span className="sheet__title">{title}</span>
          <button className="sheet__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sheet__scroll">{children}</div>
        {submit && <div className="sheet__submit">{submit}</div>}
      </div>
    </div>
  );
}

function ActionSheet({ title, items, onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__grip" />
        {title && <div className="sheet__bar"><span className="sheet__title">{title}</span>
          <button className="sheet__close" onClick={onClose} aria-label="Close">×</button></div>}
        <div className="actionsheet">
          {items.map((it, i) => (
            <button key={i} className="row" onClick={() => { onClose(); it.onClick && it.onClick(); }}>
              <span className="row__acc" style={{ color: it.danger ? 'var(--danger)' : 'var(--text-muted)' }}>
                {it.ico}</span>
              <span className="row__main"><span className="row__title"
                style={it.danger ? { color: 'var(--danger)' } : null}>{it.label}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel = 'Delete', cancelLabel = 'Cancel', destructive = true, onConfirm, onCancel }) {
  return (
    <div className="dialog-scrim" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog__title">{title}</div>
        {body && <div className="dialog__body">{body}</div>}
        <div className="dialog__actions">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export { BottomSheet, ActionSheet, ConfirmDialog };
