// tako-screens.jsx — order tracking, waiter call, AI assistant chat
const { useState: sS, useEffect: sE, useRef: sR } = React;

/* ───────────────── ORDER TRACKING ───────────────── */
function TrackingView({ goMenu }) {
  const o = useStore(orderStore);
  const cur = stepIndex(o.status);

  if (!o.orderId) {
    return (
      <div className="scroll" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30, textAlign: 'center' }}>
        <div>
          <img src="assets/tako-phone.png" alt="" className="anim-float" style={{ width: 150, margin: '0 auto', filter: 'drop-shadow(0 16px 26px rgba(217,83,58,.18))' }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>Nessun ordine attivo</h3>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 6, marginBottom: 20 }}>Quando ordini, qui segui tutto in tempo reale.</p>
          <Btn onClick={goMenu} icon="bowl">Vai al menù</Btn>
        </div>
      </div>
    );
  }

  const step = ORDER_STEPS[cur];
  const total = cartTotal(o.items);
  const animTotal = useCountUp(total);
  const ready = o.status === 'pronto', served = o.status === 'servito';

  return (
    <div className="scroll" style={{ flex: 1, padding: '8px 16px calc(var(--safe-b) + 96px)' }}>
      {/* current status hero */}
      <div key={o.status} style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-card)', padding: '20px 18px', marginTop: 4,
        background: ready ? 'var(--ok)' : served ? 'var(--ink)' : 'var(--brand)', color: '#fff', boxShadow: 'var(--sh-2)', animation: 'rise-fade .5s var(--spring)' }}>
        {(ready || served) && <Confetti n={16} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 52, height: 52, flex: 'none' }}>
            {!served && !ready && <span className="pulse-ring" style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'rgba(255,255,255,.5)', animation: 'pulse-ring 2.4s ease-out infinite' }} />}
            <span style={{ position: 'relative', width: 52, height: 52, borderRadius: 999, background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center' }}>
              <Icon name={ready || served ? 'check' : 'clock'} size={26} stroke={2.4} className={!ready && !served ? 'anim-spin' : ''} style={!ready && !served ? { animation: 'spin 3s linear infinite' } : {}} />
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .8 }}>Ordine {o.orderId}</p>
            <h2 className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 3 }}>{step.label}</h2>
            <p style={{ fontSize: 14, opacity: .92, marginTop: 4 }}>{step.desc}</p>
          </div>
        </div>
      </div>

      {/* vertical stepper */}
      <div style={{ background: 'var(--raised)', borderRadius: 'var(--r-card)', padding: '18px 18px 6px', marginTop: 12, boxShadow: 'var(--sh-1)' }}>
        {ORDER_STEPS.map((s, i) => {
          const done = i < cur, on = i === cur;
          return (
            <div key={s.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', flex: 'none', transition: 'all .4s var(--spring)',
                  background: done || on ? 'var(--brand)' : 'var(--surface)', color: done || on ? 'var(--on-brand)' : 'var(--ink-3)',
                  boxShadow: on ? '0 0 0 5px var(--brand-tint)' : done ? 'none' : 'inset 0 0 0 2px var(--hairline)' }}>
                  {done ? <Icon name="check" size={17} stroke={2.8} style={{ animation: 'check-pop .4s var(--spring)' }} />
                    : on ? <span style={{ width: 9, height: 9, borderRadius: 999, background: '#fff', animation: 'badge-pop 1.6s ease-in-out infinite' }} />
                    : <span style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</span>}
                </div>
                {i < ORDER_STEPS.length - 1 && <div style={{ width: 3, flex: 1, minHeight: 26, borderRadius: 99, background: i < cur ? 'var(--brand)' : 'var(--hairline)', transition: 'background .5s var(--out)', margin: '4px 0' }} />}
              </div>
              <div style={{ paddingBottom: 18, paddingTop: 3, opacity: done || on ? 1 : .5, transition: 'opacity .4s' }}>
                <p style={{ fontWeight: 700, fontSize: 15.5 }}>{s.label}</p>
                <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 1 }}>{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* order summary */}
      <div style={{ background: 'var(--raised)', borderRadius: 'var(--r-card)', padding: '16px 18px', marginTop: 12, boxShadow: 'var(--sh-1)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Riepilogo</p>
        {o.items.map(li => (
          <div key={li.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
            <span className="tnum" style={{ minWidth: 26, height: 26, borderRadius: 8, background: 'var(--sunken)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{li.quantity}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14.5 }}>{li.name}</p>
              {li.notes && <p style={{ color: 'var(--ink-3)', fontSize: 12, fontStyle: 'italic' }}>“{li.notes}”</p>}
            </div>
            <span className="tnum" style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-2)' }}>{eur(li.unitPrice * li.quantity)}</span>
          </div>
        ))}
        {o.notes && <p style={{ fontSize: 12.5, color: 'var(--ink-2)', fontStyle: 'italic', borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>Nota: {o.notes}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--hairline)', paddingTop: 12, marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>Totale</span>
          <span className="serif tnum" style={{ fontSize: 23 }}>{eur(animTotal)}</span>
        </div>
      </div>

      <div style={{ marginTop: 14 }}><Btn full kind="soft" onClick={goMenu} icon="plus">Aggiungi altro</Btn></div>
    </div>
  );
}

/* ───────────────── WAITER CALL ───────────────── */
const WAITER_OPTS = [
  { kind: 'help', label: 'Ho bisogno di aiuto', icon: 'help', sub: 'Un cameriere arriva al tavolo' },
  { kind: 'bill', label: 'Vorrei il conto', icon: 'receipt', sub: 'Prepariamo il conto del tavolo' },
  { kind: 'water', label: 'Acqua, per favore', icon: 'droplet', sub: 'Portiamo dell\u2019acqua' },
];
function WaiterSheet({ open, onClose }) {
  const [sent, setSent] = sS(null);
  sE(() => { if (open) setSent(null); }, [open]);
  const call = (opt) => {
    setSent(opt); // POST /customer/waiter-call {type}
    setTimeout(() => { onClose(); }, 2100);
  };
  return (
    <Sheet open={open} onClose={onClose} title={sent ? null : 'Chiama il cameriere'} sub={sent ? null : `Tavolo ${sessionStore.get().tableNumber}`} leadIcon={sent ? null : 'bell'}>
      {sent ? (
        <div style={{ position: 'relative', padding: '14px 30px 40px', textAlign: 'center' }}>
          <Confetti n={18} />
          <div style={{ width: 76, height: 76, margin: '0 auto', borderRadius: 999, background: 'var(--ok)', color: '#fff', display: 'grid', placeItems: 'center', animation: 'pop-in .5s var(--spring)' }}>
            <Icon name="check" size={40} stroke={2.6} style={{ animation: 'check-pop .5s .1s var(--spring) both' }} />
          </div>
          <h3 style={{ fontSize: 21, fontWeight: 700, marginTop: 16 }}>Fatto!</h3>
          <p style={{ color: 'var(--ink-2)', fontSize: 14.5, marginTop: 6 }}>{sent.label} — arriviamo subito al tavolo {sessionStore.get().tableNumber}.</p>
        </div>
      ) : (
        <div style={{ padding: '4px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WAITER_OPTS.map((o, i) => (
            <button key={o.kind} className="press-sm" onClick={() => call(o)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', borderRadius: 'var(--r-card)', textAlign: 'left',
                background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)', animation: 'rise-fade .4s var(--out) both', animationDelay: (i * 0.06) + 's' }}>
              <span style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: 'var(--brand-tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center' }}><Icon name={o.icon} size={23} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{o.label}</span>
                <span style={{ display: 'block', color: 'var(--ink-2)', fontSize: 13, marginTop: 1 }}>{o.sub}</span>
              </span>
              <Icon name="chevronRight" size={20} style={{ color: 'var(--ink-3)' }} />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/* ───────────────── AI ASSISTANT CHAT ───────────────── */
const NUMWORDS = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5 };
function parseItems(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const found = [];
  for (const it of ALL_ITEMS) {
    if (!it.available) continue;
    const kw = it.name.toLowerCase().split(' ')[0].replace(/[^a-zà-ÿ]/g, '');
    if (kw.length < 4) continue;
    const stem = kw.slice(0, -1);
    let idx = t.indexOf(kw);
    if (idx < 0 && stem.length >= 4) idx = t.indexOf(stem);
    if (idx >= 0) {
      const before = t.slice(Math.max(0, idx - 12), idx).trim().split(' ');
      const w = before[before.length - 1];
      const qty = NUMWORDS[w] || (parseInt(w) || 1);
      found.push({ item: it, qty: Math.min(qty, 9) });
    }
  }
  return found;
}
function aiRespond(text) {
  const t = text.toLowerCase();
  const wantOrder = /\b(ordin|vorrei|vorre|prend|aggiung|porta|dammi|mettimi|voglio)/.test(t);
  const items = parseItems(t);

  if (/cont(o|i)\b|pagare|pagamento/.test(t))
    return { text: 'Certo! Ho avvisato il cameriere: il conto del tavolo arriva subito. 💳', actions: [{ type: 'waiter_called', payload: { kind: 'bill', label: 'Conto richiesto' } }] };

  if ((/\baiuto|cameriere|assistenza\b/.test(t)))
    return { text: 'Ho chiamato un cameriere, arriva al tavolo in un attimo.', actions: [{ type: 'waiter_called', payload: { kind: 'help', label: 'Aiuto richiesto' } }] };

  if (/conferma|invia.*ordine|manda.*ordine|fai.*ordine/.test(t)) {
    if (!cartStore.get().items.length) return { text: 'Il carrello è ancora vuoto — dimmi cosa ti va e lo aggiungo io.' };
    const total = cartTotal(cartStore.get().items);
    const orderId = placeOrder();
    return { text: 'Perfetto, ordine inviato in cucina! Lo trovi nella sezione tracking.', actions: [{ type: 'order_placed', payload: { orderId, total } }] };
  }

  if (wantOrder && items.length) {
    items.forEach(({ item, qty }) => cart.add({ menuItemId: item.id, variantId: item.variants ? item.variants[0].id : null, name: item.name, unitPrice: item.price, quantity: qty, notes: '' }));
    const lines = items.map(({ item, qty }) => ({ name: item.name, qty, price: item.price }));
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    return { text: 'Fatto! Ho aggiunto questi al tuo carrello 👇', actions: [{ type: 'cart_add', payload: { lines, total } }] };
  }

  if (/consigl|miglior|buono|cosa.*prend/.test(t)) {
    const recs = ALL_ITEMS.filter(i => i.tags?.includes('Consigliato')).slice(0, 3);
    return { text: 'Stasera ti consiglio:\n' + recs.map(r => `• ${r.name} — ${eur(r.price)}`).join('\n') + '\nVuoi che ne aggiunga qualcuno?' };
  }

  if (/glutine|celiac|senza\s*glut/.test(t)) {
    const gf = ALL_ITEMS.filter(i => i.available && !i.allergens.includes('glutine')).slice(0, 4);
    return { text: 'Senza glutine puoi andare tranquillo con:\n' + gf.map(r => `• ${r.name}`).join('\n') };
  }

  if (/punto.*ordine|stato.*ordine|traccia|pronto/.test(t)) {
    const o = orderStore.get();
    if (!o.orderId) return { text: 'Non hai ancora ordini attivi. Appena ordini ti aggiorno qui in tempo reale!' };
    return { text: `Il tuo ordine ${o.orderId} è in stato “${ORDER_STEPS[stepIndex(o.status)].label}”. Ti avviso appena è pronto!` };
  }

  if (/acqua/.test(t))
    return { text: 'Arriva subito dell\u2019acqua al tavolo. 💧', actions: [{ type: 'waiter_called', payload: { kind: 'water', label: 'Acqua richiesta' } }] };

  return { text: 'Posso consigliarti i piatti, filtrare per allergeni, aggiungere cose al carrello o chiamare il cameriere. Dimmi pure!' };
}

const CHAT_CHIPS = ['Cosa mi consigli?', 'Avete piatti senza glutine?', 'Ordina una margherita e due birre', 'A che punto è il mio ordine?'];

function ActionCard({ action, goTracking }) {
  const { type, payload } = action;
  if (type === 'cart_add') return (
    <div style={{ background: 'var(--raised)', borderRadius: 16, padding: 14, boxShadow: 'inset 0 0 0 1.5px var(--ok)', animation: 'pop-in .45s var(--spring)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ok)', fontWeight: 700, fontSize: 13.5, marginBottom: 9 }}><Icon name="bag" size={17} /> <span>Aggiunto al carrello</span></div>
      {payload.lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', fontSize: 14, marginBottom: 6 }}>
          <span style={{ minWidth: 0 }}><b>{l.qty}×</b> {l.name}</span><span className="tnum" style={{ flex: 'none', color: 'var(--ink-2)' }}>{eur(l.price * l.qty)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--hairline)', paddingTop: 7, marginTop: 5, fontWeight: 700 }}>
        <span>Totale</span><span className="tnum">{eur(payload.total)}</span>
      </div>
    </div>
  );
  if (type === 'order_placed') return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--ok)', color: '#fff', borderRadius: 16, padding: 16, animation: 'pop-in .45s var(--spring)' }}>
      <Confetti n={12} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}><Icon name="check" size={20} stroke={2.6} /> Ordine inviato!</div>
      <p style={{ fontSize: 13, opacity: .92, margin: '4px 0 12px' }}>{payload.orderId} · {eur(payload.total)}</p>
      <button className="press" onClick={goTracking} style={{ background: '#fff', color: 'var(--ink)', fontWeight: 700, fontSize: 14, padding: '10px 16px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <Icon name="clock" size={17} /> Traccia ordine
      </button>
    </div>
  );
  if (type === 'waiter_called') return (
    <div style={{ background: 'var(--raised)', borderRadius: 16, padding: 14, boxShadow: 'inset 0 0 0 1.5px var(--brand)', display: 'flex', alignItems: 'center', gap: 11, animation: 'pop-in .45s var(--spring)' }}>
      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center' }}><Icon name="bell" size={20} className="anim-bell" /></span>
      <div><p style={{ fontWeight: 700, fontSize: 14.5 }}>{payload.label}</p><p style={{ color: 'var(--ink-2)', fontSize: 13 }}>Il cameriere è stato avvisato.</p></div>
    </div>
  );
  return null;
}

function ChatView({ goTracking }) {
  const [msgs, setMsgs] = sS([{ id: 0, role: 'assistant', text: 'Ciao! Sono l\u2019assistente di ' + sessionStore.get().restaurantName + '. Posso consigliarti i piatti, prendere l\u2019ordine o chiamare il cameriere. Come posso aiutarti?' }]);
  const [draft, setDraft] = sS('');
  const [typing, setTyping] = sS(false);
  const endRef = sR(null);
  const idRef = sR(1);
  sE(() => { endRef.current?.parentElement?.scrollTo({ top: 9e6, behavior: 'smooth' }); }, [msgs, typing]);

  const send = (text) => {
    const v = (text ?? draft).trim(); if (!v || typing) return;
    setDraft('');
    setMsgs(m => [...m, { id: idRef.current++, role: 'user', text: v }]);
    setTyping(true);
    setTimeout(() => {
      const r = aiRespond(v);
      setTyping(false);
      setMsgs(m => [...m, { id: idRef.current++, role: 'assistant', text: r.text, actions: r.actions }]);
    }, 850 + Math.random() * 500);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* assistant subheader */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 18px 12px' }}>
        <div style={{ position: 'relative', width: 42, height: 42, flex: 'none' }}>
          <img src="assets/tako-assistant.png" alt="" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <span style={{ position: 'absolute', bottom: 0, right: -1, width: 12, height: 12, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 0 2.5px var(--surface)' }} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>Assistente</p>
          <p style={{ fontSize: 12.5, color: 'var(--ok)', fontWeight: 600 }}>online · risponde subito</p>
        </div>
      </div>
      <hr className="hairline" />

      {/* messages */}
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.map(m => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            {m.text && (
              <div style={{ maxWidth: '86%', padding: '11px 15px', borderRadius: m.role === 'user' ? '18px 18px 6px 18px' : '18px 18px 18px 6px', whiteSpace: 'pre-line',
                background: m.role === 'user' ? 'var(--brand)' : 'var(--raised)', color: m.role === 'user' ? 'var(--on-brand)' : 'var(--ink)',
                fontSize: 14.5, lineHeight: 1.45, boxShadow: m.role === 'user' ? 'none' : 'var(--sh-1)', animation: 'item-in .42s var(--spring) both' }}>{m.text}</div>
            )}
            {m.actions?.map((a, i) => <div key={i} style={{ width: '86%' }}><ActionCard action={a} goTracking={goTracking} /></div>)}
          </div>
        ))}
        {typing && (
          <div style={{ alignSelf: 'flex-start', padding: '13px 16px', borderRadius: '18px 18px 18px 6px', background: 'var(--raised)', boxShadow: 'var(--sh-1)', display: 'flex', gap: 5, animation: 'rise-fade .3s var(--out)' }}>
            <span className="tdot" /><span className="tdot" /><span className="tdot" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* chips */}
      {msgs.length <= 1 && !typing && (
        <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 10px' }}>
          {CHAT_CHIPS.map(c => (
            <button key={c} className="press-sm" onClick={() => send(c)}
              style={{ flex: 'none', padding: '9px 14px', borderRadius: 999, background: 'var(--raised)', boxShadow: 'var(--sh-1)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{c}</button>
          ))}
        </div>
      )}

      {/* composer */}
      <div style={{ flex: 'none', padding: '8px 14px calc(var(--safe-b) + 110px)', display: 'flex', gap: 9, alignItems: 'center', borderTop: '1px solid var(--hairline)', background: 'var(--surface)' }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Scrivi un messaggio…"
          style={{ flex: 1, height: 46, border: 'none', outline: 'none', background: 'var(--raised)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)', borderRadius: 999, padding: '0 18px', fontSize: 15, color: 'var(--ink)' }} />
        <button onClick={() => send()} disabled={!draft.trim()} className="press" aria-label="Invia"
          style={{ width: 46, height: 46, flex: 'none', borderRadius: 999, background: draft.trim() ? 'var(--brand)' : 'var(--sunken)', color: draft.trim() ? 'var(--on-brand)' : 'var(--ink-3)', display: 'grid', placeItems: 'center', transition: 'background .2s' }}>
          <Icon name="send" size={20} />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { TrackingView, WaiterSheet, ChatView });
