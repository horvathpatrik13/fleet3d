import { useMemo, useState } from 'react';
import { addDays, allObligations, copyText, downloadCSV, fmtDate, fmtDateTime, OBLIGATION_LABELS, SEVERITY_LABEL, todayISO } from '../../data/logic';
import { SERVICE_PARTNERS } from '../../data/seed';
import type { Obligation, ObligationType } from '../../data/types';
import { branchById, renewalDefault, useFleet } from '../../state/store';
import { Card, DueCell, Empty, Field, Modal, Page, SeverityChip, VehicleCell } from '../common';

type Scope = 'attention' | 'overdue' | 'all';

export function Deadlines() {
  const vehicles = useFleet((s) => s.vehicles);
  const reminders = useFleet((s) => s.reminders);
  const appointments = useFleet((s) => s.appointments);
  const branches = useFleet((s) => s.branches);
  const [scope, setScope] = useState<Scope>('attention');
  const [type, setType] = useState<ObligationType | ''>('');
  const [branch, setBranch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remind, setRemind] = useState<Obligation[] | null>(null);
  const [book, setBook] = useState<Obligation | null>(null);
  const [done, setDone] = useState<Obligation | null>(null);

  const all = useMemo(() => allObligations(vehicles), [vehicles]);
  const list = all.filter((o) => {
    if (scope === 'attention' && o.severity === 'ok') return false;
    if (scope === 'overdue' && o.severity !== 'overdue') return false;
    if (type && o.type !== type) return false;
    const v = vehicles.find((x) => x.id === o.vehicleId)!;
    if (branch && v.homeBranchId !== branch) return false;
    return true;
  });

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const allChecked = list.length > 0 && list.every((o) => selected.has(o.key));

  const exportCSV = () =>
    downloadCSV(`hataridok-${todayISO()}.csv`, [
      ['Rendszám', 'Jármű', 'Telephely', 'Kötelezettség', 'Határidő', 'Hátralévő nap', 'Állapot', 'Emlékeztető', 'Időpont'],
      ...list.map((o) => {
        const v = vehicles.find((x) => x.id === o.vehicleId)!;
        const a = appointments[o.key];
        return [
          v.plate,
          `${v.make} ${v.model}`,
          branchById(v.homeBranchId).city,
          o.label,
          o.due,
          o.daysLeft,
          SEVERITY_LABEL[o.severity],
          reminders[o.key] ? fmtDateTime(reminders[o.key].sentAt) : '',
          a ? `${a.date} ${a.time} ${a.partner}` : '',
        ];
      }),
    ]);

  return (
    <Page
      title="Határidők és emlékeztetők"
      subtitle="Műszaki vizsga, biztosítások, matrica, szerviz (dátum és km), üzemanyagkártya – egy listában, sürgősség szerint."
      actions={
        <>
          <button className="btn" onClick={exportCSV}>
            Export (CSV)
          </button>
          <button
            className="btn btn-primary"
            disabled={selected.size === 0}
            onClick={() => setRemind(all.filter((o) => selected.has(o.key)))}
          >
            Emlékeztető küldése ({selected.size})
          </button>
        </>
      }
    >
      <div className="filters">
        <div className="segmented">
          {(
            [
              ['attention', 'Figyelmet igényel'],
              ['overdue', 'Csak lejárt'],
              ['all', 'Mind'],
            ] as [Scope, string][]
          ).map(([k, l]) => (
            <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)}>
              {l}
            </button>
          ))}
        </div>
        <select aria-label="Kötelezettség típusa" value={type} onChange={(e) => setType(e.target.value as ObligationType | '')}>
          <option value="">Minden típus</option>
          {Object.entries(OBLIGATION_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="Telephely" value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Minden telephely</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.city}
            </option>
          ))}
        </select>
        <span className="muted">{list.length} tétel</span>
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty>Nincs a szűrésnek megfelelő határidő.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Mind kijelölése"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(list.map((o) => o.key)))}
                  />
                </th>
                <th>Jármű</th>
                <th>Kötelezettség</th>
                <th>Határidő</th>
                <th>Sürgősség</th>
                <th>Emlékeztető</th>
                <th>Időpont</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const r = reminders[o.key];
                const a = appointments[o.key];
                return (
                  <tr key={o.key} className={selected.has(o.key) ? 'is-selected' : ''}>
                    <td>
                      <input type="checkbox" aria-label="Kijelölés" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
                    </td>
                    <td>
                      <VehicleCell id={o.vehicleId} />
                    </td>
                    <td>{o.label}</td>
                    <td>
                      <DueCell o={o} />
                    </td>
                    <td>
                      <SeverityChip o={o} />
                    </td>
                    <td>{r ? <small>✓ {fmtDateTime(r.sentAt)}</small> : <span className="muted">–</span>}</td>
                    <td>
                      {a ? (
                        <small>
                          {fmtDate(a.date)} {a.time}
                          <br />
                          {a.partner}
                        </small>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                    <td className="row-actions">
                      {o.type !== 'kgfb' && o.type !== 'casco' && o.type !== 'vignette' && o.type !== 'fuelCard' && (
                        <button className="btn btn-sm" onClick={() => setBook(o)}>
                          Időpont
                        </button>
                      )}
                      <button className="btn btn-sm" onClick={() => setDone(o)}>
                        Elvégezve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {remind && (
        <ReminderModal
          items={remind}
          onClose={() => {
            setRemind(null);
            setSelected(new Set());
          }}
        />
      )}
      {book && <BookModal o={book} onClose={() => setBook(null)} />}
      {done && <DoneModal o={done} onClose={() => setDone(null)} />}
    </Page>
  );
}

function ReminderModal({ items, onClose }: { items: Obligation[]; onClose: () => void }) {
  const vehicles = useFleet((s) => s.vehicles);
  const sendReminders = useFleet((s) => s.sendReminders);
  const toast = useFleet((s) => s.toast);

  // Címzett: a jármű kollégája (ha ki van adva) és a telephely vezetője – telephelyenként egy levél.
  const groups = useMemo(() => {
    const g: Record<string, Obligation[]> = {};
    items.forEach((o) => {
      const v = vehicles.find((x) => x.id === o.vehicleId)!;
      (g[v.homeBranchId] ??= []).push(o);
    });
    return Object.entries(g);
  }, [items, vehicles]);

  return (
    <Modal title="Emlékeztetők" onClose={onClose} wide>
      <p className="hint">
        Telephelyenként egy összesítő levél készül a vezetőnek. Másold ki vagy nyisd meg a levelezőben, majd jelöld kiküldöttnek. (Éles rendszerben ez
        automatikusan, ütemezve menne ki.)
      </p>
      {groups.map(([branchId, obs]) => {
        const b = branchById(branchId);
        const lines = obs.map((o) => {
          const v = vehicles.find((x) => x.id === o.vehicleId)!;
          const km = o.type === 'service' && o.kmLeft !== undefined && o.kmLeft <= 3000 ? (o.kmLeft < 0 ? `, km-határ túllépve ${-o.kmLeft} km-rel` : `, még ${o.kmLeft} km`) : '';
          const when = (o.daysLeft < 0 ? `LEJÁRT ${-o.daysLeft} napja` : `${o.daysLeft} nap múlva`) + km;
          return `• ${v.plate} (${v.make} ${v.model}${v.assignedTo ? `, használja: ${v.assignedTo}` : ''}) – ${o.label}: ${fmtDate(o.due)} (${when})`;
        });
        const subject = `Flotta – lejáró határidők (${b.city}, ${obs.length} tétel)`;
        const body = `Kedves ${b.manager}!\n\nAz alábbi járműveknél hamarosan lejár (vagy már lejárt) egy kötelezettség:\n\n${lines.join('\n')}\n\nKérlek, jelezd, mikor tudjuk az időpontokat egyeztetni.\n\nKöszönöm!\nFlottakezelés`;
        return (
          <div key={branchId} className="mail-preview">
            <div className="mail-head">
              <div>
                <strong>Címzett:</strong> {b.manager} &lt;{b.managerEmail}&gt;
                <br />
                <strong>Tárgy:</strong> {subject}
              </div>
              <div className="row-actions">
                <button
                  className="btn btn-sm"
                  onClick={async () => toast((await copyText(body)) ? 'Levél vágólapra másolva.' : 'Nem sikerült másolni.', 'info')}
                >
                  Másolás
                </button>
                <a className="btn btn-sm" href={`mailto:${b.managerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
                  Megnyitás levelezőben
                </a>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    sendReminders(
                      obs.map((o) => o.key),
                      b.managerEmail,
                    )
                  }
                >
                  Kiküldöttnek jelöl
                </button>
              </div>
            </div>
            <pre>{body}</pre>
          </div>
        );
      })}
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Bezárás
        </button>
      </div>
    </Modal>
  );
}

function BookModal({ o, onClose }: { o: Obligation; onClose: () => void }) {
  const v = useFleet((s) => s.vehicles.find((x) => x.id === o.vehicleId))!;
  const existing = useFleet((s) => s.appointments[o.key]);
  const bookAppointment = useFleet((s) => s.bookAppointment);
  const partners = [...SERVICE_PARTNERS[v.homeBranchId], 'Vizsgaállomás (műszaki)'];
  const [date, setDate] = useState(existing?.date ?? addDays(todayISO(), 3));
  const [time, setTime] = useState(existing?.time ?? '09:00');
  const [partner, setPartner] = useState(existing?.partner ?? (o.type === 'inspection' ? partners[2] : v.servicePartner));
  return (
    <Modal title={`Időpontfoglalás – ${v.plate}, ${o.label}`} onClose={onClose}>
      <div className="form-grid">
        <Field label="Dátum">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Időpont">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Partner">
          <input list="partners" value={partner} onChange={(e) => setPartner(e.target.value)} />
          <datalist id="partners">
            {partners.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>
      {v.assignedTo && <p className="hint">A jármű most {v.assignedTo} kollégánál van – az időpontot vele is egyeztesd.</p>}
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Mégse
        </button>
        <button
          className="btn btn-primary"
          disabled={!date || !partner}
          onClick={() => {
            bookAppointment(o.key, { date, time, partner });
            onClose();
          }}
        >
          Mentés
        </button>
      </div>
    </Modal>
  );
}

function DoneModal({ o, onClose }: { o: Obligation; onClose: () => void }) {
  const v = useFleet((s) => s.vehicles.find((x) => x.id === o.vehicleId))!;
  const completeObligation = useFleet((s) => s.completeObligation);
  const [due, setDue] = useState(renewalDefault(o.type));
  return (
    <Modal title={`${o.label} elvégezve – ${v.plate}`} onClose={onClose}>
      <Field label="Új érvényesség / következő határidő" hint="Az alapértelmezés a szokásos megújítási idő; írd át a papír szerinti dátumra.">
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      {o.type === 'service' && <p className="hint">A következő szerviz km-határa a mostani km-óra + 30 000 km lesz.</p>}
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Mégse
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            completeObligation(o.key, due);
            onClose();
          }}
        >
          Rögzítés
        </button>
      </div>
    </Modal>
  );
}
