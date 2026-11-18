import { useEffect, useState } from 'react';
import { FleetScene } from './scene/FleetScene';
import { useFleet } from './state/store';
import { DetailPanel, Onboarding, Sidebar, TableView, Toasts, TopBar } from './ui/Panels';

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
      const candidates = vehicles.filter((v) => v.status !== 'retired' && !transits[v.id]);
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

export function App() {
  const view = useFleet((s) => s.view);
  const setView = useFleet((s) => s.setView);
  const [webgl] = useState(hasWebGL);
  useSimulation();

  useEffect(() => {
    if (!webgl) setView('table');
  }, [webgl, setView]);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <Sidebar />
        <div className="stage">
          {webgl && <FleetScene />}
          {view === 'table' && <TableView />}
          {!webgl && <div className="notice">Ez a böngésző nem támogatja a 3D nézetet, ezért táblázatos nézet látható.</div>}
          {view === '3d' && webgl && <Onboarding />}
          <Toasts />
        </div>
        <DetailPanel />
      </div>
    </div>
  );
}
