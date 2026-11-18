import { useMemo, useState } from 'react';
import { SLOT_COUNT } from '../data/layout';
import { CATEGORY_LABELS, STATUS_LABELS, type Movement, type Vehicle } from '../data/types';
import { branchById, freeSlot, useFleet } from '../state/store';

const time = (ms: number) => new Date(ms).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function StatusChip({ v }: { v: Vehicle }) {
  const inTransit = useFleet((s) => !!s.transits[v.id]);
  if (inTransit) return <span className="chip chip-transit">Úton → {branchById(v.branchId).city}</span>;
  return <span className={`chip chip-${v.status}`}>{STATUS_LABELS[v.status]}</span>;
}

export function TopBar() {
  const vehicles = useFleet((s) => s.vehicles);
  const transitCount = useFleet((s) => Object.keys(s.transits).length);
  const view = useFleet((s) => s.view);
  const setView = useFleet((s) => s.setView);
  const simulate = useFleet((s) => s.simulate);
  const setSimulate = useFleet((s) => s.setSimulate);
  const focusBranch = useFleet((s) => s.focusBranch);

  const kpis = [
    { label: 'Jármű', value: vehicles.length },
    { label: 'Úton', value: transitCount, tone: 'transit' },
    { label: 'Szervizben', value: vehicles.filter((v) => v.status === 'service').length, tone: 'service' },
    { label: 'Lejáró okmány', value: vehicles.filter((v) => v.expiringDoc).length, tone: 'doc' },
  ];

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">◆</span> Fleet3D
        <span className="brand-sub">Flotta áttekintő · prototípus</span>
      </div>
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi ${k.tone ? `kpi-${k.tone}` : ''}`}>
            <strong>{k.value}</strong>
            <span>{k.label}</span>
          </div>
        ))}
      </div>
      <div className="actions">
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
    </header>
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
    return !t || `${v.plate} ${v.make} ${v.model}`.toLowerCase().includes(t);
  };

  return (
    <aside className="sidebar">
      <input className="search" placeholder="Keresés rendszámra, típusra…" value={q} onChange={(e) => setQ(e.target.value)} />
      {branches.map((b) => {
        const list = vehicles.filter((v) => v.branchId === b.id && match(v));
        const total = vehicles.filter((v) => v.branchId === b.id).length;
        return (
          <section key={b.id} className="branch-group">
            <button className="branch-head" onClick={() => focusBranch(b.id)}>
              <span className="branch-dot" style={{ background: b.color }} />
              <span className="branch-head-name">
                <strong>{b.city}</strong>
                <small>{b.name}</small>
              </span>
              <span className="branch-count">
                {total}/{SLOT_COUNT}
              </span>
            </button>
            <ul>
              {list.map((v) => (
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
                      <small>
                        {v.make} {v.model}
                      </small>
                    </span>
                    <StatusChip v={v} />
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="empty">Nincs találat.</li>}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

function MovementLine({ m }: { m: Movement }) {
  const v = useFleet((s) => s.vehicles.find((x) => x.id === m.vehicleId));
  return (
    <li className="log-line">
      <time>{time(m.startedAt)}</time>
      <span>
        <strong>{v?.plate}</strong> {branchById(m.fromBranchId).city} → {branchById(m.toBranchId).city}
      </span>
      <span className={`chip ${m.arrivedAt ? 'chip-active' : 'chip-transit'}`}>{m.arrivedAt ? 'Megérkezett' : 'Úton'}</span>
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

  const own = useMemo(() => movements.filter((m) => m.vehicleId === selectedId), [movements, selectedId]);

  if (!v) {
    return (
      <aside className="panel">
        <h2>Legutóbbi mozgások</h2>
        {movements.length === 0 ? (
          <p className="hint">
            Még nem volt áthelyezés. Válassz ki egy járművet, vagy <strong>húzd át egérrel</strong> egy másik telephelyre.
          </p>
        ) : (
          <ul className="log">
            {movements.slice(0, 12).map((m) => (
              <MovementLine key={m.id} m={m} />
            ))}
          </ul>
        )}
      </aside>
    );
  }

  const here = branchById(v.branchId);
  const home = branchById(v.homeBranchId);

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <div className="plate plate-lg">
            <span className="plate-hu">H</span>
            {v.plate}
          </div>
          <p className="muted">
            {v.make} {v.model} · {CATEGORY_LABELS[v.category]}
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
        <dt>{inTransit ? 'Cél' : 'Jelenleg'}</dt>
        <dd>
          {here.city} · {v.slot < 6 ? 'garázs' : 'kinti'} {v.slot + 1}. hely
        </dd>
        <dt>Saját telephely</dt>
        <dd>{home.city}</dd>
        <dt>Km-óra</dt>
        <dd>{v.odometer.toLocaleString('hu-HU')} km</dd>
        {v.expiringDoc && (
          <>
            <dt>Figyelmeztetés</dt>
            <dd className="warn">Hamarosan lejár: {v.expiringDoc}</dd>
          </>
        )}
      </dl>

      <h3>Áthelyezés</h3>
      {v.status === 'retired' ? (
        <p className="hint">Kivont jármű nem helyezhető át.</p>
      ) : (
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
      )}
      <p className="hint">Tipp: a 3D nézetben a járművet egérrel is áthúzhatod egy másik telephelyre.</p>

      <h3>Előzmények</h3>
      {own.length === 0 ? (
        <p className="hint">Ebben a munkamenetben még nem mozgott.</p>
      ) : (
        <ul className="log">
          {own.map((m) => (
            <MovementLine key={m.id} m={m} />
          ))}
        </ul>
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
            <th>Km-óra</th>
            <th>Figyelmeztetés</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className={selectedId === v.id ? 'is-selected' : ''} onClick={() => select(v.id)}>
              <td>
                <span className="swatch" style={{ background: v.color }} /> <strong>{v.plate}</strong>
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
              <td>{v.odometer.toLocaleString('hu-HU')} km</td>
              <td className="warn">{v.expiringDoc ? `Lejár: ${v.expiringDoc}` : ''}</td>
            </tr>
          ))}
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
      <h2>Üdv a Fleet3D-ben!</h2>
      <ol>
        <li>
          <strong>Forgatás, nagyítás:</strong> húzd az egeret, görgess. Telephelyre kattintva odarepül a kamera.
        </li>
        <li>
          <strong>Jármű kiválasztása:</strong> kattints rá a 3D-ben vagy a bal oldali listában.
        </li>
        <li>
          <strong>Áthelyezés:</strong> húzd át egy másik telephelyre, vagy használd a jobb oldali gombokat.
        </li>
      </ol>
      <button className="btn btn-primary" onClick={close}>
        Kezdjük
      </button>
    </div>
  );
}
