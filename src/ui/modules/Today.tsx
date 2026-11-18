import { useMemo } from 'react';
import { allObligations, checkInvoice, checkTripLog, daysBetween, fmtDate, fmtDateTime, fmtFt, monthLabel, todayISO } from '../../data/logic';
import { DAMAGE_STATUS } from '../../data/types';
import { type Section, useFleet } from '../../state/store';
import { Card, Kpi, Page, Plate, SeverityChip } from '../common';

interface Todo {
  id: string;
  section: Section;
  action: string;
  text: React.ReactNode;
  meta?: React.ReactNode;
  weight: number;
}

export function Today() {
  const s = useFleet();
  const today = todayISO();

  const obligations = useMemo(() => allObligations(s.vehicles, today).filter((o) => o.severity !== 'ok'), [s.vehicles, today]);
  const vehicle = (id: string) => s.vehicles.find((v) => v.id === id)!;

  const todos: Todo[] = [];
  obligations
    .filter((o) => !s.reminders[o.key] && !s.appointments[o.key])
    .forEach((o) =>
      todos.push({
        id: o.key,
        section: 'deadlines',
        action: 'Emlékeztető',
        weight: o.severity === 'overdue' ? 0 : o.severity === 'urgent' ? 1 : 3,
        text: (
          <>
            <Plate v={vehicle(o.vehicleId)} /> {o.label} – emlékeztető vagy időpont kell
          </>
        ),
        meta: <SeverityChip o={o} />,
      }),
    );
  s.tripLogs
    .filter((t) => t.status === 'submitted')
    .forEach((t) => {
      const issues = checkTripLog(t, vehicle(t.vehicleId), s.rules);
      const errors = issues.filter((i) => i.level === 'error').length;
      todos.push({
        id: t.id,
        section: 'trips',
        action: 'Ellenőrzés',
        weight: 2,
        text: (
          <>
            <Plate v={vehicle(t.vehicleId)} /> útnyilvántartás ellenőrzése ({monthLabel(t.month)})
          </>
        ),
        meta: errors ? <span className="chip sev-overdue">{errors} hiba</span> : <span className="chip chip-active">hibátlannak tűnik</span>,
      });
    });
  s.tripLogs
    .filter((t) => t.status === 'missing')
    .forEach((t) =>
      todos.push({
        id: t.id,
        section: 'trips',
        action: 'Bekérés',
        weight: 2,
        text: (
          <>
            <Plate v={vehicle(t.vehicleId)} /> hiányzó útnyilvántartás bekérése ({monthLabel(t.month)})
          </>
        ),
        meta: <span className="chip sev-urgent">hiányzik</span>,
      }),
    );
  s.invoices
    .filter((i) => i.status === 'received' || i.status === 'checked')
    .forEach((i) => {
      const issues = checkInvoice(i, s.invoices, s.vehicles, today);
      todos.push({
        id: i.id,
        section: 'invoices',
        action: i.status === 'received' ? 'Ellenőrzés' : 'Továbbítás',
        weight: daysBetween(today, i.dueDate) <= 3 ? 1 : 3,
        text: (
          <>
            {i.status === 'received' ? 'Számla ellenőrzése' : 'Számla továbbítása a pénzügynek'}: {i.supplier}, {fmtFt(i.gross)}
          </>
        ),
        meta: issues.some((x) => x.level === 'error') ? (
          <span className="chip sev-overdue">eltérés</span>
        ) : (
          <span className="chip">határidő {fmtDate(i.dueDate)}</span>
        ),
      });
    });
  s.damages
    .filter((d) => d.status === 'recorded')
    .forEach((d) =>
      todos.push({
        id: d.id,
        section: 'damages',
        action: 'Bejelentés',
        weight: 1,
        text: (
          <>
            <Plate v={vehicle(d.vehicleId)} /> kárbejelentés a biztosítónak
          </>
        ),
        meta: <span className="chip sev-urgent">{DAMAGE_STATUS[d.status]}</span>,
      }),
    );

  todos.sort((a, b) => a.weight - b.weight);

  const tyreTodo = Object.values(s.tyreJobs).filter((j) => j.status === 'todo').length;
  const tyreToday = Object.entries(s.tyreJobs).filter(([, j]) => j.status === 'scheduled' && j.date === today);
  const apptSoon = Object.entries(s.appointments).filter(([, a]) => daysBetween(today, a.date) >= 0 && daysBetween(today, a.date) <= 2);
  const out = s.vehicles.filter((v) => v.slot < 0);

  return (
    <Page
      title="Mai teendők"
      subtitle={`${new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · minden, amivel ma foglalkozni kell, egy helyen`}
    >
      <div className="kpi-row">
        <Kpi label="Lejárt határidő" value={obligations.filter((o) => o.severity === 'overdue').length} tone="danger" onClick={() => s.setSection('deadlines')} />
        <Kpi label="30 napon belül lejár" value={obligations.filter((o) => o.severity !== 'overdue').length} tone="warn" onClick={() => s.setSection('deadlines')} />
        <Kpi label="Kiadott jármű" value={out.length} onClick={() => s.setSection('handover')} />
        <Kpi label="Nyitott kárügy" value={s.damages.filter((d) => d.status !== 'closed').length} onClick={() => s.setSection('damages')} />
        <Kpi label="Gumicsere hátra" value={tyreTodo} onClick={() => s.setSection('tyres')} />
        <Kpi label="Ellenőrizendő számla" value={s.invoices.filter((i) => i.status === 'received').length} onClick={() => s.setSection('invoices')} />
      </div>

      <div className="grid-2">
        <Card title={`Teendőlista (${todos.length})`}>
          {todos.length === 0 ? (
            <p className="hint">Nincs nyitott teendő.</p>
          ) : (
            <ul className="todo-list">
              {todos.slice(0, 18).map((t) => (
                <li key={t.id}>
                  <span className="todo-text">{t.text}</span>
                  {t.meta}
                  <button className="btn btn-sm" onClick={() => s.setSection(t.section)}>
                    {t.action}
                  </button>
                </li>
              ))}
              {todos.length > 18 && <li className="muted">…és még {todos.length - 18} tétel</li>}
            </ul>
          )}
        </Card>

        <div className="stack">
          <Card title="Időpontok a következő napokban">
            {apptSoon.length + tyreToday.length === 0 ? (
              <p className="hint">Nincs foglalt időpont a következő 2 napra.</p>
            ) : (
              <ul className="mini-list">
                {apptSoon.map(([key, a]) => (
                  <li key={key}>
                    <Plate v={vehicle(key.split(':')[0])} />
                    <span>{a.partner}</span>
                    <span className="muted">
                      {fmtDate(a.date)} {a.time}
                    </span>
                  </li>
                ))}
                {tyreToday.map(([id, j]) => (
                  <li key={id}>
                    <Plate v={vehicle(id)} />
                    <span>Gumicsere – {j.partner}</span>
                    <span className="muted">ma {j.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Legutóbbi tevékenység">
            {s.activity.length === 0 ? (
              <p className="hint">Itt jelenik meg minden rögzített művelet (kiadás, emlékeztető, számla-továbbítás…).</p>
            ) : (
              <ul className="activity">
                {s.activity.slice(0, 10).map((a, i) => (
                  <li key={i}>
                    <time>{fmtDateTime(a.at)}</time> {a.text}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
