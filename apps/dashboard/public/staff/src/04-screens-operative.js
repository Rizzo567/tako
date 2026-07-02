/* ───────────────── Tako Dashboard — schermate operative ───────────────── */
/* Dashboard (home) · Ordini live · Cucina KDS */

const euro = (n) => CUR.sym + (Math.round(n * 100) / 100).toLocaleString("it-IT", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

function ScreenScroll({ mobile, children, dark }) {
  const last = useRef(0);
  const onScroll = (e) => {
    if (!mobile) return;
    const t = e.currentTarget.scrollTop;
    if (Math.abs(t - last.current) < 6) return;
    setScrollDown(t > last.current && t > 40);
    last.current = t;
  };
  useEffect(() => { if (mobile) setScrollDown(false); }, [mobile]);
  return (
    <div className="scroll" onScroll={onScroll} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: mobile ? "112px 14px 104px" : "26px 30px 34px", background: dark ? "var(--nav)" : "transparent" }}>
      <div style={{ maxWidth: dark ? "none" : 1180, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

/* ticking clock for live timers */
function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set(x => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

/* ═══════════════════ DASHBOARD HOME ═══════════════════ */
function ScreenDashboard({ mobile, go, orders, settings = SETTINGS_DEFAULTS }) {
  const active = orders.filter(o => !["servito", "pagato", "annullato"].includes(o.stato)).length;
  const setupDone = SETUP.filter(s => s.done).length;
  const allDone = setupDone === SETUP.length;
  const incomplete = settings.mostraOnboarding;
  // variazione incasso oggi vs ieri, calcolata da WEEK (ultimo = oggi, penultimo = ieri)
  const oggi = WEEK.length ? WEEK[WEEK.length - 1].v : 0;
  const ieri = WEEK.length >= 2 ? WEEK[WEEK.length - 2].v : 0;
  let incassoSub = null, incassoTrend = undefined;
  if (ieri > 0) {
    const pct = Math.round(((oggi - ieri) / ieri) * 100);
    incassoTrend = pct >= 0 ? "up" : "down";
    incassoSub = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs ieri`;
  }
  // ordini in attesa, contati dai dati reali in arrivo
  const inAttesa = orders.filter(o => o.stato === "attesa").length;
  const kpiAll = [
    { k: "incasso", el: <Kpi label="Incasso oggi" value={euro(KPI.incasso)} icon="coins" accent="var(--brand)" trend={incassoTrend} sub={incassoSub} /> },
    { k: "ordini", el: <Kpi label="Ordini attivi" value={active} icon="orders" accent="var(--info)" sub={`${inAttesa} in attesa`} /> },
    { k: "ticket", el: <Kpi label="Ticket medio" value={euro(KPI.ticketMedio)} icon="stats" accent="var(--ok)" /> },
    { k: "coperti", el: <Kpi label="Coperti oggi" value={KPI.coperti} icon="staff" accent="var(--wait)" sub={`${KPI.conti} conti`} /> },
  ].filter(x => settings.kpi[x.k]);
  return (
    <ScreenScroll mobile={mobile}>
      {!mobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, padding: "0" }}>
          <Tako pose="hello" size={78} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>Buonasera, {ROLES.owner.name.split(" ")[0]}!</h1>
            <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4 }}>{settings.nome} · {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <span style={{ marginLeft: "auto" }}><Badge tone="ok" dot>Servizio in corso</Badge></span>
        </div>
      )}

      {kpiAll.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : `repeat(${Math.min(4, kpiAll.length)},1fr)`, gap: mobile ? 12 : 16, marginBottom: 18 }}>
          {kpiAll.map(x => <React.Fragment key={x.k}>{x.el}</React.Fragment>)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.6fr 1fr", gap: 16 }}>
        <Card pad={mobile ? 16 : 22}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div><h3 style={{ fontSize: 17 }}>Andamento settimana</h3><p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>Incasso ultimi 7 giorni</p></div>
            <Badge tone="brand">{euro(WEEK.reduce((a, b) => a + b.v, 0))}</Badge>
          </div>
          <BarChart data={WEEK} h={mobile ? 130 : 170} fmt={(v) => "€" + (v / 1000).toFixed(1) + "k"} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {incomplete && (
            <Card pad={18} style={{ background: "linear-gradient(135deg,#fff,var(--brand-wash))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Tako pose="serve" size={46} float={false} />
                <div><h3 style={{ fontSize: 16 }}>{allDone ? "Setup completato" : "Completa il setup"}</h3><p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{allDone ? "Tutto pronto · puoi nasconderlo dalle Impostazioni" : `${setupDone}/${SETUP.length} passi · ci siamo quasi`}</p></div>
              </div>
              <Progress value={(setupDone / SETUP.length) * 100} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14 }}>
                {SETUP.map(s => (
                  <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: s.done ? "var(--ink-3)" : "var(--ink)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 99, display: "grid", placeItems: "center", background: s.done ? "var(--ok)" : "var(--ink)", color: "#fff" }}><Icon name="check" size={12} stroke={3} /></span>
                    <span style={{ textDecoration: s.done ? "line-through" : "none", fontWeight: s.done ? 500 : 600 }}>{s.k}</span>
                    {!s.done && <span style={{ marginLeft: "auto" }}><Btn size="sm" kind="brand" style={{ height: 26, padding: "0 13px", fontSize: 12.5 }} onClick={() => go(s.route || "impostazioni")}>Vai</Btn></span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card pad={18}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Scorciatoie</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {[["Nuovo conto", "cassa", "cassa"], ["Comanda", "comanda", "comanda"], ["Sala live", "sala", "map"], ["Cucina", "kds", "kitchen"]].map(([l, id, ic]) => (
                <button key={id} className="press" onClick={() => go(id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px", borderRadius: 12, background: "var(--sunken)", fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}><Icon name={ic} size={18} />{l}</button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </ScreenScroll>
  );
}

/* ═══════════════════ ORDINI LIVE ═══════════════════ */
const O_FILTERS = [["all", "Tutti"], ["attesa", "In attesa"], ["confermato", "Confermati"], ["prep", "In prep."], ["pronto", "Pronti"], ["servito", "Serviti"]];
function ScreenOrdini({ mobile, orders, onConfirm, onServe, onCancel, go }) {
  const [stato, setStato] = useState("all");
  const [tempo, setTempo] = useState("all");
  const [q, setQ] = useState("");
  const [exp, setExp] = useState({});
  const [confirmCancel, setConfirmCancel] = useState(null);

  const filtered = orders.filter(o => {
    if (stato !== "all" && o.stato !== stato) return false;
    if (tempo === "1h" && o.min > 60) return false;
    if (tempo === "3h" && o.min > 180) return false;
    if (q && !String(o.tavolo).includes(q) && !o.id.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="phone" title="Ordini live" sub={`${filtered.length} ordini · aggiornamento in tempo reale`}
        actions={<Badge tone="ok" dot>Live</Badge>} />

      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: 10, marginBottom: 16, alignItems: mobile ? "stretch" : "center" }}>
        <Search value={q} onChange={setQ} placeholder="Cerca tavolo o ID…" style={{ flex: mobile ? "none" : "0 0 240px" }} />
        <div className="scroll" style={{ display: "flex", gap: 8, overflowX: "auto", flex: 1, paddingBottom: 2 }}>
          <div className="seg">{O_FILTERS.map(([k, l]) => <button key={k} className={stato === k ? "on" : ""} onClick={() => setStato(k)}>{l}</button>)}</div>
          <div className="seg" style={{ flex: "none" }}>{[["all", "Tutto"], ["1h", "1h"], ["3h", "3h"]].map(([k, l]) => <button key={k} className={tempo === k ? "on" : ""} onClick={() => setTempo(k)}>{l}</button>)}</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty tako="phone" title="Nessun ordine" sub="Non ci sono ordini con questi filtri. I nuovi ordini compaiono qui in tempo reale." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(330px,1fr))", gap: 14 }}>
          {filtered.map(o => {
            const st = ORDER_STATUS[o.stato];
            const open = exp[o.id] ?? true;
            const tot = o.items.reduce((a, i) => a + i.prezzo * i.qty, 0);
            return (
              <Card key={o.id} pad={0} className={o.isNew ? "new-row" : ""} style={{ overflow: "hidden", borderColor: o.stato === "pronto" ? "var(--ok)" : "var(--hairline)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: o.stato === "pronto" ? "var(--ok-bg)" : "var(--sunken)" }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: o.tipo === "asporto" ? "var(--info)" : "var(--ink)", color: "#fff", display: "grid", placeItems: "center", flex: "none" }} className="num">
                    {o.tipo === "asporto" ? <Icon name="download" size={18} /> : o.tavolo}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "var(--f-display)" }}>{o.tipo === "asporto" ? "Asporto" : "Tavolo " + o.tavolo}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 8 }}><span className="mono">{o.id}</span><span>·</span><span><Icon name="clock" size={11} style={{ display: "inline", verticalAlign: -1 }} /> {o.orario} ({o.min}′)</span></div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>

                {o.note && <div style={{ padding: "8px 16px", fontSize: 12.5, color: "var(--wait)", background: "var(--wait-bg)", display: "flex", gap: 7, alignItems: "center" }}><Icon name="alert" size={14} />{o.note}</div>}

                {open && (
                  <div style={{ padding: "10px 16px" }}>
                    {o.items.map((it, k) => (
                      <div key={k} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: k < o.items.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                        <span className="num" style={{ color: "var(--brand)", fontSize: 15, minWidth: 24 }}>{it.qty}×</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{it.nome}</div>
                          {it.note && <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>“{it.note}”</div>}
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>{euro(it.prezzo * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 14px" }}>
                  <button className="press" onClick={() => setExp(e => ({ ...e, [o.id]: !open }))} style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Icon name={open ? "chevU" : "chevD"} size={14} />{open ? "Comprimi" : "Dettaglio"}</button>
                  <span style={{ marginLeft: "auto" }} className="num">{euro(tot)}</span>
                </div>

                <div style={{ display: "flex", gap: 8, padding: "0 16px 16px" }}>
                  {o.stato === "attesa" && <Btn size="sm" kind="brand" full icon="check" onClick={() => onConfirm(o.id)}>Conferma</Btn>}
                  {(o.stato === "confermato" || o.stato === "prep" || o.stato === "pronto") && <Btn size="sm" kind="ok" full icon="check" onClick={() => onServe(o.id)}>Segna servito</Btn>}
                  {o.stato !== "servito" && o.stato !== "annullato" && <Btn size="sm" kind="danger" icon="x" onClick={() => setConfirmCancel(o.id)}>Annulla</Btn>}
                  {o.stato === "servito" && <Btn size="sm" kind="soft" full icon="cassa" onClick={() => go && go("cassa")}>Vai a cassa</Btn>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Confirm open={!!confirmCancel} onClose={() => setConfirmCancel(null)} onConfirm={() => onCancel(confirmCancel)} danger title="Annullare l'ordine?" body="L'ordine verrà annullato e la cucina riceverà la notifica. L'azione non è reversibile." confirmLabel="Annulla ordine" />
    </ScreenScroll>
  );
}

/* ═══════════════════ CUCINA — KDS ═══════════════════ */
function KdsTimer({ min, warn = 10, late = 15 }) {
  useTick(1000);
  const elapsed = min * 60 + (Math.floor(Date.now() / 1000) % 60);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const isLate = m >= late, isWarn = m >= warn;
  const col = isLate ? "var(--danger)" : isWarn ? "#9A6912" : "var(--ok-deep)";
  const bg = isLate ? "var(--danger-bg)" : isWarn ? "var(--wait-bg)" : "var(--ok-bg)";
  return <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: col, background: bg, padding: "3px 8px", borderRadius: 8 }}>{m}:{String(s).padStart(2, "0")}</span>;
}
function ScreenKDS({ mobile, orders, onAdvanceItem, onBump, settings = SETTINGS_DEFAULTS }) {
  const [station, setStation] = useState("Tutte");
  const [compact, setCompact] = useState(!!settings.kdsCompatta);
  const kitchenOrders = orders.filter(o => ["confermato", "prep", "pronto", "attesa"].includes(o.stato));
  const stations = ["Tutte", ...STATIONS];

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="chef" title="Cucina · KDS" sub={`${kitchenOrders.length} ticket attivi`}
        actions={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="ok" dot>Live</Badge>
          <Btn size="sm" kind="soft" icon="grid" onClick={() => setCompact(c => !c)}>{compact ? "Espandi" : "Compatta"}</Btn>
        </div>} />

      <div className="scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        <div className="seg">{stations.map(s => <button key={s} className={station === s ? "on" : ""} onClick={() => setStation(s)}>{s}</button>)}</div>
      </div>

      {kitchenOrders.length === 0 ? (
        <Empty tako="chef" title="Tutto pronto!" sub="Nessun ticket in coda. Buon lavoro." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : `repeat(auto-fill,minmax(${compact ? 240 : 300}px,1fr))`, gap: 14, alignItems: "start" }}>
          {kitchenOrders.map(o => {
            const items = station === "Tutte" ? o.items : o.items.filter(i => i.station === station);
            if (!items.length) return null;
            const allReady = items.every(i => i.stato === "pronto");
            return (
              <Card key={o.id} pad={0} className={o.isNew ? "new-row" : ""} style={{ overflow: "hidden", borderColor: allReady ? "var(--ok)" : "var(--hairline)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: allReady ? "var(--ok-bg)" : "var(--sunken)" }}>
                  <span className="num" style={{ width: 38, height: 38, borderRadius: 10, background: o.tipo === "asporto" ? "var(--info)" : "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontSize: 17 }}>{o.tipo === "asporto" ? "A" : o.tavolo}</span>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>{o.tipo === "asporto" ? "Asporto" : "Tavolo " + o.tavolo}</div><div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{o.id}</div></div>
                  <KdsTimer min={o.min} warn={settings.kdsWarn} late={settings.kdsLate} />
                </div>
                <div style={{ padding: "8px 14px" }}>
                  {items.map((it, k) => (
                    <button key={k} className="press" onClick={() => onAdvanceItem(o.id, it._id, it.nome)} style={{ width: "100%", display: "flex", gap: 10, alignItems: "flex-start", padding: compact ? "7px 0" : "9px 0", borderBottom: k < items.length - 1 ? "1px solid var(--hairline)" : "none", textAlign: "left", opacity: it.stato === "pronto" ? .5 : 1 }}>
                      <span className="num" style={{ color: "var(--brand)", fontSize: 16, minWidth: 26 }}>{it.qty}×</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: compact ? 14 : 15.5, fontWeight: 700, color: "var(--ink)", textDecoration: it.stato === "pronto" ? "line-through" : "none" }}>{it.nome}</div>
                        {!compact && it.note && <div style={{ fontSize: 12.5, color: "#9A6912", fontStyle: "italic" }}>“{it.note}”</div>}
                        {!compact && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{it.station}</div>}
                      </div>
                      <span style={{ width: 22, height: 22, borderRadius: 99, border: `2px solid ${it.stato === "pronto" ? "var(--ok)" : "var(--hairline)"}`, background: it.stato === "pronto" ? "var(--ok)" : "transparent", display: "grid", placeItems: "center", flex: "none", marginTop: 2 }}>{it.stato === "pronto" && <Icon name="check" size={12} stroke={3} style={{ color: "#fff" }} />}</span>
                    </button>
                  ))}
                </div>
                <div style={{ padding: "0 14px 14px" }}>
                  <Btn kind={allReady ? "ok" : "soft"} full icon="check" onClick={() => onBump(o.id)}>Bump · Pronto</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </ScreenScroll>
  );
}

Object.assign(window, { euro, ScreenScroll, useTick, ScreenDashboard, ScreenOrdini, ScreenKDS });
