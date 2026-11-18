import { allObligations, checkTripLog, downloadCSV, esc, fmtDate, fmtFt, fmtKm, monthLabel, previousMonth, todayISO, tyreStats } from '../../data/logic';
import { CATEGORY_LABELS, INVOICE_CATEGORY, STATUS_LABELS, TYRE_LABELS, type InvoiceCategory } from '../../data/types';
import { branchById, useFleet } from '../../state/store';
import { printHTML } from '../../data/logic';
import { Card, Kpi, Page } from '../common';

export function Report() {
  const s = useFleet();
  const today = todayISO();
  const obligations = allObligations(s.vehicles, today);
  const overdue = obligations.filter((o) => o.severity === 'overdue');
  const soon = obligations.filter((o) => o.severity === 'urgent' || o.severity === 'soon');
  const openDamages = s.damages.filter((d) => d.status !== 'closed');
  const month = previousMonth();
  const logs = s.tripLogs.filter((t) => t.month === month);
  const okLogs = logs.filter((t) => t.status === 'approved' || (t.status === 'submitted' && !checkTripLog(t, s.vehicles.find((v) => v.id === t.vehicleId), s.rules).some((i) => i.level === 'error')));
  const { total: tyreTotal, done: tyreDone } = tyreStats(s.vehicles, s.tyreJobs);

  const byCat = Object.keys(INVOICE_CATEGORY).map((c) => [c, s.invoices.filter((i) => i.category === c).reduce((a, i) => a + i.gross, 0)] as [InvoiceCategory, number]);
  const invoiceTotal = byCat.reduce((a, [, n]) => a + n, 0);
  const maxCat = Math.max(...byCat.map(([, n]) => n), 1);

  const perVehicleCost = s.vehicles
    .map((v) => ({ v, cost: s.invoices.filter((i) => i.plate === v.plate).reduce((a, i) => a + i.gross, 0) + s.damages.filter((d) => d.vehicleId === v.id && d.coverage === 'own').reduce((a, d) => a + d.estimate, 0) }))
    .filter((x) => x.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  const branchRows = s.branches.map((b) => {
    const vs = s.vehicles.filter((v) => v.homeBranchId === b.id);
    const ids = new Set(vs.map((v) => v.id));
    return {
      b,
      total: vs.length,
      out: vs.filter((v) => v.slot < 0).length,
      service: vs.filter((v) => v.status === 'service').length,
      overdue: overdue.filter((o) => ids.has(o.vehicleId)).length,
      soon: soon.filter((o) => ids.has(o.vehicleId)).length,
      damages: openDamages.filter((d) => ids.has(d.vehicleId)).length,
    };
  });

  const print = () => {
    const tr = (cells: (string | number)[]) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
    printHTML(
      'Flotta vezetői riport',
      `<h1>Flotta vezetői riport</h1><p class="muted">Készült: ${fmtDate(today)}</p>
<div class="kpis">
<div class="kpi"><b>${s.vehicles.length}</b>jármű</div><div class="kpi"><b>${s.vehicles.filter((v) => v.slot < 0).length}</b>kiadva</div>
<div class="kpi"><b>${overdue.length}</b>lejárt határidő</div><div class="kpi"><b>${soon.length}</b>30 napon belül</div>
<div class="kpi"><b>${openDamages.length}</b>nyitott kárügy</div><div class="kpi"><b>${tyreDone}/${tyreTotal}</b>gumicsere kész</div>
<div class="kpi"><b>${logs.length ? Math.round((okLogs.length / logs.length) * 100) : 100}%</b>rendben lévő útnyilvántartás (${esc(monthLabel(month))})</div></div>
<h2>Telephelyek</h2><table><tr><th>Telephely</th><th>Jármű</th><th>Kiadva</th><th>Szervizben</th><th>Lejárt</th><th>30 napon belül</th><th>Nyitott kár</th></tr>
${branchRows.map((r) => tr([r.b.city, r.total, r.out, r.service, r.overdue, r.soon, r.damages])).join('')}</table>
<h2>Lejárt határidők</h2><table><tr><th>Rendszám</th><th>Kötelezettség</th><th>Határidő</th><th>Telephely</th></tr>
${overdue.map((o) => { const v = s.vehicles.find((x) => x.id === o.vehicleId)!; return tr([v.plate, o.label, fmtDate(o.due), branchById(v.homeBranchId).city]); }).join('') || '<tr><td colspan="4">Nincs.</td></tr>'}</table>
<h2>Nyitott kárügyek</h2><table><tr><th>Rendszám</th><th>Dátum</th><th>Leírás</th><th>Becsült kár</th></tr>
${openDamages.map((d) => tr([s.vehicles.find((v) => v.id === d.vehicleId)!.plate, fmtDate(d.date), d.description, fmtFt(d.estimate)])).join('')}</table>
<h2>Költségek kategóriánként (rögzített számlák)</h2><table>${byCat.map(([c, n]) => tr([INVOICE_CATEGORY[c], fmtFt(n)])).join('')}${tr(['Összesen', fmtFt(invoiceTotal)])}</table>`,
    );
  };

  const exportFleet = () =>
    downloadCSV(`flotta-${today}.csv`, [
      ['Rendszám', 'Gyártmány', 'Típus', 'Kategória', 'Évjárat', 'Állapot', 'Telephely', 'Kinél', 'Km-óra', 'Forgalmi', 'Műszaki', 'KGFB', 'Casco', 'Matrica', 'Szerviz dátum', 'Szerviz km', 'Tankkártya', 'Gumi'],
      ...s.vehicles.map((v) => [
        v.plate, v.make, v.model, CATEGORY_LABELS[v.category], v.year, STATUS_LABELS[v.status], branchById(v.homeBranchId).city, v.assignedTo ?? '',
        v.odometer, v.registrationNo, v.inspectionExpires, v.kgfbExpires, v.cascoExpires ?? '', v.vignetteExpires ?? '', v.serviceDueDate, v.serviceDueKm,
        v.fuelCard ? `${v.fuelCard.provider} ${v.fuelCard.number}` : '', TYRE_LABELS[v.tyres],
      ]),
    ]);

  return (
    <Page
      title="Vezetői riport"
      subtitle="Összefoglaló a vezetőségnek: flotta, határidők, kárügyek, költségek, megfelelés."
      actions={
        <>
          <button className="btn" onClick={exportFleet} title="Teljes járműnyilvántartás – Excelben vagy a MiniCRM importjában is használható">
            Járműnyilvántartás (CSV)
          </button>
          <button className="btn btn-primary" onClick={print}>
            Nyomtatható riport / PDF
          </button>
        </>
      }
    >
      <div className="kpi-row">
        <Kpi label="Jármű" value={s.vehicles.length} />
        <Kpi label="Kiadva" value={s.vehicles.filter((v) => v.slot < 0).length} />
        <Kpi label="Lejárt határidő" value={overdue.length} tone="danger" />
        <Kpi label="30 napon belül" value={soon.length} tone="warn" />
        <Kpi label={`Nyitott kárügy · becsült ${fmtFt(openDamages.reduce((a, d) => a + d.estimate, 0))}`} value={openDamages.length} />
        <Kpi label="Gumicsere kész" value={`${tyreDone}/${tyreTotal}`} />
        <Kpi label={`Rendben lévő útnyilv. (${monthLabel(month)})`} value={`${logs.length ? Math.round((okLogs.length / logs.length) * 100) : 100}%`} />
      </div>

      <div className="grid-2">
        <Card title="Telephelyek">
          <table className="table">
            <thead>
              <tr>
                <th>Telephely</th>
                <th className="num">Jármű</th>
                <th className="num">Kiadva</th>
                <th className="num">Szervizben</th>
                <th className="num">Lejárt</th>
                <th className="num">30 nap</th>
                <th className="num">Nyitott kár</th>
              </tr>
            </thead>
            <tbody>
              {branchRows.map((r) => (
                <tr key={r.b.id}>
                  <td>
                    <span className="branch-dot" style={{ background: r.b.color }} /> {r.b.city}
                  </td>
                  <td className="num">{r.total}</td>
                  <td className="num">{r.out}</td>
                  <td className="num">{r.service}</td>
                  <td className={`num ${r.overdue ? 'warn' : ''}`}>{r.overdue}</td>
                  <td className="num">{r.soon}</td>
                  <td className="num">{r.damages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={`Költségek kategóriánként · ${fmtFt(invoiceTotal)}`}>
          <ul className="bars">
            {byCat.map(([c, n]) => (
              <li key={c}>
                <span>{INVOICE_CATEGORY[c]}</span>
                <span className="bar">
                  <span style={{ width: `${(n / maxCat) * 100}%` }} />
                </span>
                <span className="num">{fmtFt(n)}</span>
              </li>
            ))}
          </ul>
          <h3>Legköltségesebb járművek</h3>
          <ul className="mini-list">
            {perVehicleCost.map(({ v, cost }) => (
              <li key={v.id}>
                <strong>{v.plate}</strong>
                <span>
                  {v.make} {v.model}
                </span>
                <span className="muted">{fmtKm(v.odometer)}</span>
                <span className="num">{fmtFt(cost)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="hint">
        A költségek a rögzített számlákból és a saját költséges kárügyekből számolódnak. Éles rendszerben a tankkártya-tranzakciók és a MiniCRM adatai
        automatikusan bekerülnének.
      </p>
    </Page>
  );
}
