import { create } from 'zustand';
import { BRANCHES, seedVehicles } from '../data/seed';
import { buildPath, SLOT_COUNT, type PathSegment } from '../data/layout';
import type { Branch, Movement, Vehicle } from '../data/types';

export interface Transit {
  movementId: string;
  segments: PathSegment[];
  /** Másodpercben, a teljes útra. */
  duration: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

interface FleetState {
  branches: Branch[];
  vehicles: Vehicle[];
  movements: Movement[];
  transits: Record<string, Transit>;
  selectedId: string | null;
  focusBranchId: string | null;
  focusNonce: number;
  view: '3d' | 'table';
  simulate: boolean;
  dragging: { vehicleId: string; hoverBranchId: string | null; active: boolean } | null;
  toasts: Toast[];

  select: (id: string | null) => void;
  focusBranch: (id: string | null) => void;
  setView: (v: '3d' | 'table') => void;
  setSimulate: (on: boolean) => void;
  setDragging: (d: FleetState['dragging']) => void;
  requestMove: (vehicleId: string, toBranchId: string) => boolean;
  arrive: (vehicleId: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let toastSeq = 0;
let moveSeq = 0;

export const branchById = (id: string) => BRANCHES.find((b) => b.id === id)!;

export function freeSlot(vehicles: Vehicle[], branchId: string): number | null {
  const taken = new Set(vehicles.filter((v) => v.branchId === branchId).map((v) => v.slot));
  for (let i = 0; i < SLOT_COUNT; i++) if (!taken.has(i)) return i;
  return null;
}

export const useFleet = create<FleetState>((set, get) => ({
  branches: BRANCHES,
  vehicles: seedVehicles(),
  movements: [],
  transits: {},
  selectedId: null,
  focusBranchId: null,
  focusNonce: 0,
  view: '3d',
  simulate: false,
  dragging: null,
  toasts: [],

  select: (id) => set({ selectedId: id }),
  focusBranch: (id) => set((s) => ({ focusBranchId: id, focusNonce: s.focusNonce + 1 })),
  setView: (view) => set({ view }),
  setSimulate: (simulate) => set({ simulate }),
  setDragging: (dragging) => set({ dragging }),

  requestMove: (vehicleId, toBranchId) => {
    const { vehicles, transits, toast } = get();
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return false;
    if (transits[vehicleId]) {
      toast(`${v.plate} már úton van.`, 'error');
      return false;
    }
    if (v.branchId === toBranchId) return false;
    if (v.status === 'retired') {
      toast(`${v.plate} ki van vonva, nem helyezhető át.`, 'error');
      return false;
    }
    const slot = freeSlot(vehicles, toBranchId);
    const from = branchById(v.branchId);
    const to = branchById(toBranchId);
    if (slot === null) {
      toast(`${to.city}: nincs szabad parkolóhely.`, 'error');
      return false;
    }

    const movement: Movement = {
      id: `m${++moveSeq}`,
      vehicleId,
      fromBranchId: from.id,
      toBranchId: to.id,
      startedAt: Date.now(),
    };
    const segments = buildPath(from, v.slot, to, slot);
    const length = segments.reduce((sum, s) => sum + s.curve.getLength(), 0);
    const instant = reducedMotion();

    set((s) => ({
      vehicles: s.vehicles.map((x) => (x.id === vehicleId ? { ...x, branchId: to.id, slot } : x)),
      movements: [instant ? { ...movement, arrivedAt: movement.startedAt } : movement, ...s.movements].slice(0, 200),
      transits: instant
        ? s.transits
        : { ...s.transits, [vehicleId]: { movementId: movement.id, segments, duration: 2.5 + length / 9 } },
    }));
    toast(`${v.plate}: ${from.city} → ${to.city}`);
    return true;
  },

  arrive: (vehicleId) => {
    const t = get().transits[vehicleId];
    if (!t) return;
    set((s) => {
      const transits = { ...s.transits };
      delete transits[vehicleId];
      return {
        transits,
        movements: s.movements.map((m) => (m.id === t.movementId ? { ...m, arrivedAt: Date.now() } : m)),
      };
    });
  },

  toast: (text, tone = 'info') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-4) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));
