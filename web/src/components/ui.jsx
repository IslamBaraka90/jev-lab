import { useEffect, useId, useRef, useState } from 'react';
import { formatMoney, formatPercent } from '../lib/format.js';
import { ACTIONS, RUN_STATUS } from '../lib/labels.js';
import { Icon } from './Icon.jsx';

export function StatusPill({ status }) {
  const { label, tone } = RUN_STATUS[status] ?? { label: status, tone: 'muted' };
  return (
    <span className={`status-pill ${tone}`}>
      {tone === 'live' && <span className="pulse" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function ActionBadge({ action, large = false }) {
  if (!action) return <span className="action-badge failed">Failed</span>;
  const { label, tone } = ACTIONS[action] ?? { label: action, tone: 'flat' };
  return (
    <span className={`action-badge ${tone}${large ? ' large' : ''}`}>
      <span className="key" aria-hidden="true" />
      {label}
    </span>
  );
}

/** A signed return or amount: the + or - sign carries direction, and the color reinforces it. */
export function Signed({ value, kind = 'percent', currency, digits }) {
  if (value === null || value === undefined) return <span className="signed">–</span>;
  const tone = value > 0 ? 'gain' : value < 0 ? 'loss' : '';
  const text = kind === 'money' ? formatMoney(value, currency, { digits }) : formatPercent(value, { digits });
  return <span className={`signed ${tone}`}>{text}</span>;
}

export function Kpi({ label, value, context, tone, icon }) {
  return (
    <div className="kpi">
      <span className="kpi-label">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </span>
      <span className={`kpi-value ${tone ?? ''}`}>{value}</span>
      {context && <span className="kpi-context">{context}</span>}
    </div>
  );
}

export function Meter({ value, tone = 'accent', label }) {
  const share = Math.max(0, Math.min(1, value ?? 0));
  return (
    <span className="meter" role="img" aria-label={label}>
      <span className={`meter-fill ${tone}`} style={{ width: `${share * 100}%` }} />
    </span>
  );
}

export function ProgressBar({ value, max, label }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span className="progress-fill" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

export function Segmented({ label, options, value, onChange, size }) {
  const refs = useRef([]);
  const move = (event, index) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={`segmented${size ? ` ${size}` : ''}`} role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => (refs.current[index] = node)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className="segment"
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => move(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, hint, checked, onChange, disabled }) {
  const id = useId();
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-text">
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
    </label>
  );
}

/** A native modal dialog: focus is contained, Escape closes it and focus returns to the opener. */
export function Dialog({ open, onClose, title, eyebrow, children, actions, className = '' }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          <div className="dialog-top">
            <div className="stack" style={{ gap: 4 }}>
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              <h2 id={titleId}>{title}</h2>
            </div>
            <button type="button" className="button ghost icon" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          {children}
          {actions && <div className="dialog-actions">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function LegendItem({ tone, shape = 'dot', children }) {
  return (
    <span className="legend-item">
      <span className={`legend-key ${shape} ${tone}`} aria-hidden="true" />
      {children}
    </span>
  );
}

/** A chart with its title, the question it answers, a legend, and a table alternative. */
export function ChartFrame({ title, question, legend, table, children, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={`chart-frame panel ${className}`}>
      <div className="chart-head">
        <div className="chart-titles">
          <h3>{title}</h3>
          {question && <p className="meta">{question}</p>}
        </div>
        {table && (
          <button type="button" className="button ghost" aria-pressed={showTable} onClick={() => setShowTable((value) => !value)}>
            <Icon name={showTable ? 'chart' : 'table'} />
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {legend && !showTable && <div className="chart-legend">{legend}</div>}
      {showTable ? <div className="table-scroll">{table}</div> : children}
    </figure>
  );
}

export function ErrorCallout({ title, children }) {
  return (
    <div className="callout error" role="alert">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
