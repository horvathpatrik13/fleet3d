export type Category = 'car' | 'van' | 'minibus' | 'bus';
export type VehicleStatus = 'active' | 'service' | 'retired';
export type Tyres = 'summer' | 'winter' | 'all';
/** Dátum ISO formában: ÉÉÉÉ-HH-NN. */
export type ISODate = string;

export interface Branch {
  id: string;
  name: string;
  city: string;
  /** A sziget középpontja a világban (x, z). */
  position: [number, number];
  /** Az irány, amerre a kapu néz (radián, a térkép közepe felé). */
  heading: number;
  color: string;
  manager: string;
  managerEmail: string;
}

export interface FuelCard {
  provider: string;
  number: string;
  expires: ISODate;
  monthlyLimit: number;
}

export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  category: Category;
  color: string;
  status: VehicleStatus;
  year: number;
  /** Jelenlegi (vagy úton lévőnél: cél-) branch. */
  branchId: string;
  homeBranchId: string;
  /** Parkolóhely; -1, ha a jármű ki van adva egy kollégának. */
  slot: number;
  odometer: number;
  assignedTo?: string;
  assignedSince?: number;
  registrationNo: string;
  inspectionExpires: ISODate;
  kgfbExpires: ISODate;
  cascoExpires?: ISODate;
  vignetteExpires?: ISODate;
  serviceDueDate: ISODate;
  serviceDueKm: number;
  servicePartner: string;
  fuelCard?: FuelCard;
  tyres: Tyres;
  /** Engedélyezett-e a magánhasználat. */
  privateUse: boolean;
}

export interface Movement {
  id: string;
  vehicleId: string;
  fromBranchId: string;
  toBranchId: string;
  startedAt: number;
  arrivedAt?: number;
  kind?: 'transfer' | 'handover-out' | 'handover-in';
}

export const CATEGORY_LABELS: Record<Category, string> = {
  car: 'Személyautó',
  van: 'Kisbusz',
  minibus: 'Midibusz',
  bus: 'Autóbusz',
};

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'Használatban',
  service: 'Szervizben',
  retired: 'Kivonva',
};

export const TYRE_LABELS: Record<Tyres, string> = { summer: 'Nyári', winter: 'Téli', all: 'Négyévszakos' };

/* ---------- határidők ---------- */

export type ObligationType = 'inspection' | 'kgfb' | 'casco' | 'vignette' | 'service' | 'fuelCard';

export interface Obligation {
  key: string;
  vehicleId: string;
  type: ObligationType;
  label: string;
  due: ISODate;
  daysLeft: number;
  /** Szerviznél: hátralévő km. */
  kmLeft?: number;
  severity: 'overdue' | 'urgent' | 'soon' | 'ok';
}

export interface Reminder {
  sentAt: number;
  to: string;
}

export interface Appointment {
  date: ISODate;
  time: string;
  partner: string;
}

/* ---------- átadás-átvétel ---------- */

export interface Handover {
  id: string;
  type: 'out' | 'in';
  vehicleId: string;
  person: string;
  at: number;
  odometer: number;
  /** Üzemanyagszint százalékban. */
  fuel: number;
  checklist: Record<string, boolean>;
  notes: string;
  signature?: string;
}

export const HANDOVER_CHECKLIST: [string, string][] = [
  ['registration', 'Forgalmi engedély'],
  ['fuelCard', 'Üzemanyagkártya'],
  ['keys', 'Kulcsok (2 db)'],
  ['firstAid', 'Elsősegélycsomag'],
  ['vest', 'Láthatósági mellény'],
  ['triangle', 'Elakadásjelző háromszög'],
  ['spare', 'Pótkerék / defektjavító'],
  ['clean', 'Tiszta utastér'],
];

/* ---------- kárügyek ---------- */

export type DamageStatus = 'recorded' | 'reported' | 'repair' | 'closed';

export interface Damage {
  id: string;
  vehicleId: string;
  date: ISODate;
  driver: string;
  place: string;
  description: string;
  fault: 'own' | 'third' | 'unknown';
  coverage: 'kgfb' | 'casco' | 'own';
  estimate: number;
  claimNo?: string;
  status: DamageStatus;
  history: { at: number; status: DamageStatus; note?: string }[];
}

export const DAMAGE_STATUS: Record<DamageStatus, string> = {
  recorded: 'Rögzítve',
  reported: 'Bejelentve',
  repair: 'Javítás alatt',
  closed: 'Lezárva',
};

export const DAMAGE_FLOW: DamageStatus[] = ['recorded', 'reported', 'repair', 'closed'];

/* ---------- útnyilvántartás ---------- */

export interface TripEntry {
  date: ISODate;
  driver: string;
  from: string;
  to: string;
  purpose: string;
  startKm: number;
  endKm: number;
  kind: 'business' | 'private';
  /** Kiküldetési rendelvény száma. */
  orderNo?: string;
}

export type TripLogStatus = 'missing' | 'submitted' | 'approved' | 'returned';

export interface TripLog {
  id: string;
  vehicleId: string;
  /** ÉÉÉÉ-HH */
  month: string;
  status: TripLogStatus;
  submittedAt?: number;
  note?: string;
  entries: TripEntry[];
}

export const TRIP_STATUS: Record<TripLogStatus, string> = {
  missing: 'Nem érkezett be',
  submitted: 'Ellenőrzésre vár',
  approved: 'Elfogadva',
  returned: 'Javításra visszaküldve',
};

export interface PolicyRules {
  /** Ennél hosszabb üzleti úthoz kiküldetési rendelvény kell. */
  orderOverKm: number;
  weekendNeedsApproval: boolean;
  maxDailyKm: number;
}

/* ---------- gumicsere ---------- */

export interface TyreJob {
  status: 'todo' | 'scheduled' | 'done';
  date?: ISODate;
  time?: string;
  partner?: string;
}

/* ---------- számlák ---------- */

export type InvoiceStatus = 'received' | 'checked' | 'forwarded' | 'disputed';
export type InvoiceCategory = 'service' | 'fuel' | 'tyre' | 'damage' | 'toll' | 'other';

export interface Invoice {
  id: string;
  supplier: string;
  number: string;
  issueDate: ISODate;
  dueDate: ISODate;
  gross: number;
  category: InvoiceCategory;
  plate: string;
  status: InvoiceStatus;
  note?: string;
  forwardedAt?: number;
}

export const INVOICE_STATUS: Record<InvoiceStatus, string> = {
  received: 'Beérkezett',
  checked: 'Ellenőrizve',
  forwarded: 'Pénzügynek továbbítva',
  disputed: 'Kifogásolva',
};

export const INVOICE_CATEGORY: Record<InvoiceCategory, string> = {
  service: 'Szerviz',
  fuel: 'Üzemanyag',
  tyre: 'Gumi',
  damage: 'Kárjavítás',
  toll: 'Útdíj / matrica',
  other: 'Egyéb',
};
