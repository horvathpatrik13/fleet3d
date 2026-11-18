import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  BRANCHES,
  DEFAULT_RULES,
  seedDamages,
  seedHandovers,
  seedInvoices,
  seedTripLogs,
  seedTyreJobs,
  seedVehicles,
  tyrePartner,
} from '../data/seed';
import { buildEnterPath, buildExitPath, buildPath, SLOT_COUNT, type PathSegment } from '../data/layout';
import { addDays, addMonths, hhmm, isWeekend, OBLIGATION_LABELS, RENEWAL_MONTHS, SERVICE_INTERVAL_KM, todayISO } from '../data/logic';
import type {
  Appointment,
  Branch,
  Damage,
  DamageStatus,
  Handover,
  Invoice,
  InvoiceStatus,
  ISODate,
  Movement,
  ObligationType,
  PolicyRules,
  Reminder,
  TripLog,
  TripLogStatus,
  TyreJob,
  Vehicle,
} from '../data/types';
import { DAMAGE_STATUS, DAMAGE_FLOW, INVOICE_STATUS, TRIP_STATUS } from '../data/types';

export type Section = 'today' | 'map' | 'deadlines' | 'handover' | 'damages' | 'trips' | 'tyres' | 'invoices' | 'report';

export interface Transit {
  movementId: string;
  segments: PathSegment[];
  /** Másodpercben, a teljes útra. */
  duration: number;
  /** Kiadásnál a jármű az út végén eltűnik a térképről. */
  hideAtEnd?: boolean;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface Activity {
  at: number;
  text: string;
}

interface Data {
  vehicles: Vehicle[];
  movements: Movement[];
  handovers: Handover[];
  damages: Damage[];
  tripLogs: TripLog[];
  invoices: Invoice[];
  tyreJobs: Record<string, TyreJob>;
  reminders: Record<string, Reminder>;
  appointments: Record<string, Appointment>;
  rules: PolicyRules;
  activity: Activity[];
}

interface FleetState extends Data {
  branches: Branch[];
  section: Section;
  transits: Record<string, Transit>;
  selectedId: string | null;
  focusBranchId: string | null;
  focusNonce: number;
  view: '3d' | 'table';
  simulate: boolean;
  dragging: { vehicleId: string; hoverBranchId: string | null; active: boolean } | null;
  toasts: Toast[];
  /** Előre kitöltött űrlap egy másik modulból (pl. „Kár rögzítése” az átadásból). */
  draft: { section: Section; vehicleId?: string } | null;

  setSection: (s: Section, draft?: { vehicleId?: string }) => void;
  clearDraft: () => void;
  select: (id: string | null) => void;
  focusBranch: (id: string | null) => void;
  setView: (v: '3d' | 'table') => void;
  setSimulate: (on: boolean) => void;
  setDragging: (d: FleetState['dragging']) => void;
  requestMove: (vehicleId: string, toBranchId: string) => boolean;
  arrive: (vehicleId: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  log: (text: string) => void;

  completeObligation: (key: string, newDue: ISODate) => void;
  sendReminders: (keys: string[], to: string) => void;
  bookAppointment: (key: string, appt: Appointment) => void;

  createHandover: (h: Omit<Handover, 'id' | 'at'>, returnBranchId?: string) => string | null;

  addDamage: (d: Omit<Damage, 'id' | 'status' | 'history'>) => void;
  advanceDamage: (id: string, patch?: { claimNo?: string; note?: string }) => void;

  setTripStatus: (id: string, status: TripLogStatus, note?: string) => void;
  setRules: (r: Partial<PolicyRules>) => void;

  scheduleTyre: (vehicleId: string, job: TyreJob) => void;
  autoScheduleTyres: (perDay: number) => number;
  completeTyre: (vehicleId: string) => void;

  addInvoice: (inv: Omit<Invoice, 'id' | 'status'>) => void;
  setInvoiceStatus: (ids: string[], status: InvoiceStatus, note?: string) => void;

  resetDemo: () => void;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let toastSeq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const branchById = (id: string) => BRANCHES.find((b) => b.id === id)!;

export function freeSlot(vehicles: Vehicle[], branchId: string): number | null {
  const taken = new Set(vehicles.filter((v) => v.branchId === branchId && v.slot >= 0).map((v) => v.slot));
  for (let i = 0; i < SLOT_COUNT; i++) if (!taken.has(i)) return i;
  return null;
}

function seedData(): Data {
  const now = Date.now();
  const vehicles = seedVehicles(now);
  return {
    vehicles,
    movements: [],
    handovers: seedHandovers(vehicles, now),
    damages: seedDamages(vehicles, now),
    tripLogs: seedTripLogs(vehicles, now),
    invoices: seedInvoices(vehicles, now),
    tyreJobs: seedTyreJobs(vehicles, now),
    reminders: {},
    appointments: {},
    rules: DEFAULT_RULES,
    activity: [],
  };
}

const OBLIGATION_FIELD: Record<Exclude<ObligationType, 'fuelCard'>, keyof Vehicle> = {
  inspection: 'inspectionExpires',
  kgfb: 'kgfbExpires',
  casco: 'cascoExpires',
  vignette: 'vignetteExpires',
  service: 'serviceDueDate',
};

export const renewalDefault = (type: ObligationType, today = todayISO()) => addMonths(today, RENEWAL_MONTHS[type]);

export const useFleet = create<FleetState>()(
  persist(
    (set, get) => ({
      ...seedData(),
      branches: BRANCHES,
      section: 'today',
      transits: {},
      selectedId: null,
      focusBranchId: null,
      focusNonce: 0,
      view: '3d',
      simulate: false,
      dragging: null,
      toasts: [],
      draft: null,

      setSection: (section, draft) => set({ section, draft: draft ? { section, ...draft } : null }),
      clearDraft: () => set({ draft: null }),
      select: (id) => set({ selectedId: id }),
      focusBranch: (id) => set((s) => ({ focusBranchId: id, focusNonce: s.focusNonce + 1 })),
      setView: (view) => set({ view }),
      setSimulate: (simulate) => set({ simulate }),
      setDragging: (dragging) => set({ dragging }),

      log: (text) => set((s) => ({ activity: [{ at: Date.now(), text }, ...s.activity].slice(0, 300) })),

      requestMove: (vehicleId, toBranchId) => {
        const { vehicles, transits, toast } = get();
        const v = vehicles.find((x) => x.id === vehicleId);
        if (!v) return false;
        if (transits[vehicleId]) {
          toast(`${v.plate} már úton van.`, 'error');
          return false;
        }
        if (v.branchId === toBranchId) return false;
        if (v.slot < 0) {
          toast(`${v.plate} ki van adva (${v.assignedTo}). Előbb vedd vissza.`, 'error');
          return false;
        }
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
          id: uid('m'),
          vehicleId,
          fromBranchId: from.id,
          toBranchId: to.id,
          startedAt: Date.now(),
          kind: 'transfer',
        };
        const segments = buildPath(from, v.slot, to, slot);
        startTransit(set, movement, segments, (x) => ({ ...x, branchId: to.id, slot }));
        toast(`${v.plate}: ${from.city} → ${to.city}`);
        get().log(`Áthelyezés: ${v.plate} ${from.city} → ${to.city}`);
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

      /* ---------- határidők ---------- */

      completeObligation: (key, newDue) => {
        const [vehicleId, type] = key.split(':') as [string, ObligationType];
        const v = get().vehicles.find((x) => x.id === vehicleId);
        if (!v) return;
        set((s) => {
          const reminders = { ...s.reminders };
          const appointments = { ...s.appointments };
          delete reminders[key];
          delete appointments[key];
          return {
            reminders,
            appointments,
            vehicles: s.vehicles.map((x) => {
              if (x.id !== vehicleId) return x;
              if (type === 'fuelCard') return x.fuelCard ? { ...x, fuelCard: { ...x.fuelCard, expires: newDue } } : x;
              const patch: Partial<Vehicle> = { [OBLIGATION_FIELD[type]]: newDue };
              if (type === 'service') patch.serviceDueKm = x.odometer + SERVICE_INTERVAL_KM;
              return { ...x, ...patch };
            }),
          };
        });
        get().log(`${OBLIGATION_LABELS[type]} elvégezve: ${v.plate}, új határidő ${newDue}`);
        get().toast(`${v.plate}: ${OBLIGATION_LABELS[type]} rögzítve.`);
      },

      sendReminders: (keys, to) => {
        const at = Date.now();
        set((s) => ({ reminders: { ...s.reminders, ...Object.fromEntries(keys.map((k) => [k, { sentAt: at, to }])) } }));
        get().log(`Emlékeztető kiküldve (${keys.length} tétel) → ${to}`);
        get().toast(`${keys.length} emlékeztető megjelölve kiküldöttként.`);
      },

      bookAppointment: (key, appt) => {
        set((s) => ({ appointments: { ...s.appointments, [key]: appt } }));
        const v = get().vehicles.find((x) => x.id === key.split(':')[0]);
        get().log(`Időpont foglalva: ${v?.plate} – ${appt.partner}, ${appt.date} ${appt.time}`);
        get().toast('Időpont rögzítve.');
      },

      /* ---------- átadás-átvétel ---------- */

      createHandover: (h, returnBranchId) => {
        const { vehicles, transits } = get();
        const v = vehicles.find((x) => x.id === h.vehicleId);
        if (!v) return 'Válassz járművet.';
        if (!h.person.trim()) return 'Add meg a kolléga nevét.';
        if (transits[v.id]) return 'A jármű éppen úton van, várd meg, amíg beér.';
        if (h.odometer < v.odometer) return `A km-óra állás nem lehet kevesebb a legutóbbinál (${v.odometer.toLocaleString('hu-HU')} km).`;
        const handover: Handover = { ...h, id: uid('h'), at: Date.now() };

        if (h.type === 'out') {
          if (v.slot < 0) return 'Ez a jármű már ki van adva.';
          if (v.status !== 'active') return 'Csak használatban lévő jármű adható ki.';
          const branch = branchById(v.branchId);
          const movement: Movement = {
            id: uid('m'),
            vehicleId: v.id,
            fromBranchId: branch.id,
            toBranchId: branch.id,
            startedAt: Date.now(),
            kind: 'handover-out',
          };
          startTransit(
            set,
            movement,
            buildExitPath(branch, v.slot),
            (x) => ({ ...x, slot: -1, assignedTo: h.person, assignedSince: Date.now(), odometer: h.odometer }),
            true,
          );
          get().log(`Kiadás: ${v.plate} → ${h.person} (${h.odometer.toLocaleString('hu-HU')} km)`);
          get().toast(`${v.plate} kiadva: ${h.person}`);
        } else {
          if (v.slot >= 0) return 'Ez a jármű nincs kiadva.';
          const branch = branchById(returnBranchId ?? v.homeBranchId);
          const slot = freeSlot(vehicles, branch.id);
          if (slot === null) return `${branch.city}: nincs szabad parkolóhely.`;
          const movement: Movement = {
            id: uid('m'),
            vehicleId: v.id,
            fromBranchId: branch.id,
            toBranchId: branch.id,
            startedAt: Date.now(),
            kind: 'handover-in',
          };
          startTransit(set, movement, buildEnterPath(branch, slot), (x) => ({
            ...x,
            branchId: branch.id,
            slot,
            assignedTo: undefined,
            assignedSince: undefined,
            odometer: h.odometer,
          }));
          get().log(`Visszavétel: ${v.plate} ← ${h.person}, ${branch.city} (${h.odometer.toLocaleString('hu-HU')} km)`);
          get().toast(`${v.plate} visszavéve, ${branch.city}`);
        }
        set((s) => ({ handovers: [handover, ...s.handovers] }));
        return null;
      },

      /* ---------- kárügyek ---------- */

      addDamage: (d) => {
        const dmg: Damage = { ...d, id: uid('d'), status: 'recorded', history: [{ at: Date.now(), status: 'recorded' }] };
        set((s) => ({ damages: [dmg, ...s.damages] }));
        const v = get().vehicles.find((x) => x.id === d.vehicleId);
        get().log(`Káresemény rögzítve: ${v?.plate} – ${d.description.slice(0, 60)}`);
        get().toast('Káresemény rögzítve.');
      },

      advanceDamage: (id, patch) => {
        set((s) => ({
          damages: s.damages.map((d) => {
            if (d.id !== id) return d;
            const next = DAMAGE_FLOW[Math.min(DAMAGE_FLOW.indexOf(d.status) + 1, DAMAGE_FLOW.length - 1)] as DamageStatus;
            return {
              ...d,
              claimNo: patch?.claimNo ?? d.claimNo,
              status: next,
              history: [...d.history, { at: Date.now(), status: next, note: patch?.note }],
            };
          }),
        }));
        const d = get().damages.find((x) => x.id === id);
        if (d) get().log(`Kárügy állapota: ${DAMAGE_STATUS[d.status]} (${d.claimNo ?? d.id})`);
      },

      /* ---------- útnyilvántartás ---------- */

      setTripStatus: (id, status, note) => {
        set((s) => ({ tripLogs: s.tripLogs.map((t) => (t.id === id ? { ...t, status, note: note ?? t.note } : t)) }));
        const t = get().tripLogs.find((x) => x.id === id);
        const v = get().vehicles.find((x) => x.id === t?.vehicleId);
        get().log(`Útnyilvántartás ${v?.plate} (${t?.month}): ${TRIP_STATUS[status]}${note ? ` – ${note}` : ''}`);
      },

      setRules: (r) => set((s) => ({ rules: { ...s.rules, ...r } })),

      /* ---------- gumicsere ---------- */

      scheduleTyre: (vehicleId, job) => set((s) => ({ tyreJobs: { ...s.tyreJobs, [vehicleId]: job } })),

      autoScheduleTyres: (perDay) => {
        const { tyreJobs, vehicles } = get();
        const todo = vehicles.filter((v) => tyreJobs[v.id]?.status === 'todo');
        const next: Record<string, TyreJob> = { ...tyreJobs };
        // Partnerenként (telephelyenként) napi kapacitással, hétvégét kihagyva, a már foglalt időpontokat figyelembe véve.
        const load: Record<string, number> = {};
        Object.values(tyreJobs).forEach((j) => {
          if (j.status === 'scheduled' && j.date && j.partner) load[`${j.partner}|${j.date}`] = (load[`${j.partner}|${j.date}`] ?? 0) + 1;
        });
        todo.forEach((v) => {
          const partner = tyrePartner(v.homeBranchId);
          let date = addDays(todayISO(), 1);
          for (;;) {
            const k = `${partner}|${date}`;
            if (!isWeekend(date) && (load[k] ?? 0) < perDay) {
              load[k] = (load[k] ?? 0) + 1;
              next[v.id] = { status: 'scheduled', date, time: hhmm(8 + load[k] - 1), partner };
              break;
            }
            date = addDays(date, 1);
          }
        });
        set({ tyreJobs: next });
        if (todo.length) get().log(`Gumicsere automatikus ütemezése: ${todo.length} jármű`);
        return todo.length;
      },

      completeTyre: (vehicleId) => {
        set((s) => ({
          tyreJobs: { ...s.tyreJobs, [vehicleId]: { ...s.tyreJobs[vehicleId], status: 'done' } },
          vehicles: s.vehicles.map((v) => (v.id === vehicleId ? { ...v, tyres: 'winter' } : v)),
        }));
        const v = get().vehicles.find((x) => x.id === vehicleId);
        get().log(`Gumicsere kész: ${v?.plate}`);
      },

      /* ---------- számlák ---------- */

      addInvoice: (inv) => {
        set((s) => ({ invoices: [{ ...inv, id: uid('i'), status: 'received' }, ...s.invoices] }));
        get().log(`Számla rögzítve: ${inv.supplier} ${inv.number}`);
        get().toast('Számla rögzítve.');
      },

      setInvoiceStatus: (ids, status, note) => {
        const at = Date.now();
        set((s) => ({
          invoices: s.invoices.map((i) =>
            ids.includes(i.id) ? { ...i, status, note: note ?? i.note, forwardedAt: status === 'forwarded' ? at : i.forwardedAt } : i,
          ),
        }));
        get().log(`Számlák (${ids.length} db): ${INVOICE_STATUS[status]}`);
      },

      resetDemo: () => {
        set({ ...seedData(), transits: {}, selectedId: null, toasts: [] });
        get().toast('Mintaadatok visszaállítva.');
      },
    }),
    {
      name: 'fleet3d-data-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        vehicles: s.vehicles,
        movements: s.movements,
        handovers: s.handovers,
        damages: s.damages,
        tripLogs: s.tripLogs,
        invoices: s.invoices,
        tyreJobs: s.tyreJobs,
        reminders: s.reminders,
        appointments: s.appointments,
        rules: s.rules,
        activity: s.activity,
        section: s.section,
      }),
    },
  ),
);

type Setter = (fn: (s: FleetState) => Partial<FleetState>) => void;

/** Közös: mozgás naplózása, jármű frissítése és (ha engedett) az animáció indítása. */
function startTransit(
  set: Setter,
  movement: Movement,
  segments: PathSegment[],
  update: (v: Vehicle) => Vehicle,
  hideAtEnd = false,
) {
  const length = segments.reduce((sum, s) => sum + s.curve.getLength(), 0);
  const instant = reducedMotion();
  set((s) => ({
    vehicles: s.vehicles.map((x) => (x.id === movement.vehicleId ? update(x) : x)),
    movements: [instant ? { ...movement, arrivedAt: movement.startedAt } : movement, ...s.movements].slice(0, 200),
    transits: instant
      ? s.transits
      : { ...s.transits, [movement.vehicleId]: { movementId: movement.id, segments, duration: 2 + length / 9, hideAtEnd } },
  }));
}
