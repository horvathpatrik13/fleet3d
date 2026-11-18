import { useMemo, useState } from 'react';
import { checkTripLog, copyText, fmtDate, fmtKm, monthLabel, tripDistance } from '../../data/logic';
import { TRIP_STATUS, type TripLog, type TripLogStatus } from '../../data/types';
import { branchById, useFleet } from '../../state/store';
import { Card, Empty, Field, Modal, Page, VehicleCell } from '../common';

const STATUS_TONE: Record<TripLogStatus, string> = { missing: 'sev-urgent', submitted: 'chip-transit', approved: 'chip-active', returned: 'sev-overdue' };

export function Trips() {
  const tripLogs = useFleet((s) => s.tripLogs);
  const vehicles = useFleet((s) => s.vehicles);
  const rules = useFleet((s) => s.rules);
  const setRules = useFleet((s) => s.setRules);
  const months = [...new Set(tripLogs.map((t) => t.month))].sort().reverse();
  const [month, setMonth] = useState(months[0] ?? '');
  const [status, setStatus] = useState<TripLogStatus | ''>('');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      tripLogs
        .filter((t) => t.month === month && (!status || t.status === status))
        .map((t) => ({ t, issues: checkTripLog(t, vehicles.find((v) => v.id === t.vehicleId), rules) }))
        .sort((a, b) => b.issues.filter((i) => i.level === 'error').length - a.issues.filter((i) => i.level === 'error').length),
    [tripLogs, vehicles, rules, month, status],
  );

  const counts = Object.fromEntries(
    (Object.keys(TRIP_STATUS) as TripLogStatus[]).map((k) => [k, tripLogs.filter((t) => t.month === month && t.status === k).length]),
  );

  return (
    <Page
      title="Útnyilvántartás és kiküldetési rendelvények"
      subtitle="A beérkezett havi útnyilvántartások automatikus ellenőrzése: km-folytonosság, rendelvények, magánhasználat, hétvégi utak."
    >
      <div className="grid-side">
        <div className="stack">
          <div className="filters">
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <div className="segmented">
              <button aria-selected={status === ''} onClick={() => setStatus('')}>
                Mind
              </button>
              {(Object.keys(TRIP_STATUS) as TripLogStatus[]).map((k) => (
                <button key={k} aria-selected={status === k} onClick={() => setStatus(k)}>
                  {TRIP_STATUS[k]} ({counts[k]})
                </button>
              ))}
            </div>
          </div>
          <Card>
            {rows.length === 0 ? (
              <Empty>Nincs ilyen útnyilvántartás.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Jármű</th>
                    <th>Vezető</th>
                    <th>Állapot</th>
                    <th>Utak</th>
                    <th>Megtett út</th>
                    <th>Ellenőrzés</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ t, issues }) => {
                    const errors = issues.filter((i) => i.level === 'error').length;
                    const warns = issues.length - errors;
                    return (
                      <tr key={t.id}>
                        <td>
                          <VehicleCell id={t.vehicleId} />
                        </td>
                        <td>{t.entries[0]?.driver ?? vehicles.find((v) => v.id === t.vehicleId)?.assignedTo ?? '–'}</td>
                        <td>
                          <span className={`chip ${STATUS_TONE[t.status]}`}>{TRIP_STATUS[t.status]}</span>
                        </td>
                        <td>{t.entries.length}</td>
                        <td>{t.entries.length ? fmtKm(tripDistance(t)) : '–'}</td>
                        <td>
                          {t.status === 'missing' ? (
                            <span className="muted">–</span>
                          ) : errors + warns === 0 ? (
                            <span className="chip chip-active">Rendben</span>
                          ) : (
                            <>
                              {errors > 0 && <span className="chip sev-overdue">{errors} hiba</span>}{' '}
                              {warns > 0 && <span className="chip sev-soon">{warns} figyelmeztetés</span>}
                            </>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-sm" onClick={() => setOpen(t.id)}>
                            {t.status === 'missing' ? 'Bekérés' : 'Megnyitás'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card title="Szabályzat szerinti ellenőrzés">
          <Field label="Kiküldetési rendelvény kötelező e fölött (km)">
            <input type="number" value={rules.orderOverKm} onChange={(e) => setRules({ orderOverKm: Number(e.target.value) })} />
          </Field>
          <Field label="Napi km figyelmeztetési határ">
            <input type="number" value={rules.maxDailyKm} onChange={(e) => setRules({ maxDailyKm: Number(e.target.value) })} />
          </Field>
          <label className="check-line">
            <input type="checkbox" checked={rules.weekendNeedsApproval} onChange={(e) => setRules({ weekendNeedsApproval: e.target.checked })} /> Hétvégi
            üzleti úthoz jóváhagyás kell
          </label>
          <p className="hint">
            Mindig ellenőrzött: km-folytonosság az utak között, negatív távolság, hiányzó úticél, magánhasználat olyan járművel, amelyre nincs engedély.
            A szabályzat módosításakor itt állíthatók a határok.
          </p>
        </Card>
      </div>
      {open && <TripDetail id={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function TripDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useFleet((s) => s.tripLogs.find((x) => x.id === id)) as TripLog;
  const v = useFleet((s) => s.vehicles.find((x) => x.id === t.vehicleId))!;
  const rules = useFleet((s) => s.rules);
  const setTripStatus = useFleet((s) => s.setTripStatus);
  const toast = useFleet((s) => s.toast);
  const issues = checkTripLog(t, v, rules);
  const [note, setNote] = useState(
    issues
      .filter((i) => i.level === 'error')
      .map((i) => `${i.index + 1}. sor: ${i.text}`)
      .join('\n'),
  );
  const driver = t.entries[0]?.driver ?? v.assignedTo ?? 'Kolléga';

  if (t.status === 'missing') {
    const text = `Kedves ${driver}!\n\nA(z) ${v.plate} rendszámú jármű ${monthLabel(t.month)} havi útnyilvántartása még nem érkezett meg. Kérlek, pótold 3 munkanapon belül (a kiküldetési rendelvényekkel együtt).\n\nKöszönöm!\nFlottakezelés`;
    return (
      <Modal title={`Hiányzó útnyilvántartás – ${v.plate}`} onClose={onClose}>
        <pre className="report">{text}</pre>
        <p className="hint">Telephely: {branchById(v.homeBranchId).city}</p>
        <div className="modal-foot">
          <button className="btn" onClick={async () => toast((await copyText(text)) ? 'Bekérő levél vágólapra másolva.' : 'Nem sikerült másolni.')}>
            Levél másolása
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Kész
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Útnyilvántartás – ${v.plate}, ${monthLabel(t.month)}`} onClose={onClose} wide>
      <p className="muted">
        {v.make} {v.model} · {v.privateUse ? 'magánhasználat engedélyezett' : 'magánhasználat NEM engedélyezett'} · összesen {fmtKm(tripDistance(t))}
      </p>
      <div className="table-scroll">
        <table className="table table-compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Dátum</th>
              <th>Honnan → hová</th>
              <th>Cél</th>
              <th>Km</th>
              <th>Táv</th>
              <th>Jelleg</th>
              <th>Rendelvény</th>
              <th>Észrevétel</th>
            </tr>
          </thead>
          <tbody>
            {t.entries.map((e, i) => {
              const mine = issues.filter((x) => x.index === i);
              const level = mine.some((x) => x.level === 'error') ? 'row-error' : mine.length ? 'row-warn' : '';
              return (
                <tr key={i} className={level}>
                  <td>{i + 1}</td>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    {e.from} → {e.to}
                  </td>
                  <td>{e.purpose}</td>
                  <td>
                    {e.startKm.toLocaleString('hu-HU')} – {e.endKm.toLocaleString('hu-HU')}
                  </td>
                  <td>{fmtKm(e.endKm - e.startKm)}</td>
                  <td>{e.kind === 'business' ? 'Üzleti' : 'Magán'}</td>
                  <td>{e.orderNo ?? <span className="muted">–</span>}</td>
                  <td>
                    {mine.map((x, k) => (
                      <div key={k} className={`issue issue-${x.level}`}>
                        {x.level === 'error' ? '✕' : '!'} {x.text}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Field label="Megjegyzés a kollégának (visszaküldéskor)">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Bezárás
        </button>
        <button
          className="btn"
          disabled={!note.trim()}
          onClick={() => {
            setTripStatus(t.id, 'returned', note);
            onClose();
          }}
        >
          Visszaküldés javításra
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setTripStatus(t.id, 'approved');
            onClose();
          }}
        >
          {issues.some((i) => i.level === 'error') ? 'Elfogadás hibák ellenére' : 'Elfogadás'}
        </button>
      </div>
    </Modal>
  );
}
