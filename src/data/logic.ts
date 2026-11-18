import type {
  Invoice,
  ISODate,
  Obligation,
  ObligationType,
  PolicyRules,
  TripLog,
  TyreJob,
  Vehicle,
} from './types';

/* ---------- dátumok ---------- */

const DAY = 86_400_000;

export function todayISO(now = Date.now()): ISODate {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d + days);
  return todayISO(t.getTime());
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1 + months, d).getTime());
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = new Date(from + 'T00:00:00').getTime();
  const b = new Date(to + 'T00:00:00').getTime();
  return Math.round((b - a) / DAY);
}

export function isWeekend(iso: ISODate): boolean {
  const day = new Date(iso + 'T00:00:00').getDay();
  return day === 0 || day === 6;
}

export const fmtDate = (iso?: ISODate) => (iso ? iso.replaceAll('-', '.') + '.' : '–');
export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fmtFt = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} Ft`;
export const fmtKm = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} km`;

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
}

export function previousMonth(now = Date.now()): string {
  const d = new Date(now);
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
}

/* ---------- határidők ---------- */

export const OBLIGATION_LABELS: Record<ObligationType, string> = {
  inspection: 'Műszaki vizsga',
  kgfb: 'Kötelező biztosítás (KGFB)',
  casco: 'Casco',
  vignette: 'Autópálya-matrica',
  service: 'Szerviz',
  fuelCard: 'Üzemanyagkártya',
};

/** Alapértelmezett megújítási idő hónapban, ha egy kötelezettséget elvégeztek. */
export const RENEWAL_MONTHS: Record<ObligationType, number> = {
  inspection: 24,
  kgfb: 12,
  casco: 12,
  vignette: 12,
  service: 12,
  fuelCard: 36,
};

/** Szervizintervallum km-ben. */
export const SERVICE_INTERVAL_KM = 30_000;

function severity(daysLeft: number, kmLeft?: number): Obligation['severity'] {
  if (daysLeft < 0 || (kmLeft !== undefined && kmLeft < 0)) return 'overdue';
  if (daysLeft <= 7 || (kmLeft !== undefined && kmLeft <= 1000)) return 'urgent';
  if (daysLeft <= 30 || (kmLeft !== undefined && kmLeft <= 3000)) return 'soon';
  return 'ok';
}

export function obligationsFor(v: Vehicle, today = todayISO()): Obligation[] {
  if (v.status === 'retired') return [];
  const out: Obligation[] = [];
  const push = (type: ObligationType, due: ISODate | undefined, kmLeft?: number) => {
    if (!due) return;
    const daysLeft = daysBetween(today, due);
    out.push({
      key: `${v.id}:${type}`,
      vehicleId: v.id,
      type,
      label: OBLIGATION_LABELS[type],
      due,
      daysLeft,
      kmLeft,
      severity: severity(daysLeft, kmLeft),
    });
  };
  push('inspection', v.inspectionExpires);
  push('kgfb', v.kgfbExpires);
  push('casco', v.cascoExpires);
  push('vignette', v.vignetteExpires);
  push('service', v.serviceDueDate, v.serviceDueKm - v.odometer);
  push('fuelCard', v.fuelCard?.expires);
  return out;
}

export function allObligations(vehicles: Vehicle[], today = todayISO()): Obligation[] {
  return vehicles.flatMap((v) => obligationsFor(v, today)).sort((a, b) => a.daysLeft - b.daysLeft);
}

/** A 3D nézet jelvényéhez: a legsürgősebb, 30 napon belüli kötelezettség neve. */
export function urgentObligation(v: Vehicle, today = todayISO()): Obligation | undefined {
  return obligationsFor(v, today)
    .filter((o) => o.severity !== 'ok')
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];
}

export const SEVERITY_LABEL: Record<Obligation['severity'], string> = {
  overdue: 'Lejárt',
  urgent: '7 napon belül',
  soon: '30 napon belül',
  ok: 'Rendben',
};

/* ---------- útnyilvántartás ellenőrzése ---------- */

export interface TripIssue {
  index: number;
  level: 'error' | 'warn';
  text: string;
}

export function checkTripLog(log: TripLog, vehicle: Vehicle | undefined, rules: PolicyRules): TripIssue[] {
  const issues: TripIssue[] = [];
  const perDay: Record<string, number> = {};
  log.entries.forEach((e, i) => {
    const dist = e.endKm - e.startKm;
    if (dist < 0) issues.push({ index: i, level: 'error', text: 'A záró km kisebb, mint a kezdő.' });
    if (i > 0) {
      const prev = log.entries[i - 1];
      if (e.startKm !== prev.endKm) {
        const gap = e.startKm - prev.endKm;
        issues.push({
          index: i,
          level: 'error',
          text: gap > 0 ? `${fmtKm(gap)} hiányzik az előző úthoz képest.` : `${fmtKm(-gap)} átfedés az előző úttal.`,
        });
      }
    }
    if (e.kind === 'business' && !e.purpose.trim()) issues.push({ index: i, level: 'warn', text: 'Hiányzik az út célja.' });
    if (e.kind === 'business' && dist > rules.orderOverKm && !e.orderNo) {
      issues.push({ index: i, level: 'error', text: `${fmtKm(dist)} üzleti út kiküldetési rendelvény nélkül.` });
    }
    if (e.kind === 'private' && vehicle && !vehicle.privateUse) {
      issues.push({ index: i, level: 'error', text: 'Magánhasználat, pedig a járműre nincs engedély (szabályzat).' });
    }
    if (rules.weekendNeedsApproval && isWeekend(e.date) && e.kind === 'business' && !e.orderNo) {
      issues.push({ index: i, level: 'warn', text: 'Hétvégi út: vezetői jóváhagyás szükséges.' });
    }
    perDay[e.date] = (perDay[e.date] ?? 0) + Math.max(0, dist);
  });
  Object.entries(perDay).forEach(([date, km]) => {
    if (km > rules.maxDailyKm) {
      const idx = log.entries.findIndex((e) => e.date === date);
      issues.push({ index: idx, level: 'warn', text: `Egy napon ${fmtKm(km)} – szokatlanul sok.` });
    }
  });
  return issues.sort((a, b) => a.index - b.index);
}

export const tripDistance = (log: TripLog) => log.entries.reduce((s, e) => s + Math.max(0, e.endKm - e.startKm), 0);

/* ---------- számlák ellenőrzése ---------- */

export function checkInvoice(inv: Invoice, all: Invoice[], vehicles: Vehicle[], today = todayISO()): { level: 'error' | 'warn'; text: string }[] {
  const out: { level: 'error' | 'warn'; text: string }[] = [];
  const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (inv.plate && !vehicles.some((v) => norm(v.plate) === norm(inv.plate))) {
    out.push({ level: 'error', text: `Ismeretlen rendszám: ${inv.plate}` });
  }
  if (!inv.plate && inv.category !== 'other' && inv.category !== 'fuel') out.push({ level: 'warn', text: 'Nincs járműhöz rendelve.' });
  if (all.some((x) => x.id !== inv.id && x.supplier === inv.supplier && x.number === inv.number)) {
    out.push({ level: 'error', text: 'Duplikált számla (azonos szállító és sorszám).' });
  }
  const d = daysBetween(today, inv.dueDate);
  if (inv.status !== 'forwarded' && d < 0) out.push({ level: 'error', text: `Fizetési határidő lejárt (${-d} napja).` });
  else if (inv.status !== 'forwarded' && d <= 3) out.push({ level: 'warn', text: `Fizetési határidő ${d} napon belül.` });
  if (inv.gross >= 300_000 && inv.category !== 'fuel') out.push({ level: 'warn', text: '300 000 Ft feletti: vezetői jóváhagyás kell.' });
  return out;
}

/* ---------- export ---------- */

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\r\n');
  // BOM, hogy az Excel helyesen olvassa az ékezeteket.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function printHTML(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:Inter,'Segoe UI',Arial,sans-serif;color:#18202b;margin:32px;font-size:13px}
h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #ccd;padding-bottom:4px}
table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccd;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f3f5f8} .muted{color:#667385} .sig{display:flex;gap:40px;margin-top:40px}
.sig div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center} img{max-height:70px}
.kpis{display:flex;gap:10px;flex-wrap:wrap} .kpi{border:1px solid #ccd;border-radius:8px;padding:8px 12px}
.kpi b{display:block;font-size:18px}
@media print{button{display:none}}
</style></head><body>${body}<p><button onclick="print()">Nyomtatás / mentés PDF-be</button></p></body></html>`);
  w.document.close();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** HTML-escape a nyomtatási nézetekhez (felhasználói szöveg kerül bele). */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/* ---------- gumicsere ---------- */

/** A kampányban: minden nem kivont, nem négyévszakos gumis jármű. Kész = már téli gumin van. */
export function tyreStats(vehicles: Vehicle[], jobs: Record<string, TyreJob>) {
  const inCampaign = vehicles.filter((v) => v.status !== 'retired' && v.tyres !== 'all' && (jobs[v.id] || v.tyres === 'winter'));
  const statusOf = (id: string): TyreJob['status'] => jobs[id]?.status ?? 'done';
  const done = inCampaign.filter((v) => statusOf(v.id) === 'done').length;
  const scheduled = inCampaign.filter((v) => statusOf(v.id) === 'scheduled').length;
  return { inCampaign, statusOf, done, scheduled, todo: inCampaign.length - done - scheduled, total: inCampaign.length };
}

export const hhmm = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
