import { useEffect, useState } from 'react';
import { copyText, esc, fmtDate, fmtDateTime, fmtFt, printHTML, todayISO } from '../../data/logic';
import { PEOPLE } from '../../data/seed';
import { DAMAGE_FLOW, DAMAGE_STATUS, type Damage } from '../../data/types';
import { useFleet } from '../../state/store';
import { Field, Modal, Page, VehicleCell, VehicleSelect } from '../common';

const COVERAGE = { kgfb: 'KGFB (a vétkes fél biztosítója)', casco: 'Casco', own: 'Saját költség' } as const;
const FAULT = { own: 'Saját hibás', third: 'Vétlen (harmadik fél)', unknown: 'Ismeretlen / tisztázatlan' } as const;

export function Damages() {
  const damages = useFleet((s) => s.damages);
  const draft = useFleet((s) => s.draft);
  const clearDraft = useFleet((s) => s.clearDraft);
  const [creating, setCreating] = useState<string | null>(null);
  const [open, setOpen] = useState<Damage | null>(null);

  useEffect(() => {
    if (draft?.section === 'damages') {
      setCreating(draft.vehicleId ?? '');
      clearDraft();
    }
  }, [draft, clearDraft]);

  return (
    <Page
      title="Kárügyek"
      subtitle="Káresemények rögzítése, kárbejelentés a biztosítónak, a javítás nyomon követése a lezárásig."
      actions={
        <button className="btn btn-primary" onClick={() => setCreating('')}>
          + Új káresemény
        </button>
      }
    >
      <div className="kanban">
        {DAMAGE_FLOW.map((st) => {
          const items = damages.filter((d) => d.status === st);
          return (
            <div key={st} className="kanban-col">
              <h3>
                {DAMAGE_STATUS[st]} <span className="muted">{items.length}</span>
              </h3>
              {items.map((d) => (
                <button key={d.id} className="kanban-card" onClick={() => setOpen(d)}>
                  <VehicleCell id={d.vehicleId} />
                  <p>{d.description}</p>
                  <small className="muted">
                    {fmtDate(d.date)} · {d.driver} · becsült {fmtFt(d.estimate)}
                  </small>
                  {d.claimNo && <small className="muted">Kárszám: {d.claimNo}</small>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {creating !== null && <NewDamage vehicleId={creating} onClose={() => setCreating(null)} />}
      {open && <DamageDetail id={open.id} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function NewDamage({ vehicleId: initial, onClose }: { vehicleId: string; onClose: () => void }) {
  const addDamage = useFleet((s) => s.addDamage);
  const vehicles = useFleet((s) => s.vehicles);
  const [vehicleId, setVehicleId] = useState(initial);
  const v = vehicles.find((x) => x.id === vehicleId);
  const [driver, setDriver] = useState(v?.assignedTo ?? '');
  const [date, setDate] = useState(todayISO());
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [fault, setFault] = useState<Damage['fault']>('unknown');
  const [coverage, setCoverage] = useState<Damage['coverage']>('casco');
  const [estimate, setEstimate] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const ok = vehicleId && description.trim() && driver.trim();

  return (
    <Modal title="Új káresemény" onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Jármű">
          <VehicleSelect
            value={vehicleId}
            onChange={(id) => {
              setVehicleId(id);
              setDriver(vehicles.find((x) => x.id === id)?.assignedTo ?? driver);
            }}
          />
        </Field>
        <Field label="Vezető">
          <input list="people-d" value={driver} onChange={(e) => setDriver(e.target.value)} />
          <datalist id="people-d">
            {PEOPLE.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Dátum">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Helyszín">
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Település, utca / útszakasz" />
        </Field>
        <Field label="Felelősség">
          <select value={fault} onChange={(e) => setFault(e.target.value as Damage['fault'])}>
            {Object.entries(FAULT).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fedezet">
          <select value={coverage} onChange={(e) => setCoverage(e.target.value as Damage['coverage'])}>
            {Object.entries(COVERAGE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Becsült kár (Ft)">
          <input type="number" value={estimate || ''} onChange={(e) => setEstimate(Number(e.target.value))} />
        </Field>
        <Field label="Fotók" hint="A prototípus csak megjeleníti őket, nem menti el.">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos([...(e.target.files ?? [])].map((f) => URL.createObjectURL(f)))}
          />
        </Field>
      </div>
      <Field label="Mi történt?">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {photos.length > 0 && (
        <div className="photos">
          {photos.map((p) => (
            <img key={p} src={p} alt="kárfotó" />
          ))}
        </div>
      )}
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Mégse
        </button>
        <button
          className="btn btn-primary"
          disabled={!ok}
          onClick={() => {
            addDamage({ vehicleId, driver, date, place, description, fault, coverage, estimate });
            onClose();
          }}
        >
          Rögzítés
        </button>
      </div>
    </Modal>
  );
}

function DamageDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useFleet((s) => s.damages.find((x) => x.id === id))!;
  const v = useFleet((s) => s.vehicles.find((x) => x.id === d.vehicleId))!;
  const advanceDamage = useFleet((s) => s.advanceDamage);
  const toast = useFleet((s) => s.toast);
  const [claimNo, setClaimNo] = useState(d.claimNo ?? '');
  const [note, setNote] = useState('');

  const report = `KÁRBEJELENTÉS\n\nBiztosítás: ${COVERAGE[d.coverage]}\nRendszám: ${v.plate}\nTípus: ${v.make} ${v.model} (${v.year})\nForgalmi engedély: ${v.registrationNo}\nKáridő: ${fmtDate(d.date)}\nHelyszín: ${d.place}\nVezető: ${d.driver}\nFelelősség: ${FAULT[d.fault]}\n\nLeírás:\n${d.description}\n\nBecsült kár: ${fmtFt(d.estimate)}`;
  const nextLabel: Record<string, string> = {
    recorded: 'Bejelentve a biztosítónak',
    reported: 'Javítás megkezdődött',
    repair: 'Lezárás',
  };

  return (
    <Modal title={`Kárügy – ${v.plate}`} onClose={onClose} wide>
      <div className="steps">
        {DAMAGE_FLOW.map((st) => (
          <span key={st} className={`step ${DAMAGE_FLOW.indexOf(st) <= DAMAGE_FLOW.indexOf(d.status) ? 'is-done' : ''}`}>
            {DAMAGE_STATUS[st]}
          </span>
        ))}
      </div>
      <div className="grid-2">
        <div>
          <pre className="report">{report}</pre>
          <div className="row-actions">
            <button className="btn btn-sm" onClick={async () => toast((await copyText(report)) ? 'Kárbejelentő vágólapra másolva.' : 'Nem sikerült másolni.')}>
              Kárbejelentő másolása
            </button>
            <button
              className="btn btn-sm"
              onClick={() =>
                printHTML('Kárbejelentő', `<h1>Kárbejelentő</h1><pre style="font:inherit;white-space:pre-wrap">${esc(report)}</pre>`)
              }
            >
              Nyomtatás
            </button>
          </div>
        </div>
        <div>
          <h3>Előzmények</h3>
          <ul className="activity">
            {d.history.map((h, i) => (
              <li key={i}>
                <time>{fmtDateTime(h.at)}</time> {DAMAGE_STATUS[h.status]}
                {h.note ? ` – ${h.note}` : ''}
              </li>
            ))}
          </ul>
          {d.status !== 'closed' && (
            <>
              {d.status === 'recorded' && (
                <Field label="Biztosítói kárszám">
                  <input value={claimNo} onChange={(e) => setClaimNo(e.target.value)} placeholder="pl. CS-2026-…" />
                </Field>
              )}
              <Field label="Megjegyzés (nem kötelező)">
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <button
                className="btn btn-primary"
                onClick={() => {
                  advanceDamage(d.id, { claimNo: claimNo || undefined, note: note || undefined });
                  setNote('');
                }}
              >
                {nextLabel[d.status]} →
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
