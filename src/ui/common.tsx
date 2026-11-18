import { useEffect, type ReactNode } from 'react';
import { fmtDate } from '../data/logic';
import type { Obligation, Vehicle } from '../data/types';
import { branchById, useFleet } from '../state/store';
import { Icon } from './icons';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
  size,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  size?: 'sm';
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${size === 'sm' ? 'modal-sm' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Bezárás" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Plate({ v }: { v: Pick<Vehicle, 'plate'> }) {
  return (
    <span className="plate plate-sm">
      <span className="plate-hu">H</span>
      {v.plate}
    </span>
  );
}

export function VehicleCell({ id }: { id: string }) {
  const v = useFleet((s) => s.vehicles.find((x) => x.id === id));
  if (!v) return <span className="muted">–</span>;
  return (
    <span className="vehicle-cell">
      <Plate v={v} />
      <small>
        {v.make} {v.model}
      </small>
    </span>
  );
}

export function VehicleSelect({
  value,
  onChange,
  filter,
  placeholder = 'Válassz járművet…',
}: {
  value: string;
  onChange: (id: string) => void;
  filter?: (v: Vehicle) => boolean;
  placeholder?: string;
}) {
  const vehicles = useFleet((s) => s.vehicles);
  const list = vehicles.filter((v) => !filter || filter(v)).sort((a, b) => a.plate.localeCompare(b.plate));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((v) => (
        <option key={v.id} value={v.id}>
          {v.plate} – {v.make} {v.model} ({branchById(v.branchId).city}
          {v.assignedTo ? `, kiadva: ${v.assignedTo}` : ''})
        </option>
      ))}
    </select>
  );
}

export function SeverityChip({ o }: { o: Pick<Obligation, 'severity' | 'daysLeft' | 'kmLeft'> }) {
  const text =
    o.severity === 'overdue'
      ? o.daysLeft < 0
        ? `Lejárt ${-o.daysLeft} napja`
        : `Túlfutott ${Math.abs(o.kmLeft ?? 0).toLocaleString('hu-HU')} km`
      : o.kmLeft !== undefined && o.kmLeft <= 3000 && o.kmLeft < o.daysLeft * 50
        ? `${o.kmLeft.toLocaleString('hu-HU')} km múlva`
        : o.daysLeft === 0
          ? 'Ma jár le'
          : `${o.daysLeft} nap`;
  return <span className={`chip sev-${o.severity}`}>{text}</span>;
}

export function DueCell({ o }: { o: Obligation }) {
  return (
    <span className="due-cell">
      {fmtDate(o.due)}
      {o.type === 'service' && <small className="muted"> / {o.kmLeft! >= 0 ? `még ${o.kmLeft!.toLocaleString('hu-HU')} km` : 'km-túllépés'}</small>}
    </span>
  );
}

export function Issues({ items }: { items: { level: 'error' | 'warn'; text: string }[] }) {
  if (!items.length) return <span className="chip chip-active">Rendben</span>;
  return (
    <ul className="issues">
      {items.map((i, k) => (
        <li key={k} className={`issue issue-${i.level}`}>
          {i.level === 'error' ? '✕' : '!'} {i.text}
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Kpi({ label, value, tone, onClick }: { label: string; value: ReactNode; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi-tile ${tone ? `tone-${tone}` : ''}`} onClick={onClick}>
      <strong>{value}</strong>
      <span>{label}</span>
    </Tag>
  );
}
