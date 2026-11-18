import { useMemo, useState } from 'react';
import { addDays, checkInvoice, copyText, downloadCSV, fmtDate, fmtFt, todayISO } from '../../data/logic';
import { INVOICE_CATEGORY, INVOICE_STATUS, type Invoice, type InvoiceCategory, type InvoiceStatus } from '../../data/types';
import { useFleet } from '../../state/store';
import { Card, Field, Issues, Modal, Page } from '../common';

const TONE: Record<InvoiceStatus, string> = { received: 'chip-transit', checked: 'chip-active', forwarded: 'chip-retired', disputed: 'sev-overdue' };
const FINANCE_EMAIL = 'penzugy@pelda.hu';

export function Invoices() {
  const invoices = useFleet((s) => s.invoices);
  const vehicles = useFleet((s) => s.vehicles);
  const setInvoiceStatus = useFleet((s) => s.setInvoiceStatus);
  const [filter, setFilter] = useState<InvoiceStatus | 'open'>('open');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [forwarding, setForwarding] = useState<Invoice[] | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      invoices
        .filter((i) => (filter === 'open' ? i.status === 'received' || i.status === 'checked' : i.status === filter))
        .map((i) => ({ i, issues: checkInvoice(i, invoices, vehicles) })),
    [invoices, vehicles, filter],
  );
  const sel = rows.filter((r) => selected.has(r.i.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Page
      title="Beérkező számlák"
      subtitle="Ellenőrzés (rendszám, duplikáció, határidő, jóváhagyási limit), majd továbbítás a pénzügyi osztálynak."
      actions={
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Számla rögzítése
        </button>
      }
    >
      <div className="filters">
        <div className="segmented">
          <button aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>
            Teendő
          </button>
          {(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((k) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {INVOICE_STATUS[k]}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button
          className="btn"
          disabled={!sel.some((r) => r.i.status === 'received')}
          onClick={() => {
            setInvoiceStatus(
              sel.filter((r) => r.i.status === 'received').map((r) => r.i.id),
              'checked',
            );
            setSelected(new Set());
          }}
        >
          Ellenőrizve
        </button>
        <button className="btn" disabled={sel.length !== 1} onClick={() => setDisputing(sel[0].i.id)}>
          Kifogás
        </button>
        <button
          className="btn btn-primary"
          disabled={!sel.some((r) => r.i.status === 'checked')}
          onClick={() => setForwarding(sel.filter((r) => r.i.status === 'checked').map((r) => r.i))}
        >
          Továbbítás a pénzügynek
        </button>
      </div>

      <Card>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Szállító / sorszám</th>
              <th>Kategória</th>
              <th>Rendszám</th>
              <th>Kelt</th>
              <th>Fizetési határidő</th>
              <th className="num">Bruttó</th>
              <th>Állapot</th>
              <th>Ellenőrzés</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ i, issues }) => (
              <tr key={i.id} className={selected.has(i.id) ? 'is-selected' : ''}>
                <td>
                  <input type="checkbox" aria-label="Kijelölés" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                </td>
                <td>
                  <strong>{i.supplier}</strong>
                  <br />
                  <small className="muted">{i.number}</small>
                  {i.note && (
                    <>
                      <br />
                      <small className="muted">{i.note}</small>
                    </>
                  )}
                </td>
                <td>{INVOICE_CATEGORY[i.category]}</td>
                <td>{i.plate || <span className="muted">–</span>}</td>
                <td>{fmtDate(i.issueDate)}</td>
                <td>{fmtDate(i.dueDate)}</td>
                <td className="num">{fmtFt(i.gross)}</td>
                <td>
                  <span className={`chip ${TONE[i.status]}`}>{INVOICE_STATUS[i.status]}</span>
                </td>
                <td>{i.status === 'forwarded' ? <span className="muted">–</span> : <Issues items={issues} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="hint">Nincs ilyen számla.</p>}
      </Card>

      {creating && <NewInvoice onClose={() => setCreating(false)} />}
      {forwarding && (
        <ForwardModal
          items={forwarding}
          onClose={() => {
            setForwarding(null);
            setSelected(new Set());
          }}
        />
      )}
      {disputing && <DisputeModal id={disputing} onClose={() => (setDisputing(null), setSelected(new Set()))} />}
    </Page>
  );
}

function NewInvoice({ onClose }: { onClose: () => void }) {
  const addInvoice = useFleet((s) => s.addInvoice);
  const vehicles = useFleet((s) => s.vehicles);
  const [f, setF] = useState({
    supplier: '',
    number: '',
    issueDate: todayISO(),
    dueDate: addDays(todayISO(), 15),
    gross: 0,
    category: 'service' as InvoiceCategory,
    plate: '',
    note: '',
  });
  const set = (k: keyof typeof f, val: string | number) => setF({ ...f, [k]: val });
  return (
    <Modal title="Számla rögzítése" onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Szállító">
          <input value={f.supplier} onChange={(e) => set('supplier', e.target.value)} />
        </Field>
        <Field label="Számla sorszáma">
          <input value={f.number} onChange={(e) => set('number', e.target.value)} />
        </Field>
        <Field label="Kelt">
          <input type="date" value={f.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
        </Field>
        <Field label="Fizetési határidő">
          <input type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Bruttó összeg (Ft)">
          <input type="number" value={f.gross || ''} onChange={(e) => set('gross', Number(e.target.value))} />
        </Field>
        <Field label="Kategória">
          <select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {Object.entries(INVOICE_CATEGORY).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rendszám" hint="Üzemanyag-összesítőnél üresen hagyható.">
          <input list="plates" value={f.plate} onChange={(e) => set('plate', e.target.value.toUpperCase())} />
          <datalist id="plates">
            {vehicles.map((v) => (
              <option key={v.id} value={v.plate} />
            ))}
          </datalist>
        </Field>
        <Field label="Megjegyzés">
          <input value={f.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Mégse
        </button>
        <button
          className="btn btn-primary"
          disabled={!f.supplier || !f.number || !f.gross}
          onClick={() => {
            addInvoice({ ...f, note: f.note || undefined });
            onClose();
          }}
        >
          Rögzítés
        </button>
      </div>
    </Modal>
  );
}

function ForwardModal({ items, onClose }: { items: Invoice[]; onClose: () => void }) {
  const setInvoiceStatus = useFleet((s) => s.setInvoiceStatus);
  const toast = useFleet((s) => s.toast);
  const total = items.reduce((s, i) => s + i.gross, 0);
  const body = `Kedves Pénzügy!\n\nMellékelten továbbítom az ellenőrzött flottaszámlákat (${items.length} db, összesen ${fmtFt(total)}):\n\n${items
    .map((i) => `• ${i.supplier} – ${i.number} – ${fmtFt(i.gross)} – határidő: ${fmtDate(i.dueDate)}${i.plate ? ` – ${i.plate}` : ''}`)
    .join('\n')}\n\nA számlák a rendszerben ellenőrizve, a rendszámok egyeztetve.\n\nKöszönöm!\nFlottakezelés`;
  return (
    <Modal title="Továbbítás a pénzügyi osztálynak" onClose={onClose} wide>
      <pre className="report">{body}</pre>
      <div className="modal-foot">
        <button
          className="btn"
          onClick={() =>
            downloadCSV(`szamlak-${todayISO()}.csv`, [
              ['Szállító', 'Sorszám', 'Kelt', 'Határidő', 'Bruttó', 'Kategória', 'Rendszám'],
              ...items.map((i) => [i.supplier, i.number, i.issueDate, i.dueDate, i.gross, INVOICE_CATEGORY[i.category], i.plate]),
            ])
          }
        >
          Lista letöltése (CSV)
        </button>
        <button className="btn" onClick={async () => toast((await copyText(body)) ? 'Levél vágólapra másolva.' : 'Nem sikerült másolni.')}>
          Levél másolása
        </button>
        <a className="btn" href={`mailto:${FINANCE_EMAIL}?subject=${encodeURIComponent('Flottaszámlák továbbítása')}&body=${encodeURIComponent(body)}`}>
          Megnyitás levelezőben
        </a>
        <button
          className="btn btn-primary"
          onClick={() => {
            setInvoiceStatus(
              items.map((i) => i.id),
              'forwarded',
            );
            toast(`${items.length} számla továbbítottként megjelölve.`);
            onClose();
          }}
        >
          Továbbítottnak jelöl
        </button>
      </div>
    </Modal>
  );
}

function DisputeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const inv = useFleet((s) => s.invoices.find((x) => x.id === id))!;
  const setInvoiceStatus = useFleet((s) => s.setInvoiceStatus);
  const [note, setNote] = useState('');
  return (
    <Modal title={`Kifogás – ${inv.supplier} ${inv.number}`} onClose={onClose}>
      <Field label="Mi a probléma?">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="pl. duplikált számla, téves rendszám, nem egyezik az árajánlattal" />
      </Field>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Mégse
        </button>
        <button
          className="btn btn-primary"
          disabled={!note.trim()}
          onClick={() => {
            setInvoiceStatus([id], 'disputed', note);
            onClose();
          }}
        >
          Kifogásolás
        </button>
      </div>
    </Modal>
  );
}
