import { useEffect, useMemo, useState } from 'react';
import { allObligations } from './data/logic';
import { FleetScene } from './scene/FleetScene';
import { type Section, useFleet } from './state/store';
import { DetailPanel, MapToolbar, Onboarding, Sidebar, TableView, Toasts } from './ui/MapPanels';
import { Damages } from './ui/modules/Damages';
import { Deadlines } from './ui/modules/Deadlines';
import { Handover } from './ui/modules/Handover';
import { Invoices } from './ui/modules/Invoices';
import { Report } from './ui/modules/Report';
import { Today } from './ui/modules/Today';
import { Trips } from './ui/modules/Trips';
import { Tyres } from './ui/modules/Tyres';
import { Modal } from './ui/common';
import { Icon, type IconName } from './ui/icons';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Élő szimuláció: időnként egy véletlen jármű átmegy egy másik telephelyre. */
function useSimulation() {
  const simulate = useFleet((s) => s.simulate);
  useEffect(() => {
    if (!simulate) return;
    const tick = () => {
      const { vehicles, transits, branches, requestMove } = useFleet.getState();
      const candidates = vehicles.filter((v) => v.status !== 'retired' && v.slot >= 0 && !transits[v.id]);
      if (!candidates.length) return;
      const v = candidates[Math.floor(Math.random() * candidates.length)];
      const targets = branches.filter((b) => b.id !== v.branchId);
      requestMove(v.id, targets[Math.floor(Math.random() * targets.length)].id);
    };
    tick();
    const id = setInterval(tick, 3500);
    return () => clearInterval(id);
  }, [simulate]);
}

function useNavBadges(): Partial<Record<Section, number>> {
  const vehicles = useFleet((s) => s.vehicles);
  const reminders = useFleet((s) => s.reminders);
  const appointments = useFleet((s) => s.appointments);
  const damages = useFleet((s) => s.damages);
  const tripLogs = useFleet((s) => s.tripLogs);
  const invoices = useFleet((s) => s.invoices);
  const tyreJobs = useFleet((s) => s.tyreJobs);
  return useMemo(() => {
    const obl = allObligations(vehicles).filter((o) => o.severity !== 'ok');
    return {
      deadlines: obl.filter((o) => !reminders[o.key] && !appointments[o.key]).length,
      damages: damages.filter((d) => d.status === 'recorded').length,
      trips: tripLogs.filter((t) => t.status === 'submitted' || t.status === 'missing').length,
      invoices: invoices.filter((i) => i.status === 'received' || i.status === 'checked').length,
      tyres: Object.values(tyreJobs).filter((j) => j.status === 'todo').length,
    };
  }, [vehicles, reminders, appointments, damages, tripLogs, invoices, tyreJobs]);
}

const NAV: [Section, IconName, string][] = [
  ['today', 'today', 'Mai teendők'],
  ['map', 'map', 'Flotta térkép'],
  ['deadlines', 'clock', 'Határidők'],
  ['handover', 'key', 'Átadás-átvétel'],
  ['damages', 'wrench', 'Kárügyek'],
  ['trips', 'route', 'Útnyilvántartás'],
  ['tyres', 'snow', 'Gumicsere'],
  ['invoices', 'doc', 'Számlák'],
  ['report', 'chart', 'Vezetői riport'],
];

function Nav() {
  const section = useFleet((s) => s.section);
  const setSection = useFleet((s) => s.setSection);
  const resetDemo = useFleet((s) => s.resetDemo);
  const badges = useNavBadges();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <nav className="nav" aria-label="Fő menü">
      {NAV.map(([key, icon, label]) => {
        const count = badges[key];
        return (
          <button
            key={key}
            className={`nav-item ${section === key ? 'is-active' : ''}`}
            onClick={() => setSection(key)}
            aria-current={section === key ? 'page' : undefined}
            aria-label={count ? `${label}, ${count} teendő` : label}
            title={label}
          >
            <span className="nav-icon">
              <Icon name={icon} />
            </span>
            <span className="nav-label">{label}</span>
            {!!count && (
              <span className="nav-badge" aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        );
      })}
      <span className="spacer" />
      <button className="nav-item nav-reset" onClick={() => setConfirmReset(true)} title="Mintaadatok visszaállítása">
        <span className="nav-icon">
          <Icon name="reset" size={18} />
        </span>
        <span className="nav-label">Mintaadatok visszaállítása</span>
      </button>
      {confirmReset && (
        <Modal title="Visszaállítod a mintaadatokat?" onClose={() => setConfirmReset(false)} size="sm">
          <p className="hint">A prototípusban rögzített minden változás (kiadások, kárügyek, számlák, emlékeztetők) elvész. Ez nem vonható vissza.</p>
          <div className="modal-foot">
            <button className="btn" onClick={() => setConfirmReset(false)} autoFocus>
              Mégse
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
              }}
            >
              Visszaállítás
            </button>
          </div>
        </Modal>
      )}
    </nav>
  );
}

function TopBar() {
  const vehicles = useFleet((s) => s.vehicles);
  const transitCount = useFleet((s) => Object.keys(s.transits).length);
  const kpis = [
    { label: 'Jármű', value: vehicles.length },
    { label: 'Telephelyen', value: vehicles.filter((v) => v.slot >= 0).length },
    { label: 'Kiadva', value: vehicles.filter((v) => v.slot < 0).length, tone: 'out' },
    { label: 'Úton', value: transitCount, tone: 'transit' },
    { label: 'Szervizben', value: vehicles.filter((v) => v.status === 'service').length, tone: 'service' },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">◆</span> Fleet3D
        <span className="brand-sub">Flottakezelés · prototípus</span>
      </div>
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi ${k.tone ? `kpi-${k.tone}` : ''}`}>
            <strong>{k.value}</strong>
            <span>{k.label}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

function MapWorkspace({ webgl, hidden }: { webgl: boolean; hidden: boolean }) {
  const view = useFleet((s) => s.view);
  return (
    <div className={`main ${hidden ? 'is-hidden' : ''}`}>
      <Sidebar />
      <div className="stage">
        {webgl && <FleetScene paused={hidden} />}
        {view === 'table' && <TableView />}
        {!webgl && <div className="notice">Ez a böngésző nem támogatja a 3D nézetet, ezért táblázatos nézet látható.</div>}
        {view === '3d' && webgl && !hidden && <Onboarding />}
        <MapToolbar />
      </div>
      <DetailPanel />
    </div>
  );
}

const PAGES: Partial<Record<Section, () => React.ReactElement>> = {
  today: Today,
  deadlines: Deadlines,
  handover: Handover,
  damages: Damages,
  trips: Trips,
  tyres: Tyres,
  invoices: Invoices,
  report: Report,
};

export function App() {
  const section = useFleet((s) => s.section);
  const setView = useFleet((s) => s.setView);
  const [webgl] = useState(hasWebGL);
  useSimulation();

  useEffect(() => {
    if (!webgl) setView('table');
  }, [webgl, setView]);

  const PageComp = PAGES[section];

  return (
    <div className="app">
      <TopBar />
      <div className="shell">
        <Nav />
        <div className="content">
          {/* A térkép mindig fel van csatolva: a máshonnan indított kiadás/visszavétel animációja a térképre váltáskor fut le. */}
          <MapWorkspace webgl={webgl} hidden={section !== 'map'} />
          {PageComp && <PageComp />}
        </div>
      </div>
      <Toasts />
    </div>
  );
}
