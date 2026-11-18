export type Category = 'car' | 'van' | 'minibus' | 'bus';
export type VehicleStatus = 'active' | 'service' | 'retired';

export interface Branch {
  id: string;
  name: string;
  city: string;
  /** A sziget középpontja a világban (x, z). */
  position: [number, number];
  /** Az irány, amerre a kapu néz (radián, a térkép közepe felé). */
  heading: number;
  color: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  category: Category;
  color: string;
  status: VehicleStatus;
  /** Jelenlegi (vagy úton lévőnél: cél-) branch. */
  branchId: string;
  homeBranchId: string;
  slot: number;
  odometer: number;
  /** Lejáró okmány megnevezése, ha 30 napon belül lejár. */
  expiringDoc?: string;
}

export interface Movement {
  id: string;
  vehicleId: string;
  fromBranchId: string;
  toBranchId: string;
  startedAt: number;
  arrivedAt?: number;
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
