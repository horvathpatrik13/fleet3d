import { useEffect, useRef, useState } from 'react';
import { esc, fmtDateTime, fmtKm, printHTML } from '../../data/logic';
import { PEOPLE } from '../../data/seed';
import { HANDOVER_CHECKLIST, type Handover as HandoverT, type Vehicle } from '../../data/types';
import { branchById, freeSlot, useFleet } from '../../state/store';
import { Card, Empty, Field, Page, Plate, VehicleSelect } from '../common';

function SignaturePad({ onChange }: { onChange: (dataUrl?: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ref.current!.width, ((e.clientY - r.top) / r.height) * ref.current!.height];
  };

  return (
    <div className="sig-pad">
      <canvas
        ref={ref}
        width={520}
        height={140}
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = ref.current!.getContext('2d')!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext('2d')!;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#1b2a4a';
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          if (dirty.current) onChange(ref.current!.toDataURL('image/png'));
        }}
      />
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          ref.current!.getContext('2d')!.clearRect(0, 0, 520, 140);
          dirty.current = false;
          onChange(undefined);
        }}
      >
        Törlés
      </button>
    </div>
  );
}

export function printHandover(h: HandoverT, v: Vehicle) {
  const rows = HANDOVER_CHECKLIST.map(([k, l]) => `<tr><td>${esc(l)}</td><td>${h.checklist[k] ? '✓ megvan' : '✕ hiányzik'}</td></tr>`).join('');
  const title = h.type === 'out' ? 'Gépjármű átadás-átvételi jegyzőkönyv – kiadás' : 'Gépjármű átadás-átvételi jegyzőkönyv – visszavétel';
  printHTML(
    title,
    `<h1>${title}</h1><p class="muted">Kelt: ${esc(fmtDateTime(h.at))} · Azonosító: ${esc(h.id)}</p>
<h2>Jármű</h2><table>
<tr><th>Rendszám</th><td>${esc(v.plate)}</td><th>Típus</th><td>${esc(v.make)} ${esc(v.model)}</td></tr>
<tr><th>Forgalmi engedély</th><td>${esc(v.registrationNo)}</td><th>Km-óra állás</th><td>${esc(fmtKm(h.odometer))}</td></tr>
<tr><th>Üzemanyagszint</th><td>${h.fuel}%</td><th>Tankkártya</th><td>${esc(v.fuelCard ? `${v.fuelCard.provider} ${v.fuelCard.number}` : '–')}</td></tr>
</table>
<h2>${h.type === 'out' ? 'Átvevő kolléga' : 'Átadó kolléga'}</h2><p>${esc(h.person)}</p>
<h2>Tartozékok, állapot</h2><table>${rows}</table>
<h2>Megjegyzés, meglévő sérülések</h2><p>${esc(h.notes || 'Nincs.')}</p>
<p class="muted">A jármű használatára a céges gépjármű-használati szabályzat vonatkozik, amelyet az átvevő megismert.</p>
<div class="sig"><div>${h.signature ? `<img src="${h.signature}" alt="aláírás"><br>` : ''}${esc(h.person)}</div><div>Flottakezelés</div></div>`,
  );
}

export function Handover() {
  const vehicles = useFleet((s) => s.vehicles);
  const handovers = useFleet((s) => s.handovers);
  const branches = useFleet((s) => s.branches);
  const draft = useFleet((s) => s.draft);
  const clearDraft = useFleet((s) => s.clearDraft);
  const createHandover = useFleet((s) => s.createHandover);
  const setSection = useFleet((s) => s.setSection);

  const [type, setType] = useState<'out' | 'in'>('out');
  const [vehicleId, setVehicleId] = useState('');
  const [person, setPerson] = useState('');
  const [odometer, setOdometer] = useState(0);
  const [fuel, setFuel] = useState(75);
  const [returnBranch, setReturnBranch] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => Object.fromEntries(HANDOVER_CHECKLIST.map(([k]) => [k, true])));
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string>();
  const [sigKey, setSigKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const v = vehicles.find((x) => x.id === vehicleId);

  const pickVehicle = (id: string) => {
    setVehicleId(id);
    const x = vehicles.find((y) => y.id === id);
    if (!x) return;
    setOdometer(x.odometer);
    if (x.slot < 0) {
      setType('in');
      setPerson(x.assignedTo ?? '');
      setReturnBranch(x.homeBranchId);
    } else {
      setType('out');
    }
    setError(null);
  };

  useEffect(() => {
    if (draft?.section === 'handover' && draft.vehicleId) {
      pickVehicle(draft.vehicleId);
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const reset = () => {
    setVehicleId('');
    setPerson('');
    setNotes('');
    setSignature(undefined);
    setSigKey((k) => k + 1);
    setChecklist(Object.fromEntries(HANDOVER_CHECKLIST.map(([k]) => [k, true])));
  };

  const submit = (print: boolean) => {
    const h = { type, vehicleId, person, odometer, fuel, checklist, notes, signature };
    const err = createHandover(h, type === 'in' ? returnBranch : undefined);
    setError(err);
    if (!err) {
      const saved = useFleet.getState().handovers[0];
      if (print && v) printHandover(saved, v);
      reset();
    }
  };

  const out = vehicles.filter((x) => x.slot < 0).sort((a, b) => (a.assignedSince ?? 0) - (b.assignedSince ?? 0));

  return (
    <Page title="Átadás-átvétel" subtitle="Jármű kiadása kollégának és visszavétele – jegyzőkönyvvel, aláírással. A 3D térképen az autó ki-, illetve behajt.">
      <div className="grid-2">
        <Card title="Új jegyzőkönyv">
          <div className="segmented segmented-lg">
            <button
              aria-pressed={type === 'out'}
              onClick={() => {
                setType('out');
                setVehicleId('');
              }}
            >
              Kiadás kollégának
            </button>
            <button
              aria-pressed={type === 'in'}
              onClick={() => {
                setType('in');
                setVehicleId('');
              }}
            >
              Visszavétel
            </button>
          </div>

          <div className="form-grid">
            <Field label="Jármű">
              <VehicleSelect
                value={vehicleId}
                onChange={pickVehicle}
                filter={(x) => (type === 'out' ? x.slot >= 0 && x.status === 'active' : x.slot < 0)}
                placeholder={type === 'out' ? 'Telephelyen álló jármű…' : 'Kiadott jármű…'}
              />
            </Field>
            <Field label={type === 'out' ? 'Átvevő kolléga' : 'Átadó kolléga'}>
              <input list="people" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Név" />
              <datalist id="people">
                {PEOPLE.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Km-óra állás" hint={v ? `Legutóbbi: ${fmtKm(v.odometer)}` : undefined}>
              <input type="number" value={odometer || ''} onChange={(e) => setOdometer(Number(e.target.value))} />
            </Field>
            <Field label={`Üzemanyagszint: ${fuel}%`}>
              <input type="range" min={0} max={100} step={5} value={fuel} onChange={(e) => setFuel(Number(e.target.value))} />
            </Field>
            {type === 'in' && (
              <Field label="Melyik telephelyre kerül vissza?">
                <select value={returnBranch} onChange={(e) => setReturnBranch(e.target.value)}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} disabled={freeSlot(vehicles, b.id) === null}>
                      {b.city}
                      {freeSlot(vehicles, b.id) === null ? ' (tele)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <fieldset className="checklist">
            <legend>Tartozékok és állapot</legend>
            {HANDOVER_CHECKLIST.map(([k, l]) => (
              <label key={k}>
                <input type="checkbox" checked={!!checklist[k]} onChange={(e) => setChecklist({ ...checklist, [k]: e.target.checked })} /> {l}
              </label>
            ))}
          </fieldset>

          <Field label="Megjegyzés, meglévő sérülések">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="pl. jobb hátsó ajtón karc" />
          </Field>
          {v && (
            <p className="hint">
              Új sérülést találtál?{' '}
              <button className="link" onClick={() => setSection('damages', { vehicleId: v.id })}>
                Kár rögzítése ehhez a járműhöz →
              </button>
            </p>
          )}

          <Field label="A kolléga aláírása">
            <SignaturePad key={sigKey} onChange={setSignature} />
          </Field>

          {error && <p className="form-error">{error}</p>}
          <div className="modal-foot">
            <button className="btn" disabled={!vehicleId} onClick={() => submit(false)}>
              {type === 'out' ? 'Kiadás rögzítése' : 'Visszavétel rögzítése'}
            </button>
            <button className="btn btn-primary" disabled={!vehicleId} onClick={() => submit(true)}>
              {type === 'out' ? 'Kiadás és jegyzőkönyv' : 'Visszavétel és jegyzőkönyv'}
            </button>
          </div>
        </Card>

        <div className="stack">
          <Card title={`Kiadott járművek (${out.length})`}>
            {out.length === 0 ? (
              <Empty>Minden jármű a telephelyen van.</Empty>
            ) : (
              <ul className="mini-list">
                {out.map((x) => (
                  <li key={x.id}>
                    <Plate v={x} />
                    <span>{x.assignedTo}</span>
                    <span className="muted">{x.assignedSince ? `${Math.floor((Date.now() - x.assignedSince) / 86_400_000)} napja` : ''}</span>
                    <button className="btn btn-sm" onClick={() => pickVehicle(x.id)}>
                      Visszavétel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Jegyzőkönyvek">
            <ul className="mini-list">
              {handovers.slice(0, 15).map((h) => {
                const hv = vehicles.find((x) => x.id === h.vehicleId)!;
                return (
                  <li key={h.id}>
                    <span className={`chip ${h.type === 'out' ? 'chip-out' : 'chip-active'}`}>{h.type === 'out' ? 'Kiadás' : 'Visszavétel'}</span>
                    <Plate v={hv} />
                    <span>{h.person}</span>
                    <span className="muted">{fmtDateTime(h.at)}</span>
                    <button className="btn btn-sm" onClick={() => printHandover(h, hv)}>
                      Nyomtatás
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {v && (
            <p className="hint">
              Kiválasztva: <Plate v={v} /> {v.make} {v.model}, {branchById(v.branchId).city}
              {v.assignedTo ? ` – most ${v.assignedTo} kollégánál` : ''}.
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}
