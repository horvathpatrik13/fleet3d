import { useState } from 'react';
import { addDays, copyText, downloadCSV, fmtDate, todayISO, tyreStats } from '../../data/logic';
import { tyrePartner } from '../../data/seed';
import { TYRE_LABELS } from '../../data/types';
import { useFleet } from '../../state/store';
import { Card, Page, VehicleCell } from '../common';

export function Tyres() {
  const vehicles = useFleet((s) => s.vehicles);
  const tyreJobs = useFleet((s) => s.tyreJobs);
  const branches = useFleet((s) => s.branches);
  const scheduleTyre = useFleet((s) => s.scheduleTyre);
  const autoScheduleTyres = useFleet((s) => s.autoScheduleTyres);
  const completeTyre = useFleet((s) => s.completeTyre);
  const toast = useFleet((s) => s.toast);
  const [perDay, setPerDay] = useState(4);

  const year = new Date().getFullYear();
  const { inCampaign, statusOf, done, scheduled, todo } = tyreStats(vehicles, tyreJobs);

  const partnerMail = (branchId: string) => {
    const partner = tyrePartner(branchId);
    const list = inCampaign
      .filter((v) => v.homeBranchId === branchId && statusOf(v.id) === 'scheduled')
      .sort((a, b) => `${tyreJobs[a.id].date}${tyreJobs[a.id].time}`.localeCompare(`${tyreJobs[b.id].date}${tyreJobs[b.id].time}`))
      .map((v) => `• ${fmtDate(tyreJobs[v.id].date)} ${tyreJobs[v.id].time} – ${v.plate} (${v.make} ${v.model})`);
    return `Tisztelt ${partner}!\n\nA téli gumicserére az alábbi időpontokat szeretnénk lefoglalni:\n\n${list.join('\n')}\n\nKérjük, visszaigazolásukat. A téli gumik a járművekkel érkeznek / Önöknél vannak tárolva.\n\nKöszönettel:\nFlottakezelés`;
  };

  return (
    <Page
      title={`Téli gumicsere – ${year}`}
      subtitle="Nyári gumis járművek ütemezése a telephelyek gumiszervizeihez, napi kapacitással, hétvégék nélkül."
      actions={
        <>
          <button
            className="btn"
            onClick={() =>
              downloadCSV(`gumicsere-${year}.csv`, [
                ['Rendszám', 'Jármű', 'Telephely', 'Állapot', 'Dátum', 'Időpont', 'Szerviz'],
                ...inCampaign.map((v) => {
                  const j = tyreJobs[v.id];
                  return [v.plate, `${v.make} ${v.model}`, branches.find((b) => b.id === v.homeBranchId)!.city, statusOf(v.id), j?.date ?? '', j?.time ?? '', j?.partner ?? ''];
                }),
              ])
            }
          >
            Export (CSV)
          </button>
        </>
      }
    >
      <Card>
        <div className="campaign">
          <div
            className="progress"
            role="progressbar"
            aria-label="Gumicsere-kampány: kész"
            aria-valuemin={0}
            aria-valuemax={inCampaign.length}
            aria-valuenow={done}
          >
            <span className="progress-done" style={{ width: `${(done / inCampaign.length) * 100}%` }} />
            <span className="progress-sched" style={{ width: `${(scheduled / inCampaign.length) * 100}%` }} />
          </div>
          <div className="campaign-legend">
            <span>
              <i className="dot dot-done" /> Kész: <strong>{done}</strong>
            </span>
            <span>
              <i className="dot dot-sched" /> Ütemezve: <strong>{scheduled}</strong>
            </span>
            <span>
              <i className="dot" /> Hátra: <strong>{todo}</strong>
            </span>
            <span className="spacer" />
            <label>
              Napi kapacitás szervizenként{' '}
              <input type="number" min={1} max={12} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} className="input-xs" />
            </label>
            <button
              className="btn btn-primary"
              disabled={todo === 0}
              onClick={() => {
                const n = autoScheduleTyres(perDay);
                toast(`${n} jármű beütemezve.`);
              }}
            >
              Hátralévők automatikus ütemezése
            </button>
          </div>
        </div>
      </Card>

      <div className="grid-2">
        {branches.map((b) => {
          const list = inCampaign.filter((v) => v.homeBranchId === b.id);
          return (
            <Card
              key={b.id}
              title={
                <>
                  <span className="branch-dot" style={{ background: b.color }} /> {b.city} – {tyrePartner(b.id)}
                </>
              }
              actions={
                <button className="btn btn-sm" onClick={async () => toast((await copyText(partnerMail(b.id))) ? 'Foglalási levél vágólapra másolva.' : 'Nem sikerült másolni.')}>
                  Levél a szerviznek
                </button>
              }
            >
              <table className="table table-compact">
                <tbody>
                  {list.map((v) => {
                    const st = statusOf(v.id);
                    const j = tyreJobs[v.id];
                    return (
                      <tr key={v.id}>
                        <td>
                          <VehicleCell id={v.id} />
                        </td>
                        <td>
                          <small className="muted">most: {TYRE_LABELS[v.tyres]}</small>
                          {v.assignedTo && (
                            <>
                              <br />
                              <small className="muted">Kiadva: {v.assignedTo}</small>
                            </>
                          )}
                        </td>
                        <td>
                          {st === 'done' ? (
                            <span className="chip chip-active">Kész</span>
                          ) : (
                            <span className="inline-inputs">
                              <input
                                aria-label={`Gumicsere dátuma – ${v.plate}`}
                                type="date"
                                value={j?.date ?? ''}
                                min={todayISO()}
                                onChange={(e) =>
                                  scheduleTyre(v.id, {
                                    status: e.target.value ? 'scheduled' : 'todo',
                                    date: e.target.value,
                                    time: j?.time ?? '09:00',
                                    partner: tyrePartner(b.id),
                                  })
                                }
                              />
                              <input
                                aria-label={`Gumicsere időpontja – ${v.plate}`}
                                type="time"
                                value={j?.time ?? ''}
                                disabled={!j?.date}
                                onChange={(e) => scheduleTyre(v.id, { ...j, status: 'scheduled', time: e.target.value })}
                              />
                            </span>
                          )}
                        </td>
                        <td>
                          {st === 'scheduled' && (
                            <button className="btn btn-sm" onClick={() => completeTyre(v.id)}>
                              Kicserélve
                            </button>
                          )}
                          {st === 'todo' && (
                            <button
                              className="btn btn-sm"
                              onClick={() => scheduleTyre(v.id, { status: 'scheduled', date: addDays(todayISO(), 1), time: '09:00', partner: tyrePartner(b.id) })}
                            >
                              Holnapra
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
