/* ───────────────── Tako Dashboard — gestione ───────────────── */
/* Menu · Statistiche · Analisi Menu · Inventario · Staff · Impostazioni */

/* ═══════════════════ MENU ═══════════════════ */
function ScreenMenu({ mobile }) {
  const [menu, setMenu] = useState(MENU);
  const [edit, setEdit] = useState(null);
  const toggle = (sez, nome) => setMenu(m => m.map(s => s.sezione !== sez ? s : { ...s, piatti: s.piatti.map(p => p.nome === nome ? { ...p, disp: !p.disp } : p) }));
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dish" title="Menu" sub={`${menu.length} sezioni · ${menu.reduce((a, s) => a + s.piatti.length, 0)} piatti`}
        actions={<Btn kind="brand" icon="plus" onClick={() => toast("Nuovo piatto")}>Nuovo piatto</Btn>} />
      {menu.map(s => (
        <div key={s.sezione} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Icon name="more" size={16} style={{ color: "var(--ink-3)", transform: "rotate(90deg)" }} />
            <h3 style={{ fontSize: 17 }}>{s.sezione}</h3>
            <Badge tone="muted">{s.piatti.length}</Badge>
          </div>
          <Card pad={0} style={{ overflow: "hidden" }}>
            {s.piatti.map((p, i) => {
              const margine = Math.round((1 - p.costo / p.prezzo) * 100);
              return (
                <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 12, padding: mobile ? "12px 14px" : "13px 16px", borderBottom: i < s.piatti.length - 1 ? "1px solid var(--hairline)" : "none", opacity: p.disp ? 1 : .55 }}>
                  <Icon name="more" size={16} style={{ color: "var(--ink-3)", transform: "rotate(90deg)", flex: "none" }} />
                  <div style={{ width: 44, height: 44, borderRadius: 11, flex: "none", background: "linear-gradient(135deg,var(--brand-tint),var(--sunken))", display: "grid", placeItems: "center", fontFamily: "var(--f-display)", fontWeight: 900, color: "var(--brand)" }}>{p.nome[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><span style={{ fontWeight: 700, fontSize: 14.5 }}>{p.nome}</span>{p.tag.map(t => <Badge key={t} tone={t === "Top" ? "brand" : t === "Piccante" ? "danger" : "muted"} style={{ fontSize: 10.5, padding: "2px 7px" }}>{t}</Badge>)}</div>
                    {!mobile && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc} · <span style={{ color: margine > 60 ? "var(--ok-deep)" : "var(--wait)" }}>margine {margine}%</span> · {p.station}</div>}
                  </div>
                  <span className="num" style={{ fontSize: 16, flex: "none" }}>{euro(p.prezzo)}</span>
                  <button className="press" onClick={() => toggle(s.sezione, p.nome)} title="Disponibilità" style={{ width: 46, height: 26, borderRadius: 99, flex: "none", background: p.disp ? "var(--ok)" : "var(--ink-3)", position: "relative", transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 3, left: p.disp ? 23 : 3, width: 20, height: 20, borderRadius: 99, background: "#fff", transition: "left .2s var(--spring)" }} />
                  </button>
                  <IconBtn name="edit" tone="ghost" onClick={() => setEdit(p)} />
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      <Overlay open={!!edit} onClose={() => setEdit(null)} anchor={mobile ? "center" : "right"}>
        {edit && <DishEditor dish={edit} mobile={mobile} onClose={() => setEdit(null)} />}
      </Overlay>
    </ScreenScroll>
  );
}
function Field({ label, children }) {
  return <label style={{ display: "block", marginBottom: 14 }}><span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{label}</span>{children}</label>;
}
const inputStyle = { width: "100%", height: 44, padding: "0 13px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--raised)", fontFamily: "var(--f-ui)", fontSize: 14.5, color: "var(--ink)", outline: "none" };
function DishEditor({ dish, mobile, onClose }) {
  const [variants, setVariants] = useState([{ nome: "Porzione grande", mod: 3 }]);
  return (
    <div style={{ width: mobile ? 354 : 420, maxWidth: "100%", height: mobile ? "auto" : "100%", maxHeight: mobile ? "calc(100% - 48px)" : "100%", background: "var(--surface)", borderRadius: mobile ? 24 : 0, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: mobile ? "var(--sh-pop)" : "none" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
        <h3 style={{ flex: 1, fontSize: 18 }}>Modifica piatto</h3><IconBtn name="x" tone="soft" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ height: 120, borderRadius: 14, border: "1.5px dashed var(--hairline)", display: "grid", placeItems: "center", color: "var(--ink-3)", marginBottom: 16, background: "var(--sunken)" }}><div style={{ textAlign: "center" }}><Icon name="download" size={24} style={{ margin: "0 auto 6px" }} /><span style={{ fontSize: 13, fontWeight: 600 }}>Carica immagine</span></div></div>
        <Field label="Nome"><input style={inputStyle} defaultValue={dish.nome} /></Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Prezzo (€)"><input style={inputStyle} type="number" defaultValue={dish.prezzo} /></Field>
          <Field label="Food cost (€)"><input style={inputStyle} type="number" defaultValue={dish.costo} /></Field>
        </div>
        <Field label="Descrizione"><textarea style={{ ...inputStyle, height: 70, padding: 13, resize: "none" }} defaultValue={dish.desc} /></Field>
        <Field label="Stazione cucina"><select style={inputStyle} defaultValue={dish.station}>{STATIONS.map(s => <option key={s}>{s}</option>)}</select></Field>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>Varianti</span><Btn size="sm" kind="soft" icon="plus" onClick={() => setVariants(v => [...v, { nome: "Nuova variante", mod: 0 }])}>Aggiungi</Btn></div>
          {variants.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
              <input style={{ ...inputStyle, flex: 1 }} defaultValue={v.nome} />
              <input style={{ ...inputStyle, width: 80 }} defaultValue={"+" + v.mod} />
              <IconBtn name="trash" tone="soft" style={{ color: "var(--danger)" }} onClick={() => setVariants(vs => vs.filter((_, k) => k !== i))} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
        <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
        <Btn kind="brand" full icon="check" onClick={() => { onClose(); toast("Piatto salvato", { type: "success" }); }}>Salva</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════ STATISTICHE ═══════════════════ */
function ScreenStatistiche({ mobile }) {
  const [periodo, setPeriodo] = useState("7g");
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="pay" title="Statistiche" sub="Performance del locale"
        actions={<div className="seg">{["Oggi", "7g", "30g"].map(p => <button key={p} className={periodo === p ? "on" : ""} onClick={() => setPeriodo(p)}>{p}</button>)}</div>} />
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: mobile ? 12 : 16, marginBottom: 18 }}>
        <Kpi label="Incasso" value={euro(17387)} icon="coins" accent="var(--brand)" trend="up" sub="▲ 8% sett. prec." />
        <Kpi label="Ticket medio" value={euro(33.1)} icon="stats" accent="var(--ok)" />
        <Kpi label="Coperti" value="525" icon="staff" accent="var(--info)" />
        <Kpi label="Conti" value="158" icon="cassa" accent="var(--wait)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Incasso · ultimi 7 giorni</h3>
          <BarChart data={WEEK} h={mobile ? 130 : 180} fmt={(v) => "€" + (v / 1000).toFixed(1) + "k"} />
        </Card>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Orari di punta</h3>
          <BarChart data={PEAK_HOURS} h={mobile ? 130 : 180} color="var(--info)" labelKey="h" valKey="v" fmt={(v) => v} />
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, textAlign: "center" }}>Scansioni QR per ora</p>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Piatti più venduti</h3>
          {TOP_DISHES.map((d, i) => (
            <div key={d.nome} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="num" style={{ width: 26, color: "var(--brand)", fontSize: 16 }}>{i + 1}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{d.nome}</div><Progress value={(d.n / TOP_DISHES[0].n) * 100} /></div>
              <span className="num" style={{ fontSize: 15 }}>{d.n}</span>
            </div>
          ))}
        </Card>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Sessioni QR</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[["Scansioni totali", QR_ANALYTICS.scansioni, "qr"], ["Tasso conversione", QR_ANALYTICS.conversione + "%", "insights"], ["Tempo al 1° ordine", QR_ANALYTICS.tempoPrimo, "clock"]].map(([l, v, ic]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "var(--sunken)", borderRadius: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--raised)", display: "grid", placeItems: "center", color: "var(--brand)" }}><Icon name={ic} size={19} /></span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink-2)" }}>{l}</span>
                <span className="num" style={{ fontSize: 20 }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ScreenScroll>
  );
}

/* ═══════════════════ ANALISI MENU (engineering) ═══════════════════ */
const QUAD = {
  star: { label: "Star", desc: "Alto volume · alto margine", color: "var(--ok)", emoji: "⭐" },
  puzzle: { label: "Puzzle", desc: "Basso volume · alto margine", color: "var(--info)", emoji: "🧩" },
  plow: { label: "Plowhorse", desc: "Alto volume · basso margine", color: "var(--wait)", emoji: "🐴" },
  dog: { label: "Dog", desc: "Basso volume · basso margine", color: "var(--danger)", emoji: "🐕" },
};
function ScreenInsights({ mobile }) {
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dishAlt" title="Analisi Menu" sub="Menu engineering · ultimi 30 giorni"
        actions={<Btn kind="brand" icon="sparkles" onClick={() => toast("Genero consigli AI…", { icon: "sparkles" })}>Suggerimenti AI</Btn>} />

      <Card pad={mobile ? 14 : 22} style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, aspectRatio: mobile ? "1/1.1" : "16/8", background: "var(--hairline)", borderRadius: 14, overflow: "hidden" }}>
          {["puzzle", "star", "dog", "plow"].map(q => {
            const Q = QUAD[q];
            const dishes = ENGINEERING.filter(d => d.cls === q);
            return (
              <div key={q} style={{ background: Q.color + "12", padding: mobile ? 10 : 16, position: "relative", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><span style={{ fontSize: 15 }}>{Q.emoji}</span><span style={{ fontWeight: 800, fontFamily: "var(--f-display)", fontSize: 14.5, color: Q.color }}>{Q.label}</span></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start" }}>
                  {dishes.map(d => <span key={d.nome} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 99, background: "var(--raised)", color: "var(--ink)", boxShadow: "var(--sh-1)" }}>{d.nome}</span>)}
                </div>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%) rotate(-90deg)", transformOrigin: "left", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em" }}>MARGINE →</div>
          <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em" }}>VOLUME →</div>
        </div>
      </Card>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", padding: "12px 16px", background: "var(--sunken)", fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>
          <span style={{ flex: 1 }}>Piatto</span><span style={{ width: 70, textAlign: "right" }}>Volume</span><span style={{ width: 80, textAlign: "right" }}>Margine</span><span style={{ width: 90, textAlign: "right" }}>Classe</span>
        </div>
        {ENGINEERING.sort((a, b) => b.vol - a.vol).map((d, i) => (
          <div key={d.nome} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--hairline)", fontSize: 14 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{d.nome}</span>
            <span className="num" style={{ width: 70, textAlign: "right" }}>{d.vol}</span>
            <span className="num" style={{ width: 80, textAlign: "right", color: d.margine > 60 ? "var(--ok-deep)" : "var(--wait)" }}>{d.margine}%</span>
            <span style={{ width: 90, display: "flex", justifyContent: "flex-end" }}><Badge tone="muted" style={{ background: QUAD[d.cls].color + "1f", color: QUAD[d.cls].color }}>{QUAD[d.cls].label}</Badge></span>
          </div>
        ))}
      </Card>
    </ScreenScroll>
  );
}

/* ═══════════════════ INVENTARIO ═══════════════════ */
function ScreenInventario({ mobile }) {
  const [inv, setInv] = useState(INVENTORY);
  const move = (nome, d) => setInv(v => v.map(x => x.nome === nome ? { ...x, giac: Math.max(0, Math.round((x.giac + d) * 10) / 10) } : x));
  const low = inv.filter(x => x.giac < x.min);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dishAlt" title="Inventario" sub={`${inv.length} ingredienti`} actions={<Btn kind="brand" icon="plus" onClick={() => toast("Aggiungi ingrediente")}>Aggiungi</Btn>} />
      {low.length > 0 && (
        <Card pad={14} style={{ marginBottom: 16, border: "1.5px solid var(--danger)", background: "var(--danger-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Icon name="alert" size={18} style={{ color: "var(--danger)" }} /><span style={{ fontWeight: 700, fontSize: 14, color: "var(--danger)" }}>{low.length} ingredienti sotto scorta: {low.map(x => x.nome).join(", ")}</span></div>
        </Card>
      )}
      <Card pad={0} style={{ overflow: "hidden" }}>
        {inv.map((x, i) => {
          const isLow = x.giac < x.min;
          return (
            <div key={x.nome} style={{ display: "flex", alignItems: "center", gap: 12, padding: mobile ? "12px 14px" : "13px 16px", borderBottom: i < inv.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, fontSize: 14.5 }}>{x.nome}</span>{isLow && <Badge tone="danger" dot>Scorta bassa</Badge>}</div>
                {!mobile && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{x.forn} · min {x.min} {x.unita} · {euro(x.costo)}/{x.unita}</div>}
              </div>
              <div style={{ textAlign: "right", marginRight: 6 }}><div className="num" style={{ fontSize: 18, color: isLow ? "var(--danger)" : "var(--ink)" }}>{x.giac}</div><div style={{ fontSize: 11, color: "var(--ink-3)" }}>{x.unita}</div></div>
              <IconBtn name="minus" tone="soft" size={36} onClick={() => move(x.nome, -1)} />
              <IconBtn name="plus" tone="brand" size={36} onClick={() => move(x.nome, +1)} />
            </div>
          );
        })}
      </Card>
    </ScreenScroll>
  );
}

/* ═══════════════════ STAFF ═══════════════════ */
const ROLE_BADGE = { owner: ["brand", "Titolare"], cameriere: ["info", "Cameriere"], chef: ["wait", "Chef"], cassiere: ["ok", "Cassiere"] };
function ScreenStaff({ mobile }) {
  const online = STAFF.filter(m => m.online).length;
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="hello" title="Staff" sub={`${STAFF.length} membri · ${online} connessi ora`} actions={<Btn kind="brand" icon="plus" onClick={() => toast("Aggiungi membro")}>Aggiungi membro</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {STAFF.map(m => {
          const [tone, label] = ROLE_BADGE[m.ruolo];
          const cols = { owner: "var(--brand)", cameriere: "var(--info)", chef: "var(--wait)", cassiere: "var(--ok)" };
          return (
            <Card key={m.email} pad={16} style={{ opacity: m.attivo ? 1 : .55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ position: "relative", flex: "none" }}>
                  <Avatar initials={m.nome.split(" ").map(w => w[0]).join("")} color={cols[m.ruolo]} size={46} />
                  <span style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderRadius: 99, border: "2.5px solid var(--raised)", background: m.online ? "var(--ok)" : "var(--ink-3)" }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontWeight: 700, fontSize: 15 }}>{m.nome}</span></div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                </div>
                {!m.attivo ? <Badge tone="muted">Disattivo</Badge> : m.online
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: "var(--ok-bg)", color: "var(--ok-deep)", fontSize: 12, fontWeight: 700 }}><span className="live-dot" style={{ width: 7, height: 7 }} />Connesso · Live</span>
                  : <Badge tone="muted">Offline</Badge>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
                <Badge tone={tone}>{label}</Badge>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)" }} className="mono">{m.tel}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <IconBtn name="edit" tone="ghost" onClick={() => toast("Modifica " + m.nome.split(" ")[0])} />
                  <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} onClick={() => toast("Disattiva " + m.nome.split(" ")[0])} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </ScreenScroll>
  );
}

/* ═══════════════════ IMPOSTAZIONI ═══════════════════ */
function Toggle({ on, set }) {
  return <button className="press" onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 99, flex: "none", background: on ? "var(--ok)" : "var(--ink-3)", position: "relative" }}><span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: 99, background: "#fff", transition: "left .2s var(--spring)" }} /></button>;
}
function Row({ label, sub, children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: "1px solid var(--hairline)" }}><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{label}</div>{sub && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>}</div>{children}</div>;
}
const SET_SECTIONS = [
  ["aspetto", "Aspetto", "settings"],
  ["servizio", "Servizio", "orders"],
  ["cucina", "Ordini & Cucina", "kitchen"],
  ["dashboard", "Dashboard", "home"],
  ["generali", "Generali", "euro"],
  ["stampante", "Stampante", "printer"],
];
const numStyle = { ...inputStyle, width: 92, textAlign: "right" };
function ScreenImpostazioni({ mobile, brand, setBrand, settings = SETTINGS_DEFAULTS, setSettings = () => {} }) {
  const [sec, setSec] = useState("aspetto");
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const setKpi = (k, v) => setSettings(s => ({ ...s, kpi: { ...s.kpi, [k]: v } }));
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="bowtie" title="Impostazioni" sub="Personalizza la dashboard del tuo ristorante"
        actions={!mobile && <Btn kind="brand" icon="check" onClick={() => toast("Impostazioni salvate", { type: "success" })}>Salva</Btn>} />
      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: mobile ? 14 : 24, alignItems: "flex-start" }}>
        {mobile ? (
          <div className="scroll" style={{ display: "flex", gap: 8, overflowX: "auto", width: "100%", paddingBottom: 2 }}>
            {SET_SECTIONS.map(([k, l]) => <button key={k} className="press" onClick={() => setSec(k)} style={{ flex: "none", padding: "9px 15px", borderRadius: 99, fontSize: 13.5, fontWeight: 700, background: sec === k ? "var(--brand)" : "var(--sunken)", color: sec === k ? "var(--on-brand)" : "var(--ink-2)" }}>{l}</button>)}
          </div>
        ) : (
          <div style={{ flex: "none", width: 224, display: "flex", flexDirection: "column", gap: 4 }}>
            {SET_SECTIONS.map(([k, l, ic]) => { const on = sec === k; return (
              <button key={k} className="press" onClick={() => setSec(k)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: 12, fontSize: 14.5, fontWeight: on ? 700 : 600, textAlign: "left", background: on ? "var(--raised)" : "transparent", color: on ? "var(--ink)" : "var(--ink-2)", boxShadow: on ? "var(--sh-1)" : "none" }}><Icon name={ic} size={18} style={{ color: on ? "var(--brand)" : "var(--ink-3)" }} />{l}</button>
            ); })}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
          {sec === "aspetto" && (<>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>Colore brand</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 16 }}>Cambia il colore principale di tutta l'interfaccia in tempo reale.</p>
              <div style={{ display: "flex", gap: mobile ? 12 : 18, flexWrap: "wrap" }}>
                {Object.entries(BRAND_PALETTES).map(([k, p]) => { const on = brand === k; return (
                  <button key={k} className="press" onClick={() => setBrand(k)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 54, height: 54, borderRadius: 16, background: p.brand, display: "grid", placeItems: "center", boxShadow: on ? `0 0 0 3px var(--raised), 0 0 0 5px ${p.brand}` : "var(--sh-1)", transition: "box-shadow .2s" }}>{on && <Icon name="check" size={26} stroke={2.6} style={{ color: p.on }} />}</span>
                    <span style={{ fontSize: 12.5, fontWeight: on ? 700 : 600, color: on ? "var(--ink)" : "var(--ink-2)" }}>{p.label}</span>
                  </button>
                ); })}
              </div>
            </Card>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Logo</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ width: 64, height: 64, borderRadius: 16, background: "var(--brand-tint)", display: "grid", placeItems: "center", flex: "none" }}><img src="assets/tako-chef.png" alt="" style={{ height: 48 }} /></span>
                <div style={{ flex: 1, height: 64, borderRadius: 14, border: "1.5px dashed var(--hairline)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13, fontWeight: 600 }}>Trascina o carica un PNG trasparente</div>
              </div>
            </Card>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Dati ristorante</h3>
              <Field label="Nome"><input style={inputStyle} value={settings.nome} onChange={e => set("nome", e.target.value)} /></Field>
              <Field label="Indirizzo"><input style={inputStyle} value={settings.indirizzo} onChange={e => set("indirizzo", e.target.value)} /></Field>
              <Field label="Telefono"><input style={inputStyle} value={settings.telefono} onChange={e => set("telefono", e.target.value)} /></Field>
            </Card>
          </>)}

          {sec === "servizio" && (
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Modalità di servizio</h3>
              <Row label="Servizio al tavolo" sub="Ordini dai QR ai tavoli"><Toggle on={settings.servizioTavolo} set={v => set("servizioTavolo", v)} /></Row>
              <Row label="Asporto" sub="Ordini da ritirare"><Toggle on={settings.asporto} set={v => set("asporto", v)} /></Row>
              <Row label="Paga al tavolo" sub="Pagamento dal telefono del cliente"><Toggle on={settings.pagaTavolo} set={v => set("pagaTavolo", v)} /></Row>
              <Row label="Prenotazioni" sub="Accetta prenotazioni online"><Toggle on={settings.prenotazioni} set={v => set("prenotazioni", v)} /></Row>
              <Row label="Assistente AI" sub="Suggerimenti e risposte ai clienti"><Toggle on={settings.ai} set={v => set("ai", v)} /></Row>
              <Row label="Coperto" sub="Aggiunto automaticamente al conto"><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{settings.copertoOn && <input type="number" step="0.5" style={numStyle} value={settings.coperto} onChange={e => set("coperto", parseFloat(e.target.value) || 0)} />}<Toggle on={settings.copertoOn} set={v => set("copertoOn", v)} /></div></Row>
              <Row label="Mance suggerite" sub="Mostra 5/10/15% in cassa"><Toggle on={settings.manceSuggerite} set={v => set("manceSuggerite", v)} /></Row>
            </Card>
          )}

          {sec === "cucina" && (
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Ordini & Cucina</h3>
              <Row label="Suoni nuovo ordine" sub="Bip all'arrivo di un ordine"><Toggle on={settings.suoniOrdini} set={v => set("suoniOrdini", v)} /></Row>
              <Row label="Auto-conferma ordini" sub="Conferma in automatico i nuovi ordini"><Toggle on={settings.autoConferma} set={v => set("autoConferma", v)} /></Row>
              <Row label="Stampa automatica comanda" sub="Invia alla stampante alla chiusura"><Toggle on={settings.stampaAuto} set={v => set("stampaAuto", v)} /></Row>
              <Row label="Vista KDS compatta" sub="Cucina più densa di default"><Toggle on={settings.kdsCompatta} set={v => set("kdsCompatta", v)} /></Row>
              <Row label="Soglia ritardo · giallo" sub="Minuti prima dell'avviso giallo in cucina"><div style={{ display: "flex", alignItems: "center", gap: 7 }}><input type="number" style={numStyle} value={settings.kdsWarn} onChange={e => set("kdsWarn", parseInt(e.target.value) || 0)} /><span style={{ fontSize: 13, color: "var(--ink-3)" }}>min</span></div></Row>
              <Row label="Soglia ritardo · rosso" sub="Minuti prima dell'avviso rosso in cucina"><div style={{ display: "flex", alignItems: "center", gap: 7 }}><input type="number" style={numStyle} value={settings.kdsLate} onChange={e => set("kdsLate", parseInt(e.target.value) || 0)} /><span style={{ fontSize: 13, color: "var(--ink-3)" }}>min</span></div></Row>
            </Card>
          )}

          {sec === "dashboard" && (<>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Home</h3>
              <Row label="Widget di setup" sub="Mostra l'onboarding finché incompleto"><Toggle on={settings.mostraOnboarding} set={v => set("mostraOnboarding", v)} /></Row>
            </Card>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>KPI visibili in home</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 8 }}>Scegli quali numeri vedere a colpo d'occhio.</p>
              <Row label="Incasso oggi"><Toggle on={settings.kpi.incasso} set={v => setKpi("incasso", v)} /></Row>
              <Row label="Ordini attivi"><Toggle on={settings.kpi.ordini} set={v => setKpi("ordini", v)} /></Row>
              <Row label="Ticket medio"><Toggle on={settings.kpi.ticket} set={v => setKpi("ticket", v)} /></Row>
              <Row label="Coperti oggi"><Toggle on={settings.kpi.coperti} set={v => setKpi("coperti", v)} /></Row>
            </Card>
          </>)}

          {sec === "generali" && (
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Generali</h3>
              <Field label="Valuta"><select style={{ ...inputStyle }} value={settings.valuta} onChange={e => set("valuta", e.target.value)}><option value="EUR">Euro (€)</option><option value="USD">Dollaro ($)</option><option value="GBP">Sterlina (£)</option><option value="CHF">Franco (CHF)</option></select></Field>
              <div style={{ display: "flex", gap: 12 }}>
                <Field label="IVA (%)"><input type="number" style={inputStyle} value={settings.iva} onChange={e => set("iva", parseInt(e.target.value) || 0)} /></Field>
                <Field label="Lingua default"><select style={inputStyle} value={settings.linguaDefault} onChange={e => set("linguaDefault", e.target.value)}>{settings.lingue.map(l => <option key={l}>{l}</option>)}</select></Field>
              </div>
              <Field label="Fuso orario"><input style={inputStyle} value={settings.fuso} onChange={e => set("fuso", e.target.value)} /></Field>
              <Row label="Lingue menu" sub="Lingue disponibili per i clienti"><div style={{ display: "flex", gap: 6 }}>{settings.lingue.map(l => <Badge key={l} tone="muted">{l}</Badge>)}</div></Row>
            </Card>
          )}

          {sec === "stampante" && (
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Stampante termica</h3>
              <div style={{ display: "flex", gap: 12 }}>
                <Field label="Indirizzo IP"><input style={inputStyle} value={settings.printerIp} onChange={e => set("printerIp", e.target.value)} /></Field>
                <Field label="Porta"><input style={{ ...inputStyle, width: 110 }} value={settings.printerPort} onChange={e => set("printerPort", e.target.value)} /></Field>
              </div>
              <Row label="Stato" sub={`${settings.printerIp} : ${settings.printerPort}`}><Badge tone="ok" dot>Connessa</Badge></Row>
              <div style={{ marginTop: 14 }}><Btn kind="soft" icon="printer" onClick={() => toast("Stampa di prova inviata", { icon: "printer" })}>Stampa di prova</Btn></div>
            </Card>
          )}

          {mobile && (
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn kind="soft" full icon="refresh" onClick={() => { setBrand("arancione"); setSettings(SETTINGS_DEFAULTS); toast("Impostazioni ripristinate"); }}>Ripristina</Btn>
              <Btn kind="brand" full icon="check" onClick={() => toast("Impostazioni salvate", { type: "success" })}>Salva</Btn>
            </div>
          )}
        </div>
      </div>
    </ScreenScroll>
  );
}

Object.assign(window, { ScreenMenu, ScreenStatistiche, ScreenInsights, ScreenInventario, ScreenStaff, ScreenImpostazioni });
