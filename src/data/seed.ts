import type { Branch, Category, Vehicle, VehicleStatus } from './types';

const DIST = 21;

function branchAt(id: string, name: string, city: string, angleDeg: number, color: string): Branch {
  const a = (angleDeg * Math.PI) / 180;
  return {
    id,
    name,
    city,
    position: [Math.sin(a) * DIST, Math.cos(a) * DIST],
    heading: a + Math.PI,
    color,
  };
}

export const BRANCHES: Branch[] = [
  branchAt('bud', 'Központi telephely', 'Budapest', 225, '#4f7cff'),
  branchAt('gyo', 'Nyugati telephely', 'Győr', 315, '#16a37f'),
  branchAt('deb', 'Keleti telephely', 'Debrecen', 45, '#e0812a'),
  branchAt('sze', 'Déli telephely', 'Szeged', 135, '#b456d6'),
];

type Row = [plate: string, make: string, model: string, category: Category, color: string, branch: string, status?: VehicleStatus, expiringDoc?: string];

const ROWS: Row[] = [
  ['AA BC-101', 'Škoda', 'Octavia Combi', 'car', '#e9edf2', 'bud'],
  ['AA BC-102', 'Škoda', 'Octavia Combi', 'car', '#2b3440', 'bud'],
  ['AA BC-215', 'Toyota', 'Corolla TS', 'car', '#c8302c', 'bud', 'active', 'Műszaki'],
  ['AA BD-330', 'Ford', 'Transit Custom', 'van', '#f2f2f2', 'bud'],
  ['AA BD-331', 'Ford', 'Transit Custom', 'van', '#1f5fa8', 'bud', 'service'],
  ['AA BE-410', 'Mercedes-Benz', 'Sprinter', 'minibus', '#d9dde2', 'bud'],
  ['AA BF-501', 'Iveco', 'Crossway', 'bus', '#f4c430', 'bud'],
  ['AA BC-140', 'Volkswagen', 'Passat Variant', 'car', '#6b7a8a', 'gyo'],
  ['AA BC-141', 'Volkswagen', 'Golf', 'car', '#2e7d4f', 'gyo'],
  ['AA BD-342', 'Renault', 'Trafic', 'van', '#ffffff', 'gyo', 'active', 'Kötelező biztosítás'],
  ['AA BE-420', 'Mercedes-Benz', 'Sprinter', 'minibus', '#9aa4ae', 'gyo'],
  ['AA BC-150', 'Škoda', 'Superb', 'car', '#1c2430', 'gyo', 'retired'],
  ['AA BC-160', 'Toyota', 'RAV4 Hybrid', 'car', '#8a1f2a', 'deb'],
  ['AA BC-161', 'Škoda', 'Kodiaq', 'car', '#dfe4ea', 'deb'],
  ['AA BD-350', 'Opel', 'Vivaro', 'van', '#3a6ea5', 'deb'],
  ['AA BD-351', 'Opel', 'Vivaro', 'van', '#ececec', 'deb', 'service'],
  ['AA BF-510', 'MAN', 'Lion’s Coach', 'bus', '#ececec', 'deb'],
  ['AA BC-170', 'Suzuki', 'Vitara', 'car', '#e46f1f', 'sze'],
  ['AA BC-171', 'Suzuki', 'Vitara', 'car', '#3d9970', 'sze', 'active', 'Autópálya-matrica'],
  ['AA BD-360', 'Ford', 'Transit', 'van', '#f6f6f6', 'sze'],
  ['AA BE-430', 'Iveco', 'Daily Minibus', 'minibus', '#2c6fbb', 'sze'],
  ['AA BF-520', 'Setra', 'S 515 HD', 'bus', '#d0d4d8', 'sze'],
];

export function seedVehicles(): Vehicle[] {
  const used: Record<string, number> = {};
  return ROWS.map(([plate, make, model, category, color, branchId, status = 'active', expiringDoc], i) => {
    // A helyek sorban töltődnek fel: előbb a garázs (A sor), aztán a kinti (B) sor.
    const slot = used[branchId] ?? 0;
    used[branchId] = slot + 1;
    return {
      id: `v${i + 1}`,
      plate,
      make,
      model,
      category,
      color,
      status,
      branchId,
      homeBranchId: branchId,
      slot,
      odometer: 18_000 + ((i * 37_919) % 210_000),
      expiringDoc,
    };
  });
}
