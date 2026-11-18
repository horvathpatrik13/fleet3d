import { addDays, addMonths, hhmm, previousMonth, todayISO } from './logic';
import { SLOT_COUNT } from './layout';
import type {
  Branch,
  Category,
  Damage,
  Handover,
  Invoice,
  PolicyRules,
  TripEntry,
  TripLog,
  TyreJob,
  Vehicle,
} from './types';

const DIST = 21;

function branchAt(
  id: string,
  name: string,
  city: string,
  angleDeg: number,
  color: string,
  manager: string,
  managerEmail: string,
): Branch {
  const a = (angleDeg * Math.PI) / 180;
  return { id, name, city, position: [Math.sin(a) * DIST, Math.cos(a) * DIST], heading: a + Math.PI, color, manager, managerEmail };
}

/** Minta telephelyek – a valós adatokkal (név, vezető, e-mail) cserélendők. */
export const BRANCHES: Branch[] = [
  branchAt('gyo', 'Központi iroda', 'Győr', 225, '#2f6bff', 'Szabó Katalin', 'gyor.vezeto@pelda.hu'),
  branchAt('mmo', 'Kirendeltség', 'Mosonmagyaróvár', 315, '#16a37f', 'Tóth Gábor', 'mosonmagyarovar.vezeto@pelda.hu'),
  branchAt('bud', 'Kirendeltség', 'Budapest', 45, '#e0812a', 'Nagy Eszter', 'budapest.vezeto@pelda.hu'),
  branchAt('deb', 'Kirendeltség', 'Debrecen', 135, '#b456d6', 'Kiss Balázs', 'debrecen.vezeto@pelda.hu'),
];

export const PEOPLE = [
  'Kovács Péter', 'Horváth Anna', 'Varga Tamás', 'Molnár Zsófia', 'Farkas Dániel', 'Papp Réka', 'Takács Bence',
  'Juhász Nóra', 'Lakatos Márk', 'Mészáros Lilla', 'Simon Ádám', 'Fekete Dóra', 'Oláh Krisztián', 'Rácz Viktória',
];

export const SERVICE_PARTNERS: Record<string, string[]> = {
  gyo: ['Győri Autószerviz Kft.', 'Rába Gumiszerviz'],
  mmo: ['Óvári Autójavító', 'Moson Gumicentrum'],
  bud: ['Fővárosi Flottaszerviz', 'Pesti Gumi Pont'],
  deb: ['Cívis Autószerviz', 'Debreceni Gumiház'],
};

/** Gumiszerviz a telephelyhez (a lista második eleme). */
export const tyrePartner = (branchId: string) => SERVICE_PARTNERS[branchId][1];

type Model = [make: string, model: string, category: Category];
const MODELS: Model[] = [
  ['Škoda', 'Octavia Combi', 'car'],
  ['Škoda', 'Fabia', 'car'],
  ['Toyota', 'Corolla TS', 'car'],
  ['Suzuki', 'Vitara', 'car'],
  ['Dacia', 'Duster', 'car'],
  ['Volkswagen', 'Golf Variant', 'car'],
  ['Opel', 'Astra', 'car'],
  ['Volkswagen', 'Caddy', 'van'],
  ['Ford', 'Transit Custom', 'van'],
  ['Renault', 'Trafic', 'van'],
  ['Opel', 'Vivaro', 'van'],
  ['Mercedes-Benz', 'Sprinter', 'minibus'],
];

const COLORS = ['#e9edf2', '#2b3440', '#c8302c', '#1f5fa8', '#6b7a8a', '#f2f2f2', '#2e7d4f', '#8a1f2a', '#dfe4ea', '#3a6ea5', '#e46f1f'];
const FUEL_PROVIDERS = ['MOL', 'Shell', 'OMV'];
const LETTERS = 'ABCDEFGHJKLMNPRSTUVXZ';

/** Determinisztikus álvéletlen, hogy a mintaadat minden betöltésnél ugyanaz legyen. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const VEHICLE_COUNT = 50;

export function seedVehicles(now = Date.now()): Vehicle[] {
  const today = todayISO(now);
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const perBranch: Record<string, number> = {};
  const out: Vehicle[] = [];

  for (let i = 0; i < VEHICLE_COUNT; i++) {
    const branch = BRANCHES[i % BRANCHES.length];
    const [make, model, category] = i % 9 === 4 ? MODELS[11] : MODELS[i % 11];
    const n = perBranch[branch.id] ?? 0;
    perBranch[branch.id] = n + 1;
    // Telephelyenként az első 9 jármű a parkolóban áll (1 hely szabad), a többi ki van adva.
    const parked = n < SLOT_COUNT - 1;
    const odometer = 15_000 + Math.floor(r() * 190_000);
    // Határidők szétszórva: néhány lejárt, néhány hamarosan, a többi bőven.
    const spread = (base: number) => addDays(today, Math.floor(base + r() * 330));
    const plate =
      i % 3 === 0
        ? `${pick(LETTERS.split(''))}${pick(LETTERS.split(''))}${pick(LETTERS.split(''))}-${String(100 + ((i * 37) % 900))}`
        : `AA ${LETTERS[(i * 3) % LETTERS.length]}${LETTERS[(i * 7) % LETTERS.length]}-${String(100 + ((i * 53) % 900))}`;

    const v: Vehicle = {
      id: `v${i + 1}`,
      plate,
      make,
      model,
      category,
      color: COLORS[i % COLORS.length],
      status: i === 17 || i === 33 ? 'service' : i === 46 ? 'retired' : 'active',
      year: 2017 + (i % 9),
      branchId: branch.id,
      homeBranchId: branch.id,
      slot: parked ? n : -1,
      odometer,
      assignedTo: parked ? undefined : PEOPLE[i % PEOPLE.length],
      assignedSince: parked ? undefined : now - (5 + (i % 40)) * 86_400_000,
      registrationNo: `${LETTERS[i % LETTERS.length]}${LETTERS[(i * 5) % LETTERS.length]}${String(100000 + i * 7919).slice(0, 6)}`,
      inspectionExpires: spread(-20),
      kgfbExpires: spread(-5),
      cascoExpires: i % 4 === 3 ? undefined : spread(10),
      vignetteExpires: spread(-10),
      serviceDueDate: spread(-15),
      serviceDueKm: odometer + Math.floor(-1500 + r() * 30_000),
      servicePartner: SERVICE_PARTNERS[branch.id][0],
      fuelCard: {
        provider: FUEL_PROVIDERS[i % 3],
        number: `7005 ${String(1000 + i * 17).padStart(4, '0')} ${String(2000 + i * 91).slice(0, 4)}`,
        expires: i % 11 === 5 ? addDays(today, 12) : addMonths(today, 6 + (i % 30)),
        monthlyLimit: category === 'car' ? 150_000 : 250_000,
      },
      tyres: i % 3 === 0 ? 'winter' : i % 10 === 7 ? 'all' : 'summer',
      privateUse: i % 5 === 0,
    };
    out.push(v);
  }
  return out;
}

export const DEFAULT_RULES: PolicyRules = { orderOverKm: 50, weekendNeedsApproval: true, maxDailyKm: 700 };

const PLACES = ['Győr', 'Mosonmagyaróvár', 'Budapest', 'Tatabánya', 'Sopron', 'Székesfehérvár', 'Komárom', 'Pápa', 'Debrecen', 'Nyíregyháza'];
const PURPOSES = ['Ügyféltalálkozó', 'Munkavállalók szállítása', 'Partnerlátogatás', 'Toborzási nap', 'Iratok kézbesítése', 'Szállásellenőrzés'];

/** Az előző havi útnyilvántartások: többségük rendben, néhányban szándékos hiba van. */
export function seedTripLogs(vehicles: Vehicle[], now = Date.now()): TripLog[] {
  const month = previousMonth(now);
  const r = rng(7);
  const logs: TripLog[] = [];
  vehicles
    .filter((v) => v.status !== 'retired')
    .slice(0, 24)
    .forEach((v, vi) => {
      if (vi % 8 === 7) {
        logs.push({ id: `t${v.id}`, vehicleId: v.id, month, status: 'missing', entries: [] });
        return;
      }
      let km = v.odometer - 2500;
      const entries: TripEntry[] = [];
      const driver = v.assignedTo ?? PEOPLE[vi % PEOPLE.length];
      for (let day = 2; day <= 28; day += 2 + Math.floor(r() * 3)) {
        const dist = 20 + Math.floor(r() * 160);
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const kind: TripEntry['kind'] = vi % 6 === 2 && day > 20 ? 'private' : 'business';
        entries.push({
          date,
          driver,
          from: PLACES[(vi + day) % 3],
          to: PLACES[(vi * 3 + day) % PLACES.length],
          purpose: kind === 'private' ? 'Magáncélú használat' : PURPOSES[(vi + day) % PURPOSES.length],
          startKm: km,
          endKm: km + dist,
          kind,
          orderNo: kind === 'business' && dist > 50 && !(vi % 5 === 1 && day < 10) ? `KR-${month.replace('-', '')}-${vi}${day}` : undefined,
        });
        km += dist;
        // szándékos km-hiány
        if (vi % 7 === 3 && day === 10) km += 85;
      }
      logs.push({
        id: `t${v.id}`,
        vehicleId: v.id,
        month,
        status: vi % 4 === 0 ? 'approved' : 'submitted',
        submittedAt: now - (3 + (vi % 10)) * 86_400_000,
        entries,
      });
    });
  return logs;
}

export function seedDamages(vehicles: Vehicle[], now = Date.now()): Damage[] {
  const today = todayISO(now);
  const mk = (i: number, d: Partial<Damage>): Damage => ({
    id: `d${i}`,
    vehicleId: vehicles[i * 7].id,
    date: addDays(today, -i * 9 - 2),
    driver: PEOPLE[i * 3],
    place: 'Győr, Szent István út',
    description: '',
    fault: 'unknown',
    coverage: 'casco',
    estimate: 0,
    status: 'recorded',
    history: [{ at: now - (i * 9 + 2) * 86_400_000, status: 'recorded' }],
    ...d,
  });
  return [
    mk(0, { description: 'Parkolóban ismeretlen jármű megtörte a hátsó lökhárítót.', estimate: 180_000, place: 'Győr, Árkád parkoló' }),
    mk(1, {
      description: 'Kőfelverődés az M1-en, szélvédő-csillagosodás.',
      coverage: 'casco',
      fault: 'third',
      estimate: 95_000,
      place: 'M1, 120-as km',
      status: 'reported',
      claimNo: 'CS-2026-118842',
    }),
    mk(2, {
      description: 'Tolatás közben oszlopnak ütközött, jobb hátsó sárvédő horpadt.',
      coverage: 'own',
      fault: 'own',
      estimate: 240_000,
      place: 'Mosonmagyaróvár, telephely',
      status: 'repair',
      claimNo: 'CS-2026-117301',
    }),
    mk(3, {
      description: 'Ráfutásos baleset, a vétlen fél mi vagyunk.',
      coverage: 'kgfb',
      fault: 'third',
      estimate: 410_000,
      place: 'Budapest, Váci út',
      status: 'closed',
      claimNo: 'KG-2026-55120',
    }),
  ];
}

export function seedHandovers(vehicles: Vehicle[], now = Date.now()): Handover[] {
  return vehicles
    .filter((v) => v.assignedTo)
    .slice(0, 6)
    .map((v, i) => ({
      id: `h${i + 1}`,
      type: 'out',
      vehicleId: v.id,
      person: v.assignedTo!,
      at: v.assignedSince ?? now,
      odometer: v.odometer - 900 - i * 120,
      fuel: 75 + (i % 3) * 10,
      checklist: { registration: true, fuelCard: true, keys: true, firstAid: true, vest: true, triangle: true, spare: i % 2 === 0, clean: true },
      notes: i === 2 ? 'Bal első ajtón meglévő karc.' : '',
    }));
}

export function seedInvoices(vehicles: Vehicle[], now = Date.now()): Invoice[] {
  const today = todayISO(now);
  const v = (i: number) => vehicles[i].plate;
  return [
    { id: 'i1', supplier: 'Győri Autószerviz Kft.', number: 'GYA-2026-0912', issueDate: addDays(today, -6), dueDate: addDays(today, 2), gross: 148_590, category: 'service', plate: v(0), status: 'received' },
    { id: 'i2', supplier: 'MOL Nyrt.', number: 'MOL-FL-2610-4471', issueDate: addDays(today, -12), dueDate: addDays(today, 6), gross: 1_284_330, category: 'fuel', plate: '', status: 'received', note: 'Októberi flottakártya-összesítő' },
    { id: 'i3', supplier: 'Rába Gumiszerviz', number: 'RG-1187', issueDate: addDays(today, -3), dueDate: addDays(today, 12), gross: 64_000, category: 'tyre', plate: v(4), status: 'received' },
    { id: 'i4', supplier: 'Óvári Autójavító', number: 'OA-0455', issueDate: addDays(today, -15), dueDate: addDays(today, -1), gross: 312_800, category: 'damage', plate: v(14), status: 'checked' },
    { id: 'i5', supplier: 'Fővárosi Flottaszerviz', number: 'FFS-26-3310', issueDate: addDays(today, -4), dueDate: addDays(today, 10), gross: 89_900, category: 'service', plate: 'XYZ-999', status: 'received' },
    { id: 'i6', supplier: 'Rába Gumiszerviz', number: 'RG-1187', issueDate: addDays(today, -2), dueDate: addDays(today, 12), gross: 64_000, category: 'tyre', plate: v(4), status: 'received' },
    { id: 'i7', supplier: 'Nemzeti Útdíjfizetési Szolgáltató', number: 'NUSZ-26-778812', issueDate: addDays(today, -20), dueDate: addDays(today, -10), gross: 57_400, category: 'toll', plate: v(9), status: 'forwarded', forwardedAt: now - 15 * 86_400_000 },
    { id: 'i8', supplier: 'Cívis Autószerviz', number: 'CA-2026-221', issueDate: addDays(today, -1), dueDate: addDays(today, 14), gross: 41_250, category: 'service', plate: v(3), status: 'received' },
  ];
}

/** Téli gumicsere-kampány: a nyári gumis járművekre. Néhány már kész vagy ütemezett. */
export function seedTyreJobs(vehicles: Vehicle[], now = Date.now()): Record<string, TyreJob> {
  const today = todayISO(now);
  const jobs: Record<string, TyreJob> = {};
  vehicles
    .filter((v) => v.status !== 'retired' && v.tyres === 'summer')
    .forEach((v, i) => {
      if (i % 5 === 0) jobs[v.id] = { status: 'scheduled', date: addDays(today, 1 + (i % 3)), time: hhmm(8 + (i % 6)), partner: tyrePartner(v.homeBranchId) };
      else jobs[v.id] = { status: 'todo' };
    });
  return jobs;
}
