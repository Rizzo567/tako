/* ───────────────── Tako Dashboard — gestione ───────────────── */
/* Menu · Statistiche · Analisi Menu · Inventario · Staff · Impostazioni */

/* ═══════════════════ MENU ═══════════════════ */
function ScreenMenu({ mobile }) {
  const [menu, setMenu] = useState(MENU);
  const [edit, setEdit] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [secOpen, setSecOpen] = useState(false);
  const [secName, setSecName] = useState("");
  const [secLoading, setSecLoading] = useState(false);
  const previewCount = preview ? preview.sections.reduce((a, s) => a + s.items.length, 0) : 0;
  const toggle = async (sez, nome) => {
    // trova il piatto reale per id prima dell'update ottimistico
    const sezione = menu.find(s => s.sezione === sez);
    const piatto = sezione && sezione.piatti.find(p => p.nome === nome);
    const nuovoValore = piatto ? !piatto.disp : true;
    // update ottimistico locale (UI risponde subito)
    setMenu(m => m.map(s => s.sezione !== sez ? s : { ...s, piatti: s.piatti.map(p => p.nome === nome ? { ...p, disp: nuovoValore } : p) }));
    if (!piatto || !piatto._id) return; // niente id reale: resta solo locale
    try {
      await window.TakoActions.menuToggle(piatto._id, nuovoValore);
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
      await window.takoReload(); // ripristina stato reale
    }
  };
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dish" title="Menu" sub={`${menu.length} sezioni · ${menu.reduce((a, s) => a + s.piatti.length, 0)} piatti`}
        actions={<div style={{ display: "flex", gap: 8 }}>
          <Btn kind="soft" icon="sparkles" onClick={() => setImportOpen(true)}>Importa da testo</Btn>
          <Btn kind="soft" icon="plus" onClick={() => { setSecName(""); setSecOpen(true); }}>Nuova sezione</Btn>
          <Btn kind="brand" icon="plus" onClick={async () => {
          // Scelta: creo un piatto minimale sulla prima sezione e ricarico.
          // L'utente lo rifinisce poi dal modal di modifica. Tiene la UI invariata.
          const primaSez = menu[0];
          if (!primaSez || !primaSez._id) { toast("Crea prima una sezione di menu", { type: "error" }); return; }
          try {
            await window.TakoActions.menuCreateItem(primaSez._id, { name: "Nuovo piatto", price: 0 });
            toast("Piatto creato", { type: "success" });
            await window.takoReload();
          } catch (e) { toast(e.message, { type: "error" }); }
        }}>Nuovo piatto</Btn>
        </div>} />
      {menu.map((s, si) => (
        <div key={s._id || si} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Icon name="more" size={16} style={{ color: "var(--ink-3)", transform: "rotate(90deg)" }} />
            <h3 style={{ fontSize: 17 }}>{s.sezione}</h3>
            <Badge tone="muted">{s.piatti.length}</Badge>
          </div>
          <Card pad={0} style={{ overflow: "hidden" }}>
            {s.piatti.map((p, i) => {
              // Guardia divisione per zero: con prezzo 0 il margine è indefinito → "—".
              const hasMargin = p.prezzo > 0;
              const margine = hasMargin ? Math.round((1 - p.costo / p.prezzo) * 100) : null;
              return (
                <div key={p._id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: mobile ? "12px 14px" : "13px 16px", borderBottom: i < s.piatti.length - 1 ? "1px solid var(--hairline)" : "none", opacity: p.disp ? 1 : .55 }}>
                  <Icon name="more" size={16} style={{ color: "var(--ink-3)", transform: "rotate(90deg)", flex: "none" }} />
                  <div style={{ width: 44, height: 44, borderRadius: 11, flex: "none", background: "linear-gradient(135deg,var(--brand-tint),var(--sunken))", display: "grid", placeItems: "center", fontFamily: "var(--f-display)", fontWeight: 900, color: "var(--brand)" }}>{p.nome[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><span style={{ fontWeight: 700, fontSize: 14.5 }}>{p.nome}</span>{p.tag.map(t => <Badge key={t} tone={t === "Top" ? "brand" : t === "Piccante" ? "danger" : "muted"} style={{ fontSize: 10.5, padding: "2px 7px" }}>{t}</Badge>)}</div>
                    {!mobile && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc} · <span style={{ color: hasMargin && margine > 60 ? "var(--ok-deep)" : "var(--wait)" }}>margine {hasMargin ? margine + "%" : "—"}</span> · {p.station}</div>}
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
      <Overlay open={secOpen} onClose={() => { if (!secLoading) setSecOpen(false); }} anchor="center">
        <div style={{ width: mobile ? 320 : 400, maxWidth: "100%", background: "var(--surface)", borderRadius: 24, overflow: "hidden", boxShadow: "var(--sh-pop)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ flex: 1, fontSize: 18 }}>Nuova sezione</h3>
            <IconBtn name="x" tone="soft" onClick={() => { if (!secLoading) setSecOpen(false); }} />
          </div>
          <div style={{ padding: 20 }}>
            <Field label="Nome sezione">
              <input style={inputStyle} value={secName} autoFocus placeholder="Es. Antipasti"
                onChange={e => setSecName(e.target.value)} />
            </Field>
          </div>
          <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
            <Btn kind="soft" full onClick={() => { if (!secLoading) setSecOpen(false); }}>Annulla</Btn>
            <Btn kind="brand" full icon="plus" onClick={async () => {
              if (!secName.trim()) { toast("Inserisci un nome", { type: "error" }); return; }
              setSecLoading(true);
              try {
                await window.TakoActions.menuCreateSection(secName.trim());
                toast("Sezione creata", { type: "success" });
                await window.takoReload();
                setSecOpen(false); setSecName("");
              } catch (e) { toast(e.message, { type: "error" }); }
              finally { setSecLoading(false); }
            }}>{secLoading ? "Creo…" : "Crea"}</Btn>
          </div>
        </div>
      </Overlay>
      <Overlay open={importOpen} onClose={() => { if (!loading) setImportOpen(false); }} anchor="center">
        <div style={{ width: mobile ? 354 : 560, maxWidth: "100%", maxHeight: "calc(100% - 48px)", background: "var(--surface)", borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--sh-pop)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ flex: 1, fontSize: 18 }}>{preview ? "Anteprima importazione" : "Importa menu da testo"}</h3>
            <IconBtn name="x" tone="soft" onClick={() => { if (!loading) setImportOpen(false); }} />
          </div>
          <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {!preview ? (<>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>Incolla un menu in formato libero: l'AI lo struttura in sezioni e piatti con prezzi.</p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Incolla qui il menu (es. da Word/PDF/foto trascritta)…"
                style={{ width: "100%", minHeight: 220, padding: 12, borderRadius: 12, border: "1px solid var(--hairline)", fontSize: 14, fontFamily: "var(--f-ui)", color: "var(--ink)", background: "var(--raised)", outline: "none", resize: "vertical" }}
              />
            </>) : (<>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>{previewCount} piatti in {preview.sections.length} sezioni</p>
              {preview.sections.map((sez, si) => (
                <div key={si} style={{ marginBottom: 18 }}>
                  <h4 style={{ fontSize: 15, marginBottom: 8, color: "var(--brand)" }}>{sez.name}</h4>
                  <Card pad={0} style={{ overflow: "hidden" }}>
                    {sez.items.map((it, ii) => (
                      <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderBottom: ii < sez.items.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 14.5 }}>{it.name}</span>
                            {(it.allergens || []).map((a, ai) => <Badge key={ai} tone="muted" style={{ fontSize: 10.5, padding: "2px 7px" }}>{a}</Badge>)}
                          </div>
                          {it.description && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{it.description}</div>}
                        </div>
                        <span className="num" style={{ fontSize: 15, flex: "none" }}>{euro(it.price)}</span>
                      </div>
                    ))}
                  </Card>
                </div>
              ))}
            </>)}
          </div>
          <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
            {!preview ? (
              <Btn kind="brand" full icon="sparkles" onClick={async () => {
                if (!text.trim()) { toast("Incolla prima un testo", { type: "error" }); return; }
                setLoading(true);
                try {
                  const p = await window.TakoActions.menuImportText(window.__menuId, text);
                  setPreview(p);
                } catch (e) {
                  toast(e.code === "AI_UNAVAILABLE" ? "AI non disponibile (manca GROQ_API_KEY)" : e.message, { type: "error" });
                } finally { setLoading(false); }
              }}>{loading ? "Analizzo…" : "Analizza"}</Btn>
            ) : (<>
              <Btn kind="soft" full onClick={() => { if (!loading) setPreview(null); }}>Indietro</Btn>
              <Btn kind="brand" full icon="check" onClick={async () => {
                setLoading(true);
                try {
                  await window.TakoActions.menuImportConfirm(window.__menuId, preview.sections);
                  toast("Menu importato", { type: "success" });
                  setImportOpen(false); setText(""); setPreview(null);
                  await window.takoReload();
                } catch (e) {
                  toast(e.message, { type: "error" });
                } finally { setLoading(false); }
              }}>{loading ? "Importo…" : "Conferma importazione"}</Btn>
            </>)}
          </div>
        </div>
      </Overlay>
    </ScreenScroll>
  );
}
function Field({ label, children }) {
  return <label style={{ display: "block", marginBottom: 14 }}><span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{label}</span>{children}</label>;
}
const inputStyle = { width: "100%", height: 44, padding: "0 13px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--raised)", fontFamily: "var(--f-ui)", fontSize: 14.5, color: "var(--ink)", outline: "none" };
function DishEditor({ dish, mobile, onClose }) {
  // Campi controllati (niente più DOM-scraping per posizione: fragile e ambiguo con le varianti).
  const [name, setName] = useState(dish.nome || "");
  const [price, setPrice] = useState(dish.prezzo != null ? dish.prezzo : 0);
  const [cost, setCost] = useState(dish.costo != null ? dish.costo : 0);
  const [desc, setDesc] = useState(dish.desc || "");
  const [station, setStation] = useState(dish.station || STATIONS[0]);
  // Varianti REALI dal backend (dish.varianti = [{ _id, nome, mod }]).
  const [variants, setVariants] = useState(() => (dish.varianti || []).map(v => ({ _id: v._id, nome: v.nome, mod: v.mod })));
  const origVariants = useRef((dish.varianti || []).map(v => ({ _id: v._id, nome: v.nome, mod: v.mod })));
  const [confirmDel, setConfirmDel] = useState(false);
  const [imageUrl, setImageUrl] = useState(dish.img || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Traduzioni multilingua: lingue configurate diverse dalla default (SETTINGS_DEFAULTS).
  const extraLangs = (SETTINGS_DEFAULTS.lingue || []).filter(l => String(l).toUpperCase() !== String(SETTINGS_DEFAULTS.linguaDefault || "IT").toUpperCase());
  const [trans, setTrans] = useState(() => {
    const m = {};
    for (const l of extraLangs) {
      const t = (dish.traduzioni || []).find(x => String(x.lang).toLowerCase() === String(l).toLowerCase());
      m[l] = { name: t ? (t.name || "") : "", description: t ? (t.description || "") : "" };
    }
    return m;
  });
  const setTr = (lang, key, val) => setTrans(m => ({ ...m, [lang]: { ...(m[lang] || {}), [key]: val } }));
  const setV = (i, key, val) => setVariants(vs => vs.map((v, k) => k === i ? { ...v, [key]: val } : v));
  const onPickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // permette di ri-selezionare lo stesso file
    if (!file) return;
    setUploading(true);
    try {
      const res = await window.TakoActions.uploadImage(file);
      setImageUrl(res.url);
      toast("Immagine caricata", { type: "success" });
    } catch (err) {
      toast(err.message || "Upload immagine fallito", { type: "error" });
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    if (saving) return;
    if (!dish._id) { onClose(); toast("Piatto salvato", { type: "success" }); return; }
    setSaving(true);
    try {
      await window.TakoActions.menuSaveItem(dish._id, {
        name, price: isNaN(parseFloat(price)) ? undefined : Number(price),
        costPrice: isNaN(parseFloat(cost)) ? undefined : Number(cost),
        description: desc, kitchenStation: station,
        imageUrl: imageUrl || undefined,
      });
      // Varianti: il backend espone solo POST/DELETE (niente PATCH) → "modifica" = elimina + ricrea.
      const cur = variants.filter(v => String(v.nome || "").trim());
      const orig = origVariants.current;
      for (const o of orig) {
        if (o._id && !cur.some(v => v._id === o._id)) await window.TakoActions.variantDelete(dish._id, o._id);
      }
      for (const v of cur) {
        const o = v._id ? orig.find(x => x._id === v._id) : null;
        const changed = o && (o.nome !== v.nome || Number(o.mod) !== Number(v.mod));
        if (!v._id) await window.TakoActions.variantCreate(dish._id, v.nome.trim(), Number(v.mod) || 0);
        else if (changed) { await window.TakoActions.variantDelete(dish._id, v._id); await window.TakoActions.variantCreate(dish._id, v.nome.trim(), Number(v.mod) || 0); }
      }
      // Traduzioni: upsert per ogni lingua non-default; se svuotate → elimina.
      for (const l of extraLangs) {
        const tr = trans[l] || { name: "", description: "" };
        const hasContent = String(tr.name || "").trim() || String(tr.description || "").trim();
        const had = (dish.traduzioni || []).some(x => String(x.lang).toLowerCase() === String(l).toLowerCase());
        if (hasContent) await window.TakoActions.translationSave(dish._id, String(l).toLowerCase(), { name: (tr.name || "").trim(), description: (tr.description || "").trim() || undefined });
        else if (had) await window.TakoActions.translationDelete(dish._id, String(l).toLowerCase());
      }
      await window.takoReload();
      onClose();
      toast("Piatto salvato", { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ width: mobile ? 354 : 420, maxWidth: "100%", height: mobile ? "auto" : "100%", maxHeight: mobile ? "calc(100% - 48px)" : "100%", background: "var(--surface)", borderRadius: mobile ? 24 : 0, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: mobile ? "var(--sh-pop)" : "none" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
        <h3 style={{ flex: 1, fontSize: 18 }}>Modifica piatto</h3><IconBtn name="x" tone="soft" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <label style={{ position: "relative", display: "block", height: 120, borderRadius: 14, border: "1.5px dashed var(--hairline)", overflow: "hidden", cursor: uploading ? "wait" : "pointer", color: "var(--ink-3)", marginBottom: 16, background: imageUrl ? "var(--surface)" : "var(--sunken)" }}>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPickImage} disabled={uploading} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "inherit" }} />
          {imageUrl ? (
            <img src={imageUrl} alt="Immagine piatto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={{ textAlign: "center" }}><Icon name="download" size={24} style={{ margin: "0 auto 6px" }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{uploading ? "Carico…" : "Carica immagine"}</span></div>
            </div>
          )}
          {imageUrl && !uploading && (
            <span style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 8 }}>Cambia</span>
          )}
        </label>
        <Field label="Nome"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} /></Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Prezzo (€)"><input style={inputStyle} type="number" value={price} onChange={e => setPrice(e.target.value)} /></Field>
          <Field label="Food cost (€)"><input style={inputStyle} type="number" value={cost} onChange={e => setCost(e.target.value)} /></Field>
        </div>
        <Field label="Descrizione"><textarea style={{ ...inputStyle, height: 70, padding: 13, resize: "none" }} value={desc} onChange={e => setDesc(e.target.value)} /></Field>
        <Field label="Stazione cucina"><select style={inputStyle} value={station} onChange={e => setStation(e.target.value)}>{STATIONS.map(s => <option key={s}>{s}</option>)}</select></Field>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>Varianti</span><Btn size="sm" kind="soft" icon="plus" onClick={() => setVariants(v => [...v, { nome: "", mod: 0 }])}>Aggiungi</Btn></div>
          {variants.length === 0 && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 7 }}>Nessuna variante. Es. “Porzione grande” con modificatore di prezzo.</div>}
          {variants.map((v, i) => (
            <div key={v._id || ("new" + i)} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Nome variante" value={v.nome} onChange={e => setV(i, "nome", e.target.value)} />
              <input style={{ ...inputStyle, width: 90 }} type="number" step="0.5" placeholder="+€" value={v.mod} onChange={e => setV(i, "mod", e.target.value)} />
              <IconBtn name="trash" tone="soft" style={{ color: "var(--danger)" }} onClick={() => setVariants(vs => vs.filter((_, k) => k !== i))} />
            </div>
          ))}
        </div>
        {dish._id && extraLangs.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>Traduzioni menu</div>
            {extraLangs.map(l => (
              <div key={l} style={{ marginBottom: 10, padding: 10, background: "var(--sunken)", borderRadius: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", marginBottom: 6 }}>{String(l).toUpperCase()}</div>
                <input style={{ ...inputStyle, marginBottom: 7 }} placeholder={"Nome — " + (name || "originale")} value={trans[l] ? trans[l].name : ""} onChange={e => setTr(l, "name", e.target.value)} />
                <textarea style={{ ...inputStyle, height: 54, padding: 11, resize: "none" }} placeholder="Descrizione (opzionale)" value={trans[l] ? trans[l].description : ""} onChange={e => setTr(l, "description", e.target.value)} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "0 20px 4px" }}>
        <Btn kind="danger" full icon="trash" onClick={() => setConfirmDel(true)}>Elimina piatto</Btn>
      </div>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} danger
        title="Eliminare il piatto?" body="Il piatto verrà rimosso dal menu." confirmLabel="Elimina"
        onConfirm={async () => {
          if (!dish._id) { setConfirmDel(false); return; }
          try {
            await window.TakoActions.menuDeleteItem(dish._id);
            toast("Piatto eliminato", { type: "success" });
            await window.takoReload();
            setConfirmDel(false);
            onClose();
          } catch (e) { toast(e.message, { type: "error" }); setConfirmDel(false); }
        }} />
      <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
        <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
        <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvo…" : "Salva"}</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════ STATISTICHE ═══════════════════ */
function ScreenStatistiche({ mobile }) {
  const [periodo, setPeriodo] = useState("7g");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await window.TakoActions.statsRange(periodo === "Oggi" ? 1 : periodo === "30g" ? 30 : 7);
        if (alive) setStats(d);
      } catch (e) {
        if (alive) { setStats(null); toast(e.message, { type: "error" }); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [periodo]);
  // KPI reali dal periodo selezionato (— finché non arrivano i dati)
  const kIncasso = stats ? euro(Number(periodo === "Oggi" ? (stats.todayRevenue ?? stats.revenue) : stats.revenue) || 0) : "—";
  const kTicket = stats ? euro(Number(stats.avgTicket) || 0) : "—";
  const kCoperti = stats ? String(stats.totalCovers || 0) : "—";
  const kConti = stats ? String(stats.billsCount || 0) : "—";
  // grafici dal periodo selezionato (fallback ai globali precaricati)
  const DOW = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const week = stats && stats.dailyRevenue ? stats.dailyRevenue.map(d => ({ g: DOW[new Date(d.date).getDay()], v: Number(d.amount) || 0 })) : WEEK;
  const peak = stats && stats.sessions && stats.sessions.scansPerHour ? stats.sessions.scansPerHour.map(s => ({ h: String(s.hour), v: s.count })) : PEAK_HOURS;
  const top = stats && stats.topItems ? stats.topItems.map(t => ({ nome: t.name, n: t.qty })) : TOP_DISHES;
  const chartTitle = periodo === "Oggi" ? "Incasso · oggi" : periodo === "30g" ? "Incasso · ultimi 30 giorni" : "Incasso · ultimi 7 giorni";
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="pay" title="Statistiche" sub="Performance del locale"
        actions={<div className="seg">{["Oggi", "7g", "30g"].map(p => <button key={p} className={periodo === p ? "on" : ""} onClick={() => setPeriodo(p)}>{p}</button>)}</div>} />
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: mobile ? 12 : 16, marginBottom: 18 }}>
        <Kpi label="Incasso" value={loading && !stats ? "…" : kIncasso} icon="coins" accent="var(--brand)" trend="up" />
        <Kpi label="Ticket medio" value={loading && !stats ? "…" : kTicket} icon="stats" accent="var(--ok)" />
        <Kpi label="Coperti" value={loading && !stats ? "…" : kCoperti} icon="staff" accent="var(--info)" />
        <Kpi label="Conti" value={loading && !stats ? "…" : kConti} icon="cassa" accent="var(--wait)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>{chartTitle}</h3>
          <BarChart data={week} h={mobile ? 130 : 180} fmt={(v) => "€" + (v / 1000).toFixed(1) + "k"} />
        </Card>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Orari di punta</h3>
          <BarChart data={peak} h={mobile ? 130 : 180} color="var(--info)" labelKey="h" valKey="v" fmt={(v) => v} />
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, textAlign: "center" }}>Scansioni QR per ora</p>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card pad={mobile ? 16 : 22}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Piatti più venduti</h3>
          {top.length ? top.map((d, i) => (
            <div key={d.nome} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="num" style={{ width: 26, color: "var(--brand)", fontSize: 16 }}>{i + 1}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{d.nome}</div><Progress value={top[0].n ? (d.n / top[0].n) * 100 : 0} /></div>
              <span className="num" style={{ fontSize: 15 }}>{d.n}</span>
            </div>
          )) : <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Nessun dato nel periodo.</p>}
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dishAlt" title="Analisi Menu" sub="Menu engineering · ultimi 30 giorni"
        actions={<Btn kind="brand" icon="sparkles" onClick={async () => {
          setAiLoading(true);
          try {
            const r = await window.TakoActions.insightsAi();
            setAiSuggestions(r.suggestions || []);
            if (!(r.suggestions || []).length) toast("Nessun suggerimento");
          } catch (e) {
            toast(e.code === "AI_UNAVAILABLE" ? "AI non disponibile (manca GROQ_API_KEY)" : e.message, { type: "error" });
          } finally { setAiLoading(false); }
        }}>{aiLoading ? "Genero…" : "Suggerimenti AI"}</Btn>} />

      {aiSuggestions && aiSuggestions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Icon name="sparkles" size={16} style={{ color: "var(--brand)" }} />
            <h3 style={{ fontSize: 16 }}>Suggerimenti AI</h3>
            <Badge tone="brand">{aiSuggestions.length}</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            {aiSuggestions.map((s, i) => (
              <Card key={i} pad={16}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", flex: 1, minWidth: 0 }}>{s.itemName}</span>
                  {s.estimatedMonthlyImpact && <Badge tone="ok">{s.estimatedMonthlyImpact}</Badge>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--brand)", marginBottom: 4 }}>{s.action}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45 }}>{s.reason}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

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
  const [impOpen, setImpOpen] = useState(false);
  const [impText, setImpText] = useState("");
  const [impPreview, setImpPreview] = useState(null);
  const [impLoading, setImpLoading] = useState(false);
  const move = async (nome, d) => {
    const x = inv.find(i => i.nome === nome);
    // update ottimistico locale (UI risponde subito)
    setInv(v => v.map(i => i.nome === nome ? { ...i, giac: Math.max(0, Math.round((i.giac + d) * 10) / 10) } : i));
    if (!x || !x._id) return; // niente id reale: resta solo locale
    try {
      await window.TakoActions.invMove(x._id, d > 0 ? "load" : "unload", Math.abs(d));
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
      await window.takoReload(); // ripristina stato reale
    }
  };
  const low = inv.filter(x => x.giac < x.min);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dishAlt" title="Inventario" sub={`${inv.length} ingredienti`} actions={<div style={{ display: "flex", gap: 8 }}>
        <Btn kind="soft" icon="sparkles" onClick={() => setImpOpen(true)}>Importa da testo</Btn>
        <Btn kind="brand" icon="plus" onClick={async () => {
        // Nessun form in questa UI: creo un ingrediente minimale e ricarico (l'utente lo rifinisce poi).
        try {
          await window.TakoActions.invCreate({ name: "Nuovo", unit: "kg", quantity: 0, minQuantity: 0 });
          toast("Ingrediente aggiunto", { type: "success" });
          await window.takoReload();
        } catch (e) { toast(e.message, { type: "error" }); }
      }}>Aggiungi</Btn>
        </div>} />
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
      <Overlay open={impOpen} onClose={() => { if (!impLoading) setImpOpen(false); }} anchor="center">
        <div style={{ width: mobile ? 354 : 560, maxWidth: "100%", maxHeight: "calc(100% - 48px)", background: "var(--surface)", borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--sh-pop)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ flex: 1, fontSize: 18 }}>{impPreview ? "Anteprima importazione" : "Importa ingredienti da testo"}</h3>
            <IconBtn name="x" tone="soft" onClick={() => { if (!impLoading) setImpOpen(false); }} />
          </div>
          <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {!impPreview ? (<>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>Incolla una lista di ingredienti/scorte: l'AI la struttura.</p>
              <textarea
                value={impText}
                onChange={e => setImpText(e.target.value)}
                placeholder="Incolla qui gli ingredienti (es. Mozzarella 5kg, Pomodoro 10kg, ...)…"
                style={{ width: "100%", minHeight: 220, padding: 12, borderRadius: 12, border: "1px solid var(--hairline)", fontSize: 14, fontFamily: "var(--f-ui)", color: "var(--ink)", background: "var(--raised)", outline: "none", resize: "vertical" }}
              />
            </>) : (<>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>{impPreview.items.length} ingredienti</p>
              <Card pad={0} style={{ overflow: "hidden" }}>
                {impPreview.items.map((it, ii) => (
                  <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderBottom: ii < impPreview.items.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{it.name}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>giacenza {it.quantity} {it.unit} · min {it.minQuantity}{it.costPerUnit != null ? ` · €${it.costPerUnit}/${it.unit}` : ""}{it.supplier ? ` · ${it.supplier}` : ""}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </>)}
          </div>
          <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
            {!impPreview ? (
              <Btn kind="brand" full icon="sparkles" onClick={async () => {
                if (!impText.trim()) { toast("Incolla prima un testo", { type: "error" }); return; }
                setImpLoading(true);
                try {
                  const p = await window.TakoActions.invImportText(impText);
                  setImpPreview(p);
                } catch (e) {
                  toast(e.code === "AI_UNAVAILABLE" ? "AI non disponibile (manca GROQ_API_KEY)" : e.message, { type: "error" });
                } finally { setImpLoading(false); }
              }}>{impLoading ? "Analizzo…" : "Analizza"}</Btn>
            ) : (<>
              <Btn kind="soft" full onClick={() => { if (!impLoading) setImpPreview(null); }}>Indietro</Btn>
              <Btn kind="brand" full icon="check" onClick={async () => {
                setImpLoading(true);
                try {
                  await window.TakoActions.invImportConfirm(impPreview.items);
                  toast("Ingredienti importati", { type: "success" });
                  setImpOpen(false); setImpText(""); setImpPreview(null);
                  await window.takoReload();
                } catch (e) {
                  toast(e.message, { type: "error" });
                } finally { setImpLoading(false); }
              }}>{impLoading ? "Importo…" : "Conferma importazione"}</Btn>
            </>)}
          </div>
        </div>
      </Overlay>
    </ScreenScroll>
  );
}

/* ═══════════════════ STAFF ═══════════════════ */
const ROLE_BADGE = { owner: ["brand", "Titolare"], cameriere: ["info", "Cameriere"], chef: ["wait", "Chef"], cassiere: ["ok", "Cassiere"] };
/* ruoli assegnabili dallo staff (il backend NON accetta 'owner' in create/patch) */
const STAFF_ROLE_OPTS = [["cameriere", "Cameriere"], ["chef", "Chef"], ["cassiere", "Cassiere"]];
/* Modale form membro staff — creazione e modifica (campi reali di /staff). */
function StaffFormModal({ open, onClose, member }) {
  const isEdit = !!member;
  const isOwner = isEdit && member.ruolo === "owner";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [ruolo, setRuolo] = useState("cameriere");
  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (member) { setNome(member.nome || ""); setEmail(member.email || ""); setRuolo(member.ruolo === "owner" ? "cameriere" : (member.ruolo || "cameriere")); setTel(member.tel || ""); setPin(""); setPassword(""); setActive(!!member.attivo); }
    else { setNome(""); setEmail(""); setRuolo("cameriere"); setTel(""); setPin(""); setPassword(""); setActive(true); }
  }, [open, member]);
  const save = async () => {
    if (saving) return;
    if (nome.trim().length < 2) { toast("Inserisci il nome (min 2 caratteri)", { type: "error" }); return; }
    if (!isEdit && !/.+@.+\..+/.test(email.trim())) { toast("Inserisci un'email valida", { type: "error" }); return; }
    if (pin && !/^\d{4}$/.test(pin)) { toast("Il PIN deve avere 4 cifre", { type: "error" }); return; }
    if (!isEdit && password && password.length < 6) { toast("La password deve avere almeno 6 caratteri", { type: "error" }); return; }
    setSaving(true);
    try {
      const roleDb = ROLE_UI2DB[ruolo] || "dipendente";
      if (isEdit) {
        const fields = { name: nome.trim(), active, phone: tel.trim() };
        if (!isOwner) fields.role = roleDb;  // il ruolo owner non è modificabile dal backend
        if (pin) fields.pin = pin;
        await window.TakoActions.staffUpdate(member._id, fields);
        toast("Membro aggiornato", { type: "success" });
      } else {
        const fields = { name: nome.trim(), email: email.trim(), role: roleDb };
        if (tel.trim()) fields.phone = tel.trim();
        if (pin) fields.pin = pin;
        if (password) fields.password = password;
        await window.TakoActions.staffCreate(fields);
        toast("Membro aggiunto", { type: "success" });
      }
      onClose();
      await window.takoReload();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSaving(false); }
  };
  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 400, maxWidth: "calc(100vw - 40px)", background: "var(--surface)", borderRadius: 24, boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", maxHeight: "calc(100% - 48px)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="staff" size={20} /></div>
          <h3 style={{ fontSize: 18, flex: 1 }}>{isEdit ? "Modifica membro" : "Nuovo membro"}</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div className="scroll" style={{ padding: 20, overflowY: "auto" }}>
          <Field label="Nome"><input style={inputStyle} value={nome} autoFocus onChange={e => setNome(e.target.value)} placeholder="Es. Marco Rossi" /></Field>
          <Field label="Email">
            <input style={{ ...inputStyle, opacity: isEdit ? .6 : 1 }} type="email" value={email} disabled={isEdit} onChange={e => setEmail(e.target.value)} placeholder="nome@ristorante.it" />
          </Field>
          {isEdit && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: -8, marginBottom: 12 }}>L'email non è modificabile.</div>}
          <Field label="Ruolo">
            <select style={inputStyle} value={ruolo} disabled={isOwner} onChange={e => setRuolo(e.target.value)}>
              {STAFF_ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          {isOwner && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: -8, marginBottom: 12 }}>Il ruolo del titolare non è modificabile.</div>}
          <Field label="Telefono (opzionale)"><input style={inputStyle} value={tel} onChange={e => setTel(e.target.value)} placeholder="+39…" /></Field>
          <Field label="PIN (opzionale, 4 cifre)"><input style={inputStyle} value={pin} inputMode="numeric" maxLength={4} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Per l'accesso rapido" /></Field>
          {!isEdit && <Field label="Password (opzionale)"><input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Almeno 6 caratteri" /></Field>}
          {isEdit && <Row label="Attivo" sub="Un membro disattivo non può accedere"><Toggle on={active} set={setActive} /></Row>}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvo…" : (isEdit ? "Salva" : "Crea membro")}</Btn>
        </div>
      </div>
    </Overlay>
  );
}
function ScreenStaff({ mobile }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="hello" title="Staff" sub={`${STAFF.length} membri`} actions={<Btn kind="brand" icon="plus" onClick={() => { setEditMember(null); setFormOpen(true); }}>Aggiungi membro</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {STAFF.map(m => {
          const [tone, label] = ROLE_BADGE[m.ruolo];
          const cols = { owner: "var(--brand)", cameriere: "var(--info)", chef: "var(--wait)", cassiere: "var(--ok)" };
          return (
            <Card key={m.email} pad={16} style={{ opacity: m.attivo ? 1 : .55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: "none" }}>
                  <Avatar initials={m.nome.split(" ").map(w => w[0]).join("")} color={cols[m.ruolo]} size={46} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontWeight: 700, fontSize: 15 }}>{m.nome}</span></div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                </div>
                {!m.attivo ? <Badge tone="muted">Disattivo</Badge> : <Badge tone={tone}>{label}</Badge>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)" }} className="mono">{m.tel || "—"}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <IconBtn name="edit" tone="ghost" onClick={() => {
                    if (!m._id) { toast("Membro non modificabile"); return; }
                    setEditMember(m); setFormOpen(true);
                  }} />
                  <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} onClick={async () => {
                    if (!m._id) { toast("Disattiva " + m.nome.split(" ")[0]); return; }
                    try {
                      await window.TakoActions.staffDelete(m._id);
                      toast("Membro rimosso", { type: "success" });
                      await window.takoReload();
                    } catch (e) { toast(e.message, { type: "error" }); }
                  }} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      <StaffFormModal open={formOpen} member={editMember} onClose={() => setFormOpen(false)} />
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
        actions={!mobile && <Btn kind="brand" icon="check" onClick={async () => {
          // setSettings è già collegato al backend a monte: lo richiamo con lo stato corrente per persistere.
          try {
            await setSettings(settings);
            toast("Impostazioni salvate", { type: "success" });
          } catch (e) { toast(e.message, { type: "error" }); }
        }}>Salva</Btn>} />
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
              {/* TODO: riattivare quando esistono le prenotazioni (feature non ancora implementata) */}
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
              <Row label="Stato" sub={settings.printerIp ? `${settings.printerIp} : ${settings.printerPort}` : "Imposta un indirizzo IP per collegarla"}>{settings.printerIp ? <Badge tone="ok" dot>Configurata</Badge> : <Badge tone="muted">Non configurata</Badge>}</Row>
              <div style={{ marginTop: 14 }}><Btn kind="soft" icon="printer" onClick={async () => {
                try {
                  if (window.TakoActions.printTest) {
                    await window.TakoActions.printTest();
                    toast("Stampa di prova inviata", { icon: "printer" });
                  } else {
                    toast("Stampa di prova non disponibile", { type: "error" });
                  }
                } catch (e) {
                  // 404 / endpoint mancante: feedback informativo
                  toast(e.message || "Stampa di prova non disponibile", { type: "error" });
                }
              }}>Stampa di prova</Btn></div>
            </Card>
          )}

          {mobile && (
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn kind="soft" full icon="refresh" onClick={() => { setBrand("arancione"); setSettings(SETTINGS_DEFAULTS); toast("Impostazioni ripristinate"); }}>Ripristina</Btn>
              <Btn kind="brand" full icon="check" onClick={async () => {
                // setSettings è già collegato al backend a monte: lo richiamo con lo stato corrente per persistere.
                try {
                  await setSettings(settings);
                  toast("Impostazioni salvate", { type: "success" });
                } catch (e) { toast(e.message, { type: "error" }); }
              }}>Salva</Btn>
            </div>
          )}
        </div>
      </div>
    </ScreenScroll>
  );
}

/* ═══════════════════ COLLEGA DISPOSITIVI ═══════════════════ */
/* Mostra a quale indirizzo i tablet/telefoni dello staff si collegano (mDNS +
   IP LAN) e un QR pronto. Dati da GET /api/system/info. */
function CopyRow({ label, value }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(value);
      setDone(true);
      toast("Copiato", { type: "ok" });
      setTimeout(() => setDone(false), 1400);
    } catch (_) {}
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--sunken)", border: "1px solid var(--hairline)", borderRadius: 14 }}>
      <Tako pose="logoMark" size={34} float={false} style={{ flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</span>
        <code style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--f-mono, ui-monospace, monospace)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</code>
      </div>
      <IconBtn name={done ? "check" : "copy"} onClick={copy} tone={done ? "brand" : "raised"} size={42} iconSize={19} label="Copia indirizzo" style={{ flex: "none" }} />
    </div>
  );
}
function ScreenCollega({ mobile }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    TakoAPI.get("/system/info").then((d) => { if (alive) setInfo(d); }).catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, []);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="serve" title="Collega dispositivi" sub="Apri Tako sui tablet e telefoni dello staff" />
      <Card pad={mobile ? 18 : 26} style={{ maxWidth: 580 }}>
        {err && <div style={{ color: "var(--danger,#d9533a)", fontSize: 14 }}>Info non disponibili. Server raggiungibile?</div>}
        {!err && !info && <div style={{ color: "var(--ink-2)", fontSize: 14 }}>Carico…</div>}
        {info && (
          <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: 22, alignItems: mobile ? "stretch" : "center" }}>
            {info.qrDataUrl && <img src={info.qrDataUrl} alt="QR collega" width={200} height={200} style={{ alignSelf: "center", borderRadius: 14, border: "1px solid var(--hairline,#eee)" }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14, minWidth: 0 }}>
              <div>Sullo stesso WiFi, apri nel browser del dispositivo:</div>
              {info.urls && info.urls.mdns && <CopyRow label="Indirizzo" value={info.urls.mdns} />}
              {(info.lanIPs || []).map((ip) => <CopyRow key={ip} label="oppure IP" value={`http://${ip}:${info.port}`} />)}
              <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Scansiona il QR per aprire la dashboard. I clienti invece usano il QR del tavolo.</div>
            </div>
          </div>
        )}
      </Card>
    </ScreenScroll>
  );
}

Object.assign(window, { ScreenMenu, ScreenStatistiche, ScreenInsights, ScreenInventario, ScreenStaff, ScreenImpostazioni, ScreenCollega });
