// F3 «Prezzo promo» e F4 «Ultime porzioni» / «Solo oggi» nel drawer «Modifica piatto» e segni sulla riga (16/10/2026).
// Logica qui; in 13-menu-workspace.js ci sono solo due agganci (drawer e riga) per non toccare barra e preset (F2).
// Regole (decise da Manuel): giornata del locale alle 06:00; promo valida solo se > 0 e < prezzo pieno;
// «Solo oggi» scade alle 06:00 del giorno dopo; «Ultime porzioni» resta finché non si toglie e sparisce con l'esaurito.
// Movimento: nessuna animazione decorativa; solo l'avviso di errore entra in opacità (micro 140ms, reduced motion: immediato).

const MW_SALES_ZONE = 'Europe/Rome';
const MW_SALES_DAY_START = 6;
function mwSalesToday(now = new Date(), zone = MW_SALES_ZONE) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(v => [v.type, v.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  if (Number(p.hour) >= MW_SALES_DAY_START) return date;
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
}
const mwSalesEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const mwSalesDate = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
const mwPromoValid = (promo, full) => Number.isFinite(promo) && Number.isFinite(full) && promo > 0 && full > 0 && promo < full;
/** Stato attivo adesso, come lo vede il cliente (stessa regola del server). */
function mwSalesState(item, today = mwSalesToday()) {
  const full = Number(item.price), promo = item.promo && mwPromoValid(Number(item.promo.price), full) && (!item.promo.until || today <= item.promo.until) && !String(item.priceDisplay || '').trim() ? item.promo : null;
  return { promo, lastPortions: !!item.scarcity?.lastPortions && item.available !== false, onlyToday: !!item.scarcity?.onlyToday && item.scarcity.onlyToday === today };
}

function MenuWorkspaceSales({ item, onChange, disabled }) {
  const today = mwSalesToday(), full = Number(item.price);
  const shown = v => v == null ? '' : String(v).replace('.', ',');
  const [text, setText] = useState(shown(item.promo?.price));
  // Ultimo valore scritto da questo campo: un cambio esterno (altro piatto, bot, live) riallinea il testo,
  // la propria scrittura no (altrimenti «1» → «13» svuoterebbe il campo mentre si digita).
  const written = useRef(item.promo?.price);
  useEffect(() => { written.current = item.promo?.price; setText(shown(item.promo?.price)); }, [item.id]);
  useEffect(() => { if (item.promo?.price !== written.current) { written.current = item.promo?.price; setText(shown(item.promo?.price)); } }, [item.promo?.price]);
  const value = text.trim() === '' ? null : Number(text.trim().replace(',', '.'));
  const invalid = value !== null && !mwPromoValid(value, full);
  const writePromo = (price, until) => { const next = price === null ? undefined : { price: Math.round(price * 100) / 100, until: until || null }; written.current = next?.price; onChange('promo', next); };
  const typePromo = next => {
    setText(next);
    const n = next.trim() === '' ? null : Number(next.trim().replace(',', '.'));
    // Non valida = nessuna promo nel documento: si salva solo ciò che il cliente vedrà davvero.
    if (n === null || !mwPromoValid(n, full)) { if (item.promo) writePromo(null); return; }
    writePromo(n, item.promo?.until);
  };
  const until = item.promo?.until || '';
  const setScarcity = patch => {
    const next = { lastPortions: !!item.scarcity?.lastPortions, onlyToday: item.scarcity?.onlyToday || null, ...patch };
    onChange('scarcity', next.lastPortions || next.onlyToday ? next : undefined);
  };
  const state = mwSalesState(item, today);
  const message = invalid ? (full > 0 ? `Il prezzo promo deve essere più basso del prezzo pieno (${mwSalesEuro(full)}) e maggiore di zero: così non viene salvato.` : 'Imposta prima il prezzo pieno.')
    : value !== null && String(item.priceDisplay || '').trim() ? 'Con un «Prezzo mostrato» a testo la promo non si vede ai clienti.'
    : until && until < today ? `Promo scaduta il ${mwSalesDate(until)}: non è più visibile.` : '';
  return <section className="mw-sales" aria-label="Promo ed etichette">
    <div className="mw-fields">
      <label className="mw-field"><span>Prezzo promo</span><input inputMode="decimal" placeholder="Nessuna promo" value={text} disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={message ? 'mw-sales-note-' + item.id : undefined} onChange={e => typePromo(e.target.value)} /></label>
      <label className="mw-field"><span>Fine promo <small>(facoltativa)</small></span><input type="date" min={today} value={until} disabled={disabled || !item.promo} onChange={e => item.promo && writePromo(Number(item.promo.price), e.target.value)} /></label>
    </div>
    <p id={'mw-sales-note-' + item.id} className={'mw-sales-note' + (message ? ' is-visible' : '')} role={message ? 'status' : undefined} aria-live="polite">{message || (item.promo ? (until ? `Visibile fino a ${mwSalesDate(until)} compreso (scade alle 6:00 del giorno dopo).` : 'Resta finché non la togli.') : '')}</p>
    <label className="mw-check"><input type="checkbox" disabled={disabled || item.available === false} checked={state.lastPortions} onChange={e => setScarcity({ lastPortions: e.target.checked })} />Ultime porzioni{item.available === false && <small className="mw-sales-hint">piatto esaurito</small>}</label>
    <label className="mw-check"><input type="checkbox" disabled={disabled} checked={state.onlyToday} onChange={e => setScarcity({ onlyToday: e.target.checked ? today : null })} />Solo oggi{state.onlyToday && <small className="mw-sales-hint">sparisce domani alle 6:00</small>}</label>
  </section>;
}

/** Segni discreti sulla riga del piatto: solo ciò che il cliente vede adesso. */
function MenuWorkspaceSalesMarks({ item }) {
  const s = mwSalesState(item);
  if (!s.promo && !s.lastPortions && !s.onlyToday) return null;
  return <span className="mw-sales-marks">{s.promo && <span className="mw-sales-mark" title={`Prezzo pieno ${mwSalesEuro(Number(item.price))}`}>Promo {mwSalesEuro(Number(s.promo.price))}</span>}{s.lastPortions && <span className="mw-sales-mark">Ultime porzioni</span>}{s.onlyToday && <span className="mw-sales-mark">Solo oggi</span>}</span>;
}

window.MenuWorkspaceSales = MenuWorkspaceSales;
window.MenuWorkspaceSalesMarks = MenuWorkspaceSalesMarks;
window.mwSalesToday = mwSalesToday;
