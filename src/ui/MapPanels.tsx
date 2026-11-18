import { useMemo, useState } from 'react';
import { SLOT_COUNT } from '../data/layout';
import { fmtDate, fmtKm, obligationsFor, urgentObligation } from '../data/logic';
import { CATEGORY_LABELS, STATUS_LABELS, TYRE_LABELS, type Movement, type Vehicle } from '../data/types';
import { branchById, freeSlot, useFleet } from '../state/store';
import { Plate, SeverityChip } from './common';

const time = (ms: number) => new Date(ms).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function StatusChip({ v }: { v: Vehicle }) {
  const inTransit = useFleet((s) => !!s.transits[v.id]);
  if (inTransit) return <span className="chip chip-transit">{v.slot < 0 ? 'Indul' : `Úton → ${branchById(v.branchId).city}`}</span>;
  if (v.slot < 0) return <span className="chip chip-out">Kiadva</span>;
  return <span className={`chip chip-${v.status}`}>{STATUS_LABELS[v.status]}</span>;
}

export function MapToolbar() {
  const view = useFleet((s) => s.view);
  const setView = useFleet((s) => s.setView);
  const simulate = useFleet((s) => s.simulate);
  const setSimulate = useFleet((s) => s.setSimulate);
  const focusBranch = useFleet((s) => s.focusBranch);
  return (
    <div className="map-toolbar">
      <label className="switch" title="Véletlenszerű áthelyezések, mintha más felhasználók is dolgoznának">
        <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
        <span>Élő szimuláció</span>
      </label>
      <button className="btn" onClick={() => focusBranch(null)} disabled={view !== '3d'}>
        Áttekintés
      </button>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={view === '3d'} onClick={() => setView('3d')}>
          3D
        </button>
        <button role="tab" aria-selected={view === 'table'} onClick={() => setView('table')}>
          Táblázat
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const branches = useFleet((s) => s.branches);
  const vehicles = useFleet((s) => s.vehicles);
  const selectedId = useFleet((s) => s.selectedId);
  const select = useFleet((s) => s.select);
  const focusBranch = useFleet((s) => s.focusBranch);
  const [q, setQ] = useState('');

  const match = (v: Vehicle) => {
    const t = q.trim().toLowerCase();
    return !t || `${v.plate} ${v.make} ${v.model} ${v.assignedTo ?? ''}`.toLowerCase().includes(t);
  };

  const row = (v: Vehicle) => (
    <li key={v.id}>
      <button
        className={`vehicle-row ${selectedId === v.id ? 'is-selected' : ''}`}
        onClick={() => {
          select(v.id);
          focusBranch(v.branchId);
        }}
      >
        <span className="swatch" style={{ background: v.color }} />
        <span className="vehicle-row-main">
          <strong>{v.plate}</strong>
          <small>{v.assignedTo ? `👤 ${v.assignedTo}` : `${v.make} ${v.model}`}</small>
        </span>
        <StatusChip v={v} />
      </button>
    </li>
  );

  return (
    <aside className="sidebar">
      <input className="search" placeholder="Rendszám, típus, kolléga…" value={q} onChange={(e) => setQ(e.target.value)} />
      {branches.map((b) => {
        const mine = vehicles.filter((v) => v.branchId === b.id);
        const parked = mine.filter((v) => v.slot >= 0 && match(v));
        const out = mine.filter((v) => v.slot < 0 && match(v));
        return (
          <section key={b.id} className="branch-group">
            <button className="branch-head" onClick={() => focusBranch(b.id)}>
              <span className="branch-dot" style={{ background: b.color }} />
              <span className="branch-head-name">
                <strong>{b.city}</strong>
                <small>
                  {mine.filter((v) => v.slot >= 0).length}/{SLOT_COUNT} a telephelyen · {mine.filter((v) => v.slot < 0).length} kiadva
                </small>
              </span>
            </button>
            <ul>
              {parked.map(row)}
              {out.length > 0 && <li className="list-sub">Kiadva kollégáknak</li>}
              {out.map(row)}
              {parked.length + out.length === 0 && <li className="empty">Nincs találat.</li>}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

export function MovementLine({ m }: { m: Movement }) {
  const v = useFleet((s) => s.vehicles.find((x) => x.id === m.vehicleId));
  const text =
    m.kind === 'handover-out'
      ? `kiadva (${branchById(m.fromBranchId).city})`
      : m.kind === 'handover-in'
        ? `visszavéve (${branchById(m.toBranchId).city})`
        : `${branchById(m.fromBranchId).city} → ${branchById(m.toBranchId).city}`;
  return (
    <li className="log-line">
      <time>{time(m.startedAt)}</time>
      <span>
        <strong>{v?.plate}</strong> {text}
      </span>
      <span className={`chip ${m.arrivedAt ? 'chip-active' : 'chip-transit'}`}>{m.arrivedAt ? 'Kész' : 'Úton'}</span>
    </li>
  );
}

export function DetailPanel() {
  const selectedId = useFleet((s) => s.selectedId);
  const v = useFleet((s) => s.vehicles.find((x) => x.id === s.selectedId));
  const vehicles = useFleet((s) => s.vehicles);
  const branches = useFleet((s) => s.branches);
  const movements = useFleet((s) => s.movements);
  const inTransit = useFleet((s) => (selectedId ? !!s.transits[selectedId] : false));
  const requestMove = useFleet((s) => s.requestMove);
  const select = useFleet((s) => s.select);
  const setSection = useFleet((s) => s.setSection);

  const own = useMemo(() => movements.filter((m) => m.vehicleId === selectedId), [movements, selectedId]);

  if (!v) {
    return (
      <aside className="panel">
        <h2>Legutóbbi mozgások</h2>
        {movements.length === 0 ? (
          <p className="hint">
            Még nem volt mozgás. Válassz ki egy járművet, vagy <strong>húzd át egérrel</strong> egy másik telephelyre.
          </p>
        ) : (
          <ul className="log">
            {movements.slice(0, 14).map((m) => (
              <MovementLine key={m.id} m={m} />
            ))}
          </ul>
        )}
      </aside>
    );
  }

  const here = branchById(v.branchId);
  const obligations = obligationsFor(v).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <div className="plate plate-lg">
            <span className="plate-hu">H</span>
            {v.plate}
          </div>
          <p className="muted">
            {v.make} {v.model} · {CATEGORY_LABELS[v.category]} · {v.year}
          </p>
        </div>
        <button className="icon-btn" aria-label="Bezárás" onClick={() => select(null)}>
          ✕
        </button>
      </div>

      <dl className="facts">
        <dt>Állapot</dt>
        <dd>
          <StatusChip v={v} />
        </dd>
        {v.assignedTo ? (
          <>
            <dt>Kiadva</dt>
            <dd>
              {v.assignedTo}
              {v.assignedSince && <small className="muted"> · {new Date(v.assignedSince).toLocaleDateString('hu-HU')} óta</small>}
            </dd>
          </>
        ) : (
          <>
            <dt>{inTransit ? 'Cél' : 'Jelenleg'}</dt>
            <dd>
              {here.city} · {v.slot < 6 ? 'garázs' : 'kinti'} {v.slot + 1}. hely
            </dd>
          </>
        )}
        <dt>Saját telephely</dt>
        <dd>{branchById(v.homeBranchId).city}</dd>
        <dt>Km-óra</dt>
        <dd>{fmtKm(v.odometer)}</dd>
        <dt>Forgalmi</dt>
        <dd>{v.registrationNo}</dd>
        <dt>Tankkártya</dt>
        <dd>{v.fuelCard ? `${v.fuelCard.provider} ${v.fuelCard.number}` : '–'}</dd>
        <dt>Gumi</dt>
        <dd>{TYRE_LABELS[v.tyres]}</dd>
      </dl>

      <div className="quick-actions">
        {v.status !== 'retired' && (
          <button className="btn btn-primary" onClick={() => setSection('handover', { vehicleId: v.id })} disabled={inTransit}>
            {v.slot < 0 ? 'Visszavétel' : 'Kiadás kollégának'}
          </button>
        )}
        <button className="btn" onClick={() => setSection('damages', { vehicleId: v.id })}>
          Kár rögzítése
        </button>
      </div>

      <h3>Határidők</h3>
      <ul className="mini-list">
        {obligations.map((o) => (
          <li key={o.key}>
            <span>{o.label}</span>
            <span className="muted">{fmtDate(o.due)}</span>
            <SeverityChip o={o} />
          </li>
        ))}
      </ul>

      {v.slot >= 0 && v.status !== 'retired' && (
        <>
          <h3>Áthelyezés másik telephelyre</h3>
          <div className="move-grid">
            {branches
              .filter((b) => b.id !== v.branchId)
              .map((b) => {
                const free = freeSlot(vehicles, b.id) !== null;
                return (
                  <button
                    key={b.id}
                    className="move-btn"
                    style={{ borderColor: b.color }}
                    disabled={inTransit || !free}
                    onClick={() => requestMove(v.id, b.id)}
                    title={free ? `Áthelyezés: ${b.city}` : 'Nincs szabad hely'}
                  >
                    <span className="branch-dot" style={{ background: b.color }} />
                    {b.city}
                  </button>
                );
              })}
          </div>
          <p className="hint">Tipp: a 3D nézetben a járművet egérrel is áthúzhatod egy másik telephelyre.</p>
        </>
      )}

      {own.length > 0 && (
        <>
          <h3>Mozgások</h3>
          <ul className="log">
            {own.map((m) => (
              <MovementLine key={m.id} m={m} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

export function TableView() {
  const vehicles = useFleet((s) => s.vehicles);
  const select = useFleet((s) => s.select);
  const selectedId = useFleet((s) => s.selectedId);
  const [sort, setSort] = useState<'plate' | 'branch' | 'category'>('branch');

  const rows = [...vehicles].sort((a, b) => {
    if (sort === 'plate') return a.plate.localeCompare(b.plate);
    if (sort === 'category') return a.category.localeCompare(b.category) || a.plate.localeCompare(b.plate);
    return branchById(a.branchId).city.localeCompare(branchById(b.branchId).city, 'hu') || a.slot - b.slot;
  });

  const th = (key: typeof sort, label: string) => (
    <th>
      <button className={`th-btn ${sort === key ? 'is-active' : ''}`} onClick={() => setSort(key)}>
        {label}
      </button>
    </th>
  );

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {th('plate', 'Rendszám')}
            <th>Típus</th>
            {th('category', 'Kategória')}
            {th('branch', 'Telephely')}
            <th>Állapot</th>
            <th>Kinél</th>
            <th>Km-óra</th>
            <th>Legsürgősebb határidő</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const w = urgentObligation(v);
            return (
              <tr key={v.id} className={selectedId === v.id ? 'is-selected' : ''} onClick={() => select(v.id)}>
                <td>
                  <span className="swatch" style={{ background: v.color }} /> <Plate v={v} />
                </td>
                <td>
                  {v.make} {v.model}
                </td>
                <td>{CATEGORY_LABELS[v.category]}</td>
                <td>
                  <span className="branch-dot" style={{ background: branchById(v.branchId).color }} /> {branchById(v.branchId).city}
                </td>
                <td>
                  <StatusChip v={v} />
                </td>
                <td>{v.assignedTo ?? <span className="muted">telephelyen</span>}</td>
                <td>{fmtKm(v.odometer)}</td>
                <td>
                  {w ? (
                    <>
                      {w.label} <SeverityChip o={w} />
                    </>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Toasts() {
  const toasts = useFleet((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const ONBOARDING_KEY = 'fleet3d.onboarded';

export function Onboarding() {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_KEY);
    } catch {
      return true;
    }
  });
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* privát mód */
    }
    setOpen(false);
  };
  return (
    <div className="onboarding" role="dialog" aria-label="Rövid bemutató">
      <h2>A flotta térképen</h2>
      <ol>
        <li>
          <strong>Forgatás, nagyítás:</strong> húzd az egeret, görgess. Telephelyre kattintva odarepül a kamera.
        </li>
        <li>
          <strong>Jármű kiválasztása:</strong> kattints rá a 3D-ben vagy a bal oldali listában.
        </li>
        <li>
          <strong>Áthelyezés:</strong> húzd át egy másik telephelyre. Kiadáskor az autó kihajt a kapun, visszavételkor beáll a helyére.
        </li>
      </ol>
      <button className="btn btn-primary" onClick={close}>
        Értem
      </button>
    </div>
  );
}
