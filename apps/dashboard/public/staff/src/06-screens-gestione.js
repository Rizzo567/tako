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
  const [delSez, setDelSez] = useState(null);   // sezione da eliminare {_id, sezione, piatti}
  const [delDish, setDelDish] = useState(null);  // piatto da eliminare {_id, nome}
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
          <Btn kind="soft" icon="insights" onClick={() => window.takoGo && window.takoGo("insights")}>Analisi menu</Btn>
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
      {menu.length === 0 && (
        <Empty tako="dish" title="Menu vuoto — crea la prima sezione"
          sub="Organizza i piatti in sezioni (Antipasti, Primi…), poi aggiungi i piatti o importa da testo."
          action={<Btn kind="brand" icon="plus" onClick={() => { setSecName(""); setSecOpen(true); }}>Nuova sezione</Btn>} />
      )}
      {menu.map((s, si) => (
        <div key={s._id || si} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Icon name="more" size={16} style={{ color: "var(--ink-3)", transform: "rotate(90deg)" }} />
            <h3 style={{ fontSize: 17 }}>{s.sezione}</h3>
            <Badge tone="muted">{s.piatti.length}</Badge>
            <div style={{ flex: 1 }} />
            <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} title="Elimina sezione"
              onClick={() => setDelSez(s)} />
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
                  <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} title="Elimina piatto" onClick={() => setDelDish(p)} />
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      <Confirm open={!!delSez} onClose={() => setDelSez(null)} danger
        title={delSez ? `Eliminare la sezione "${delSez.sezione}"?` : "Eliminare la sezione?"}
        body={delSez && delSez.piatti.length ? `La sezione e i suoi ${delSez.piatti.length} piatti verranno rimossi dal menu.` : "La sezione verrà rimossa dal menu."}
        confirmLabel="Elimina"
        onConfirm={async () => {
          const sez = delSez;
          if (!sez || !sez._id) { setDelSez(null); return; }
          try {
            await window.TakoActions.menuDeleteSection(sez._id);
            toast("Sezione eliminata", { type: "success" });
            await window.takoReload();
          } catch (e) { toast(e.message, { type: "error" }); }
          finally { setDelSez(null); }
        }} />
      <Confirm open={!!delDish} onClose={() => setDelDish(null)} danger
        title={delDish ? `Eliminare "${delDish.nome}"?` : "Eliminare il piatto?"}
        body="Il piatto verrà rimosso dal menu." confirmLabel="Elimina"
        onConfirm={async () => {
          const p = delDish;
          if (!p || !p._id) { setDelDish(null); return; }
          try {
            await window.TakoActions.menuDeleteItem(p._id);
            toast("Piatto eliminato", { type: "success" });
            await window.takoReload();
          } catch (e) { toast(e.message, { type: "error" }); }
          finally { setDelDish(null); }
        }} />
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
            <img src={imageUrl} alt="Immagine piatto" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
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
        <Kpi label="Incasso" value={loading && !stats ? "…" : kIncasso} icon="coins" accent="var(--brand)" />
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
/* Metadati dei quattro tipi di movimento magazzino (carico/scarico/rettifica/spreco). */
const MOVE_META = {
  load:       { label: "Carico",    tone: "ok",     icon: "download" },
  unload:     { label: "Scarico",   tone: "info",   icon: "arrowR" },
  adjustment: { label: "Rettifica", tone: "muted",  icon: "edit" },
  waste:      { label: "Spreco",    tone: "danger", icon: "trash" },
};
const invFmtDate = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) + " " + d.toTimeString().slice(0, 5); } catch (_) { return ""; } };
function invCopy(text) {
  try { navigator.clipboard.writeText(text); toast("Lista copiata negli appunti", { type: "success", icon: "copy" }); }
  catch (_) { toast("Copia non riuscita", { type: "error" }); }
}

/* piccola tessera metadato (etichetta + valore) usata nel drawer articolo */
function InvMeta({ label, value, tone }) {
  return (
    <div style={{ background: "var(--sunken)", borderRadius: 12, padding: "9px 11px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2, color: tone === "danger" ? "var(--danger)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}

/* stepper numerico +/− per la quantità del movimento rapido */
function NumStepper({ value, set, step = 1, min = 0 }) {
  const n = Number(value) || 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <IconBtn name="minus" tone="soft" size={44} onClick={() => set(Math.max(min, Math.round((n - step) * 100) / 100))} />
      <input type="number" inputMode="decimal" value={value} onChange={e => set(e.target.value === "" ? "" : Number(e.target.value))}
        style={{ ...inputStyle, width: 104, textAlign: "center", fontWeight: 800, fontSize: 19 }} />
      <IconBtn name="plus" tone="brand" size={44} onClick={() => set(Math.round((n + step) * 100) / 100)} />
    </div>
  );
}

/* Modale crea/modifica articolo (name, unit, min, par, costo, fornitore, attivo). */
function InvFormModal({ open, onClose, item }) {
  const isEdit = !!item;
  const [name, setName] = useState(""); const [unit, setUnit] = useState("kg");
  const [qty, setQty] = useState(0); const [min, setMin] = useState(0); const [par, setPar] = useState(0);
  const [cost, setCost] = useState(0); const [supplier, setSupplier] = useState(""); const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (item) { setName(item.name || ""); setUnit(item.unit || "kg"); setQty(Number(item.quantity) || 0); setMin(Number(item.minQuantity) || 0); setPar(item.parLevel != null ? Number(item.parLevel) : 0); setCost(item.costPerUnit != null ? Number(item.costPerUnit) : 0); setSupplier(item.supplier || ""); setActive(item.active !== false); }
    else { setName(""); setUnit("kg"); setQty(0); setMin(0); setPar(0); setCost(0); setSupplier(""); setActive(true); }
  }, [open, item]);
  const save = async () => {
    if (saving) return;
    if (name.trim().length < 1) { toast("Inserisci un nome", { type: "error" }); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await window.TakoActions.inventoryUpdate(item.id, { name: name.trim(), unit: unit.trim() || "pz", minQuantity: Number(min) || 0, parLevel: Number(par) || 0, costPerUnit: Number(cost) || 0, supplier: supplier.trim(), active });
        toast("Articolo aggiornato", { type: "success" });
      } else {
        await window.TakoActions.invCreate({ name: name.trim(), unit: unit.trim() || "pz", quantity: Number(qty) || 0, minQuantity: Number(min) || 0, parLevel: Number(par) || 0, costPerUnit: Number(cost) || 0, supplier: supplier.trim() });
        toast("Articolo aggiunto", { type: "success" });
      }
      onClose(true);
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSaving(false); }
  };
  const half = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
  return (
    <Overlay open={open} onClose={() => onClose(false)} anchor="center">
      <div style={{ width: 420, maxWidth: "calc(100vw - 40px)", background: "var(--surface)", borderRadius: 24, boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", maxHeight: "calc(100% - 48px)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="inventory" size={20} /></div>
          <h3 style={{ fontSize: 18, flex: 1 }}>{isEdit ? "Modifica articolo" : "Nuovo articolo"}</h3>
          <IconBtn name="x" tone="soft" onClick={() => onClose(false)} />
        </div>
        <div className="scroll" style={{ padding: 20, overflowY: "auto" }}>
          <Field label="Nome"><input style={inputStyle} value={name} autoFocus onChange={e => setName(e.target.value)} placeholder="Es. Farina 00" /></Field>
          <div style={half}>
            <Field label="Unità"><input style={inputStyle} value={unit} onChange={e => setUnit(e.target.value)} placeholder="kg, l, pz…" /></Field>
            {!isEdit
              ? <Field label="Giacenza iniziale"><input style={inputStyle} type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} /></Field>
              : <Field label="Fornitore"><input style={inputStyle} value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="—" /></Field>}
          </div>
          <div style={half}>
            <Field label="Soglia minima"><input style={inputStyle} type="number" inputMode="decimal" value={min} onChange={e => setMin(e.target.value)} /></Field>
            <Field label="Par level"><input style={inputStyle} type="number" inputMode="decimal" value={par} onChange={e => setPar(e.target.value)} /></Field>
          </div>
          <Field label="Costo unitario (€)"><input style={inputStyle} type="number" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" /></Field>
          {!isEdit && <Field label="Fornitore (opzionale)"><input style={inputStyle} value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Es. Molino Rossi" /></Field>}
          {isEdit && <Row label="Attivo" sub="Un articolo disattivo esce dal magazzino"><Toggle on={active} set={setActive} /></Row>}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={() => onClose(false)}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvo…" : (isEdit ? "Salva" : "Crea articolo")}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* Drawer articolo: movimento rapido (carico/scarico/rettifica/spreco) + valorizzazione + storico + modifica/elimina. */
function InvItemDrawer({ item, stat, mobile, onClose, onChanged, onEdit, onDelete }) {
  const [mtype, setMtype] = useState("load");
  const [amt, setAmt] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(null);
  const loadMoves = useCallback(async () => { try { const m = await window.TakoActions.inventoryMovements(item.id); setMoves(m || []); } catch (_) { setMoves([]); } }, [item.id]);
  useEffect(() => { loadMoves(); }, [loadMoves]);
  const qty = Number(item.quantity) || 0, min = Number(item.minQuantity) || 0;
  const out = qty <= 0, low = qty < min;
  const apply = async () => {
    const q = Number(amt);
    if (!q || q <= 0) { toast("Inserisci una quantità", { type: "error" }); return; }
    setBusy(true);
    try {
      await window.TakoActions.invMove(item.id, mtype, q, note.trim() || undefined);
      toast(MOVE_META[mtype].label + " registrato", { type: "success" });
      setAmt(1); setNote(""); onChanged(); loadMoves();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ width: mobile ? 354 : 392, maxWidth: "100%", height: "calc(100% - 24px)", maxHeight: "calc(100% - 24px)", margin: 12, borderRadius: 20, background: "var(--surface)", boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 19, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</h3>
          <div style={{ display: "flex", gap: 7, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span className="num" style={{ fontSize: 13.5, color: out || low ? "var(--danger)" : "var(--ink-2)", fontWeight: 800 }}>{qty} {item.unit}</span>
            {out ? <Badge tone="danger" solid dot>Esaurito</Badge> : low ? <Badge tone="danger" dot>Sotto scorta</Badge> : <Badge tone="ok" dot>In stock</Badge>}
          </div>
        </div>
        <IconBtn name="x" tone="soft" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>Movimento rapido</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {Object.entries(MOVE_META).map(([k, m]) => {
            const on = mtype === k; const [bg, fg] = TONE[m.tone] || TONE.muted;
            return <button key={k} className="press" onClick={() => setMtype(k)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                border: `1.5px solid ${on ? fg : "var(--hairline)"}`, background: on ? bg : "var(--raised)", color: on ? fg : "var(--ink-2)" }}>
              <Icon name={m.icon} size={16} />{m.label}</button>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><NumStepper value={amt} set={setAmt} /></div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
          {[1, 5, 10, 25].map(x => <button key={x} className="press num" onClick={() => setAmt(x)} style={{ padding: "6px 13px", borderRadius: 999, border: "1px solid var(--hairline)", background: "var(--sunken)", fontWeight: 700, fontSize: 13, color: "var(--ink-2)", cursor: "pointer" }}>{x}</button>)}
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opzionale)" style={{ ...inputStyle, marginBottom: 10 }} />
        <Btn kind="brand" full icon="check" disabled={busy} onClick={apply}>{busy ? "Registro…" : `Registra ${MOVE_META[mtype].label.toLowerCase()}`}</Btn>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
          <InvMeta label="Soglia minima" value={`${min} ${item.unit}`} />
          <InvMeta label="Par level" value={item.parLevel != null ? `${item.parLevel} ${item.unit}` : "—"} />
          <InvMeta label="Costo unitario" value={item.costPerUnit != null ? `${euro(item.costPerUnit)}/${item.unit}` : "—"} />
          <InvMeta label="Valore giacenza" value={stat ? euro(stat.value || 0) : euro((Number(item.costPerUnit) || 0) * qty)} />
          <InvMeta label="Consumo 30gg" value={stat ? `${stat.used30 || 0} ${item.unit}` : "—"} />
          <InvMeta label="Giorni residui" value={stat && stat.daysLeft != null ? `~${stat.daysLeft}g` : "—"} tone={stat && stat.daysLeft != null && stat.daysLeft <= 7 ? "danger" : null} />
        </div>
        {item.supplier && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14 }}>Fornitore · <b style={{ color: "var(--ink-2)" }}>{item.supplier}</b></div>}

        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>Storico movimenti</div>
        {moves === null ? <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "8px 0" }}>Carico…</div>
          : moves.length === 0 ? <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "8px 0" }}>Nessun movimento registrato.</div>
          : <Card pad={0} style={{ overflow: "hidden" }}>
              {moves.map((mv, i) => { const m = MOVE_META[mv.type] || MOVE_META.adjustment; const [bg, fg] = TONE[m.tone] || TONE.muted;
                return <div key={mv.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < moves.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: bg, color: fg, flex: "none" }}><Icon name={m.icon} size={15} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{m.label} · <span className="num">{mv.quantity} {item.unit}</span></div>{mv.note && <div style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mv.note}</div>}</div>
                  <span className="num" style={{ fontSize: 11.5, color: "var(--ink-3)", flex: "none" }}>{invFmtDate(mv.createdAt)}</span>
                </div>;
              })}
            </Card>}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--hairline)", display: "flex", gap: 9 }}>
        <Btn kind="soft" full icon="edit" onClick={() => onEdit(item)}>Modifica</Btn>
        <Btn kind="danger" full icon="trash" onClick={() => onDelete(item)}>Elimina</Btn>
      </div>
    </div>
  );
}

/* Vista "Da riordinare": articoli sotto soglia raggruppati per fornitore + copia lista ordinabile. */
function ReorderView({ reorder, mobile }) {
  if (!reorder) return <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>Carico lista riordino…</div>;
  const groups = reorder.suppliers || [];
  if (!groups.length) return <Empty tako="dishAlt" title="Niente da riordinare" sub="Nessun articolo è sotto la soglia minima. Magazzino in ordine." />;
  const supText = (g) => g.items.map(it => `${it.name}: ${it.suggested} ${it.unit}`).join("\n");
  const allText = groups.map(g => `— ${g.supplier || "Senza fornitore"} —\n${supText(g)}`).join("\n\n");
  return (
    <>
      <Card pad={16} style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>Costo stimato riordino</div>
          <div className="num" style={{ fontSize: 28, fontWeight: 900, color: "var(--brand)" }}>{euro(reorder.estTotalCost || 0)}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{reorder.itemCount || 0} articoli · {groups.length} {groups.length === 1 ? "fornitore" : "fornitori"}</div>
        </div>
        <Btn kind="soft" icon="copy" onClick={() => invCopy(allText)}>Copia tutto</Btn>
      </Card>
      <div style={{ display: "grid", gap: 14 }}>
        {groups.map((g, gi) => (
          <Card key={gi} pad={0} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--hairline)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)", flex: "none" }}><Icon name="orders" size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.supplier || "Senza fornitore"}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{g.items.length} articoli · {euro(g.items.reduce((a, it) => a + (Number(it.estCost) || 0), 0))}</div>
              </div>
              <Btn kind="soft" size="sm" icon="copy" onClick={() => invCopy(supText(g))}>Copia</Btn>
            </div>
            {g.items.map((it, ii) => (
              <div key={it.id || ii} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: ii < g.items.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>giacenza {it.quantity} · min {it.minQuantity} {it.unit}</div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div className="num" style={{ fontSize: 15, fontWeight: 800, color: "var(--brand)" }}>+{it.suggested} {it.unit}</div>
                  {it.estCost != null && <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{euro(it.estCost)}</div>}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}

function ScreenInventario({ mobile }) {
  const [items, setItems] = useState(null);   // lista grezza /inventory (null = in caricamento)
  const [stats, setStats] = useState(null);   // /inventory/stats
  const [reorder, setReorder] = useState(null); // /inventory/reorder
  const [tab, setTab] = useState("magazzino"); // magazzino | riordino
  const [q, setQ] = useState("");
  const [sortLow, setSortLow] = useState(true);
  const [openId, setOpenId] = useState(null);  // articolo aperto nel drawer
  const [formItem, setFormItem] = useState(undefined); // undefined=chiuso, null=nuovo, obj=modifica
  const [delItem, setDelItem] = useState(null);
  // Nasconde il valore economico del magazzino (discrezione davanti allo staff/clienti). Persistito.
  const [hideValue, setHideValue] = useState(() => { try { return localStorage.getItem("tako_inv_hide_value") === "1"; } catch (_) { return false; } });
  const toggleHideValue = () => setHideValue(v => { const nv = !v; try { localStorage.setItem("tako_inv_hide_value", nv ? "1" : "0"); } catch (_) {} return nv; });
  // import AI (invariato)
  const [impOpen, setImpOpen] = useState(false);
  const [impText, setImpText] = useState("");
  const [impPreview, setImpPreview] = useState(null);
  const [impLoading, setImpLoading] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [it, st, ro] = await Promise.all([
        window.TakoActions.inventoryList(),
        window.TakoActions.inventoryStats().catch(() => null),
        window.TakoActions.inventoryReorder().catch(() => null),
      ]);
      setItems(it || []); setStats(st); setReorder(ro);
    } catch (e) { toast(e.message, { type: "error" }); setItems([]); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const statMap = useMemo(() => { const m = {}; ((stats && stats.perItem) || []).forEach(p => { m[p.id] = p; }); return m; }, [stats]);

  // +/− rapido: update ottimistico locale poi carico/scarico reale e refetch.
  const quick = async (x, d) => {
    setItems(v => (v || []).map(i => i.id === x.id ? { ...i, quantity: Math.max(0, Math.round(((Number(i.quantity) || 0) + d) * 100) / 100) } : i));
    try { await window.TakoActions.invMove(x.id, d > 0 ? "load" : "unload", Math.abs(d)); reload(); }
    catch (e) { toast(e.message, { type: "error" }); reload(); }
  };

  const sorted = useMemo(() => {
    let arr = (items || []).filter(x => x.active !== false);
    const s = q.trim().toLowerCase();
    if (s) arr = arr.filter(x => (x.name || "").toLowerCase().includes(s) || (x.supplier || "").toLowerCase().includes(s));
    const rank = (x) => { const qv = Number(x.quantity) || 0, mn = Number(x.minQuantity) || 0; return qv <= 0 ? 0 : (qv < mn ? 1 : 2); };
    if (sortLow) arr = arr.slice().sort((a, b) => {
      const r = rank(a) - rank(b); if (r) return r;
      const da = statMap[a.id] && statMap[a.id].daysLeft, db = statMap[b.id] && statMap[b.id].daysLeft;
      const na = da == null ? 9e9 : da, nb = db == null ? 9e9 : db; if (na !== nb) return na - nb;
      return (a.name || "").localeCompare(b.name || "");
    });
    else arr = arr.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return arr;
  }, [items, q, sortLow, statMap]);

  const openItem = openId != null ? (items || []).find(i => i.id === openId) : null;
  const lowList = (items || []).filter(x => x.active !== false && (Number(x.quantity) || 0) < (Number(x.minQuantity) || 0));
  const count = (items || []).filter(x => x.active !== false).length;
  const reorderCount = (reorder && reorder.itemCount) || 0;

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="dishAlt" title="Inventario" sub={`${count} articoli in magazzino`} actions={<div style={{ display: "flex", gap: 8 }}>
        <Btn kind="soft" icon="sparkles" onClick={() => setImpOpen(true)}>Importa da testo</Btn>
        <Btn kind="brand" icon="plus" onClick={() => setFormItem(null)}>Aggiungi</Btn>
      </div>} />

      {/* tab magazzino / riordino */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["magazzino", "Magazzino"], ["riordino", "Da riordinare"]].map(([id, label]) => (
          <button key={id} className="press" onClick={() => setTab(id)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 999, border: "1px solid var(--hairline)", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
              background: tab === id ? "var(--brand)" : "transparent", color: tab === id ? "var(--on-brand)" : "var(--ink-2)" }}>
            {label}
            {id === "riordino" && reorderCount > 0 && <span className="num" style={{ padding: "1px 7px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: tab === id ? "rgba(255,255,255,.25)" : "var(--danger)", color: "#fff" }}>{reorderCount}</span>}
          </button>
        ))}
      </div>

      {tab === "magazzino" ? (
        <>
          {/* cruscotto */}
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <div onClick={toggleHideValue} style={{ cursor: "pointer" }} title={hideValue ? "Mostra valore magazzino" : "Nascondi valore magazzino"}>
              <Kpi label="Valore magazzino" value={stats ? (hideValue ? "€ •••••" : euro(stats.totalValue || 0)) : "—"} icon={hideValue ? "lock" : "coins"} accent="var(--brand)" sub={hideValue ? "tocca per mostrare" : "tocca per nascondere"} />
            </div>
            <Kpi label="Articoli" value={stats ? stats.itemCount : count} icon="inventory" accent="var(--info)" />
            <Kpi label="Sotto scorta" value={stats ? stats.lowCount : lowList.length} icon="alert" accent="var(--wait)" sub={stats ? (stats.lowCount > 0 ? "da riordinare" : "tutto ok") : null} trend={stats && stats.lowCount > 0 ? "down" : "up"} />
            <Kpi label="Esauriti" value={stats ? stats.outCount : "—"} icon="alert" accent="var(--danger)" sub={stats ? (stats.outCount > 0 ? "scorta zero" : "nessuno") : null} trend={stats && stats.outCount > 0 ? "down" : "up"} />
          </div>

          {lowList.length > 0 && (
            <Card pad={13} style={{ marginBottom: 14, border: "1.5px solid var(--danger)", background: "var(--danger-bg)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setTab("riordino")}>
              <Icon name="alert" size={18} style={{ color: "var(--danger)", flex: "none" }} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--danger)", flex: 1 }}>{lowList.length} sotto scorta: {lowList.slice(0, 4).map(x => x.name).join(", ")}{lowList.length > 4 ? "…" : ""}</span>
              <Icon name="chevR" size={16} style={{ color: "var(--danger)", flex: "none" }} />
            </Card>
          )}

          {/* ricerca + ordinamento */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <Search value={q} onChange={setQ} placeholder="Cerca articolo o fornitore…" style={{ flex: 1, minWidth: 180 }} />
            <Btn kind={sortLow ? "brand" : "ghost"} icon="filter" onClick={() => setSortLow(v => !v)}>{sortLow ? "Scorte basse" : "A–Z"}</Btn>
          </div>

          {items === null ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>Carico magazzino…</div>
          ) : sorted.length === 0 ? (
            <Empty tako="dishAlt" title={q ? "Nessun risultato" : "Magazzino vuoto"} sub={q ? "Nessun articolo corrisponde alla ricerca." : "Aggiungi il primo articolo o importa la lista da un testo."} action={!q && <Btn kind="brand" icon="plus" onClick={() => setFormItem(null)}>Aggiungi articolo</Btn>} />
          ) : (
            <Card pad={0} style={{ overflow: "hidden" }}>
              {sorted.map((x, i) => {
                const qv = Number(x.quantity) || 0, mn = Number(x.minQuantity) || 0;
                const out = qv <= 0, low = qv < mn, st = statMap[x.id];
                const sub = [x.supplier, `min ${mn} ${x.unit}`, x.costPerUnit != null ? `${euro(x.costPerUnit)}/${x.unit}` : null, st ? `val ${euro(st.value || 0)}` : null].filter(Boolean).join(" · ");
                return (
                  <div key={x.id} style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 12, padding: mobile ? "11px 12px" : "12px 16px", borderBottom: i < sorted.length - 1 ? "1px solid var(--hairline)" : "none", background: out ? "var(--danger-bg)" : "transparent" }}>
                    <button className="press" onClick={() => setOpenId(x.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{x.name}</span>
                        {out ? <Badge tone="danger" solid dot>Esaurito</Badge> : low ? <Badge tone="danger" dot>Scorta bassa</Badge> : null}
                        {!out && st && st.daysLeft != null && st.daysLeft <= 7 && <Badge tone="wait" dot>~{st.daysLeft}g</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{sub}</div>
                    </button>
                    <div style={{ textAlign: "right", marginRight: 2, flex: "none" }}>
                      <div className="num" style={{ fontSize: 18, color: out || low ? "var(--danger)" : "var(--ink)" }}>{qv}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{x.unit}</div>
                    </div>
                    <IconBtn name="minus" tone="soft" size={36} onClick={() => quick(x, -1)} />
                    <IconBtn name="plus" tone="brand" size={36} onClick={() => quick(x, +1)} />
                    {!mobile && <IconBtn name="chevR" tone="ghost" size={36} onClick={() => setOpenId(x.id)} label="Dettagli" />}
                  </div>
                );
              })}
            </Card>
          )}
        </>
      ) : (
        <ReorderView reorder={reorder} mobile={mobile} />
      )}

      {/* drawer articolo */}
      <Overlay open={openId != null && !!openItem} onClose={() => setOpenId(null)} anchor="right">
        {openItem && <InvItemDrawer item={openItem} stat={statMap[openItem.id]} mobile={mobile}
          onClose={() => setOpenId(null)} onChanged={reload}
          onEdit={(it) => setFormItem(it)} onDelete={(it) => setDelItem(it)} />}
      </Overlay>

      {/* crea / modifica */}
      <InvFormModal open={formItem !== undefined} item={formItem || null} onClose={(changed) => { setFormItem(undefined); if (changed) reload(); }} />

      {/* elimina (archivia soft) */}
      <Confirm open={!!delItem} onClose={() => setDelItem(null)} danger title="Elimina articolo"
        body={delItem ? `Vuoi archiviare "${delItem.name}"? Uscirà dal magazzino ma lo storico resta.` : ""}
        confirmLabel="Elimina" onConfirm={async () => { const it = delItem; if (!it) return; try { await window.TakoActions.inventoryDelete(it.id); toast("Articolo archiviato", { type: "success" }); if (openId === it.id) setOpenId(null); reload(); } catch (e) { toast(e.message, { type: "error" }); } }} />

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
                  reload();
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
  ["funzionalita", "Funzionalità", "sparkles", true],
  ["rete", "Rete / Connessione", "smartphone"],
  // 4° elemento = owner-only: il canale WhatsApp ha privilegi pieni, lo gestisce solo il titolare.
  ["whatsapp", "WhatsApp", "phone", true],
  ["stampante", "Stampante", "printer"],
];
const numStyle = { ...inputStyle, width: 92, textAlign: "right" };

/* ═══════════════════ WHATSAPP (owner) ═══════════════════ */
/* Collega il numero WhatsApp del ristorante al copilot owner: attiva/disattiva,
   mostra QR di collegamento e stato. Polling status ogni 3s finché non connesso.
   Dati da /api/whatsapp/{status,enable,disable,numbers}. */
function WhatsAppPanel({ mobile }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [numInput, setNumInput] = useState("");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try { const s = await TakoAPI.get("/whatsapp/status"); if (alive) setStatus(s); } catch (_) {}
    };
    tick();
    // Poll finché NON connesso (QR che ruota) O finché nessun numero è collegato (per
    // catturare quando il codice viene usato → la card codice sparisce da sola).
    const t = setInterval(() => { setStatus((cur) => { if (!cur || !cur.connected || ((cur.allowedNumbers || []).length === 0)) tick(); return cur; }); }, 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const toggle = async (on) => {
    setBusy(true);
    try {
      const s = await TakoAPI.post(on ? "/whatsapp/enable" : "/whatsapp/disable", {});
      setStatus(s);
      toast(on ? "WhatsApp attivato" : "WhatsApp disattivato", { type: "success" });
    } catch (e) {
      toast(e.message || "Operazione non riuscita", { type: "error" });
    } finally { setBusy(false); }
  };

  const saveNumbers = async (numbers) => {
    try {
      const r = await TakoAPI.post("/whatsapp/numbers", { numbers });
      setStatus((s) => ({ ...(s || {}), allowedNumbers: r.allowedNumbers }));
    } catch (e) { toast(e.message || "Salvataggio numeri non riuscito", { type: "error" }); }
  };
  const addNumber = () => {
    const n = numInput.replace(/\D/g, "");
    if (!n) return;
    const next = Array.from(new Set([...((status && status.allowedNumbers) || []), n]));
    saveNumbers(next); setNumInput("");
  };
  const removeNumber = (n) => saveNumbers(((status && status.allowedNumbers) || []).filter((x) => x !== n));
  const regenCode = async () => {
    try {
      const r = await TakoAPI.post("/whatsapp/bootstrap-code", {});
      setStatus((s) => ({ ...(s || {}), bootstrapCode: r.bootstrapCode }));
      toast("Nuovo codice generato", { type: "success" });
    } catch (e) { toast(e.message || "Impossibile generare il codice", { type: "error" }); }
  };

  const enabled = status && status.enabled;
  const connected = status && status.connected;
  const allowed = (status && status.allowedNumbers) || [];
  const bootstrapCode = status && status.bootstrapCode;

  return (
    <>
      <Card pad={20}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>WhatsApp copilot</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 8 }}>
          Comanda la dashboard scrivendo su WhatsApp al numero collegato. Stesso motore AI del copilot: leggi incassi, segna esaurito, crea tavoli e prenotazioni. Le modifiche richiedono un "SÌ" di conferma via chat.
        </p>
        <Row label="Attiva canale WhatsApp" sub={enabled ? "Il canale è attivo" : "Spento — nessun messaggio viene letto"}>
          <Toggle on={!!enabled} set={(v) => { if (!busy) toggle(v); }} />
        </Row>
        <Row label="Stato">
          {connected
            ? <Badge tone="ok" dot>Connesso{status.me ? ` · +${status.me}` : ""}</Badge>
            : enabled
              ? <Badge tone="wait" dot>In attesa di scansione</Badge>
              : <Badge tone="muted">Spento</Badge>}
        </Row>
      </Card>

      {enabled && !connected && (
        <Card pad={20}>
          <h3 style={{ fontSize: 16, marginBottom: 6 }}>Collega il telefono</h3>
          {status && status.qrDataUrl ? (
            <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: 20, alignItems: mobile ? "stretch" : "center" }}>
              <img src={status.qrDataUrl} alt="QR WhatsApp" width={210} height={210} style={{ alignSelf: "center", borderRadius: 14, border: "1px solid var(--hairline)", background: "#fff", padding: 8 }} />
              <ol style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                <li>Apri <b>WhatsApp</b> sul telefono del ristorante</li>
                <li>Vai su <b>Impostazioni → Dispositivi collegati</b></li>
                <li>Tocca <b>Collega un dispositivo</b></li>
                <li>Inquadra questo codice QR</li>
              </ol>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--ink-2)" }}>Genero il codice QR… attendi qualche secondo.</div>
          )}
        </Card>
      )}

      {enabled && connected && allowed.length === 0 && bootstrapCode && (
        <Card pad={20}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Collega il tuo numero</h3>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
            Dal <b>tuo</b> telefono, scrivi su WhatsApp al numero del ristorante:
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "var(--sunken)", border: "1px solid var(--hairline)", fontFamily: "var(--f-ui)", fontSize: 15 }}>
              collega tako <b style={{ fontFamily: "var(--f-display)", fontSize: 20, letterSpacing: 2, color: "var(--brand)" }}>{bootstrapCode}</b>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
            Solo chi vede questo codice (tu, dalla dashboard) può collegarsi. Usa-e-getta: si consuma al primo collegamento.
          </p>
          <Btn kind="soft" icon="refresh" onClick={regenCode}>Rigenera codice</Btn>
        </Card>
      )}

      {enabled && (
        <Card pad={20}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Numeri autorizzati</h3>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>
            Solo questi numeri possono comandare. {allowed.length === 0 && "Nessun numero collegato: usa il codice qui sopra per collegare il tuo."}
          </p>
          {allowed.map((n) => (
            <Row key={n} label={`+${n}`}>
              <IconBtn name="trash" onClick={() => removeNumber(n)} tone="raised" size={38} iconSize={17} label="Rimuovi numero" />
            </Row>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Es. 393401234567 (con prefisso)" value={numInput} onChange={(e) => setNumInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNumber(); }} />
            <Btn kind="soft" icon="plus" onClick={addNumber}>Aggiungi</Btn>
          </div>
        </Card>
      )}
    </>
  );
}
/* ═══════════════════ RETE LOCALE (net-health) ═══════════════════ */
/* Mostra la qualità della rete LAN/WiFi del Mac: stato + messaggio + metriche.
   Dati da GET /api/system/net-health. Refresh manuale. */
const NET_TONE = { ok: "ok", debole: "wait", instabile: "danger", sconosciuto: "muted" };
function NetHealthCard() {
  const [net, setNet] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setNet(await window.TakoActions.netHealth()); }
    catch (_) { setNet(null); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);
  const status = (net && net.status) || "sconosciuto";
  return (
    <Card pad={20}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ fontSize: 16 }}>Rete locale</h3>
        <Btn kind="soft" icon="refresh" onClick={load} disabled={busy}>{busy ? "Controllo…" : "Ricontrolla"}</Btn>
      </div>
      <Row label="Stato" sub={net ? net.message : "Rilevamento in corso…"}>
        <Badge tone={NET_TONE[status] || "muted"} dot>{status}</Badge>
      </Row>
      {net && (net.ssid || net.iface) && (
        <Row label="Connessione" sub="Rete a cui è agganciato il Mac">
          <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>{net.ssid || net.iface}</span>
        </Row>
      )}
      {net && net.avgMs != null && (
        <Row label="Latenza / perdita" sub="Media, jitter e pacchetti persi">
          <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            {Math.round(net.avgMs)}ms{net.jitterMs != null ? ` · ±${Math.round(net.jitterMs)}ms` : ""}{net.lossPct != null ? ` · ${net.lossPct}%` : ""}
          </span>
        </Row>
      )}
    </Card>
  );
}
function ScreenImpostazioni({ mobile, brand, setBrand, settings = SETTINGS_DEFAULTS, setSettings = () => {} }) {
  const [sec, setSec] = useState("aspetto");
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const setKpi = (k, v) => setSettings(s => ({ ...s, kpi: { ...s.kpi, [k]: v } }));
  // Logo del ristorante: caricato come le foto piatto (TakoActions.uploadImage) e
  // persistito con PATCH /restaurants/me { logoUrl }. NB: uploadImage torna un URL
  // RELATIVO (/uploads/…), ma lo schema server valida logoUrl come URL assoluto →
  // lo assolutizziamo sull'origine corrente prima di salvarlo.
  const [logoUrl, setLogoUrl] = useState(() => (window.__settings_raw && window.__settings_raw.logoUrl) || "");
  const [logoUploading, setLogoUploading] = useState(false);
  const onPickLogo = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setLogoUploading(true);
    try {
      const res = await window.TakoActions.uploadImage(file);
      const abs = new URL(res.url, window.location.origin).href;
      await window.TakoAPI.patch("/restaurants/me", { logoUrl: abs });
      setLogoUrl(abs);
      if (window.__settings_raw) window.__settings_raw.logoUrl = abs;
      toast("Logo aggiornato", { type: "success" });
    } catch (err) {
      toast(err.message || "Caricamento logo fallito", { type: "error" });
    } finally {
      setLogoUploading(false);
    }
  };
  // Sezioni visibili: quelle owner-only (4° elemento truthy) solo per il titolare.
  const visibleSections = SET_SECTIONS.filter(([, , , ownerOnly]) => !ownerOnly || window.__takoRole === "owner");
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
            {visibleSections.map(([k, l]) => <button key={k} className="press" onClick={() => setSec(k)} style={{ flex: "none", padding: "9px 15px", borderRadius: 99, fontSize: 13.5, fontWeight: 700, background: sec === k ? "var(--brand)" : "var(--sunken)", color: sec === k ? "var(--on-brand)" : "var(--ink-2)" }}>{l}</button>)}
          </div>
        ) : (
          <div style={{ flex: "none", width: 224, display: "flex", flexDirection: "column", gap: 4 }}>
            {visibleSections.map(([k, l, ic]) => { const on = sec === k; return (
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
                <span style={{ width: 64, height: 64, borderRadius: 16, background: "var(--brand-tint)", display: "grid", placeItems: "center", flex: "none", overflow: "hidden" }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo ristorante" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <img src="assets/tako-chef.png" alt="" style={{ height: 48 }} />}
                </span>
                <label style={{ flex: 1, height: 64, borderRadius: 14, border: "1.5px dashed var(--hairline)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13, fontWeight: 600, cursor: logoUploading ? "wait" : "pointer", textAlign: "center", padding: "0 12px" }}>
                  <input type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" onChange={onPickLogo} disabled={logoUploading} style={{ display: "none" }} />
                  {logoUploading ? "Carico…" : (logoUrl ? "Cambia logo (PNG trasparente)" : "Carica un PNG trasparente")}
                </label>
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
              <Row label="Assistente AI" sub="Suggerimenti e risposte ai clienti"><Toggle on={settings.ai} set={v => set("ai", v)} /></Row>
              <Row label="Coperto" sub="Aggiunto automaticamente al conto"><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{settings.copertoOn && <input type="number" step="0.5" style={numStyle} value={settings.coperto} onChange={e => set("coperto", parseFloat(e.target.value) || 0)} />}<Toggle on={settings.copertoOn} set={v => set("copertoOn", v)} /></div></Row>
              <Row label="Mance suggerite" sub="Mostra 5/10/15% in cassa"><Toggle on={settings.manceSuggerite} set={v => set("manceSuggerite", v)} /></Row>
            </Card>
          )}

          {sec === "funzionalita" && (<>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>Funzionalità extra</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>Attiva solo ciò che serve al tuo ristorante. Disattivate di default.</p>
              <Row label="Prenotazioni self-service" sub="I clienti prenotano da soli dal menu online"><Toggle on={settings.prenotazioni} set={v => set("prenotazioni", v)} /></Row>
              <Row label="Fedeltà / punti" sub="Accumulo punti sui pagamenti"><Toggle on={settings.fedelta} set={v => set("fedelta", v)} /></Row>
              <Row label="Richiesta recensione" sub="Dopo il pagamento invita a lasciare una recensione"><Toggle on={settings.recensioni} set={v => set("recensioni", v)} /></Row>
              {settings.recensioni && (
                <Field label="Link recensione (es. Google)"><input style={inputStyle} value={settings.recensioniUrl} placeholder="https://g.page/r/..." onChange={e => set("recensioniUrl", e.target.value)} /></Field>
              )}
              <Row label="Scarico automatico magazzino" sub="Cala lo stock in base alla ricetta quando vendi"><Toggle on={settings.scaricoAuto} set={v => set("scaricoAuto", v)} /></Row>
            </Card>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Assistente & AI</h3>
              <Row label="Briefing WhatsApp mattutino" sub="Riepilogo automatico ogni giorno sul canale WhatsApp"><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{settings.briefingWa && <><input type="number" min="0" max="23" style={numStyle} value={settings.briefingOra} onChange={e => set("briefingOra", parseInt(e.target.value) || 0)} /><span style={{ fontSize: 13, color: "var(--ink-3)" }}>h</span></>}<Toggle on={settings.briefingWa} set={v => set("briefingWa", v)} /></div></Row>
              <Row label="Contenuti AI (descrizioni/traduzioni)" sub="Genera descrizioni e traduzioni piatti — consigliata attiva"><Toggle on={settings.aiContenuti} set={v => set("aiContenuti", v)} /></Row>
              <Row label="Foto AI piatti" sub="Carichi una foto → stile da menù professionale coerente (richiede chiave Gemini configurata)"><Toggle on={settings.fotoAi} set={v => set("fotoAi", v)} /></Row>
              {settings.fotoAi && (
                <Field label="Codice Pro (opzionale)"><input style={inputStyle} value={settings.fotoAiCodice} placeholder="Sblocca la qualità Pro — richiedilo al fornitore" onChange={e => set("fotoAiCodice", e.target.value)} /></Field>
              )}
              <Row label="Menu engineering" sub="Analisi profitto/popolarità dei piatti — consigliata attiva"><Toggle on={settings.menuEngineering} set={v => set("menuEngineering", v)} /></Row>
            </Card>
          </>)}

          {sec === "rete" && (<>
            <Card pad={20}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>Rete & Connessione</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>Come i clienti raggiungono il menu dai QR e cosa fare se la rete è debole.</p>
              <Row label="Ordini dal telefono dei clienti" sub="Disattiva se la rete non regge: il menu resta visibile ma i clienti ordinano dal cameriere."><Toggle on={settings.ordiniClienti !== false} set={v => set("ordiniClienti", v)} /></Row>
              <Field label="Modalità QR tavoli">
                <select style={inputStyle} value={settings.qrMode || "lan"} onChange={e => set("qrMode", e.target.value)}>
                  <option value="lan">LAN (consigliato, funziona senza internet)</option>
                  <option value="cloud">Cloud (accesso anche da fuori, richiede internet)</option>
                </select>
              </Field>
              <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                {settings.qrMode === "cloud"
                  ? "I QR puntano al resolver pubblico: i clienti accedono anche da rete dati, ma serve internet attivo sul Mac."
                  : "I QR puntano a tako.local sulla rete del locale: funziona anche se internet è giù. Consigliato per la maggior parte dei ristoranti."}
              </p>
            </Card>
            <NetHealthCard />
          </>)}

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

          {sec === "whatsapp" && window.__takoRole === "owner" && <WhatsAppPanel mobile={mobile} />}

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
/* ── Pairing dell'appliance col control-plane cloud (account owner del sito) ──
   Mostra lo stato; se non accoppiata e il cloud è configurato, permette di inserire
   il device code (mostrato sul sito) + impostare la password owner LOCALE per
   l'accesso offline. SEC-001: la password cloud non transita mai qui. */
function CloudPairing({ mobile }) {
  const [st, setSt] = useState(null);      // stato pairing dal backend
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  const refresh = async () => { try { setSt(await TakoAPI.get("/setup/status")); } catch (_) { setSt({ configured: false }); } };
  useEffect(() => { refresh(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk("");
    if (pw.length < 8) { setErr("La password locale deve avere almeno 8 caratteri."); return; }
    setBusy(true);
    try {
      const d = await TakoAPI.post("/setup/pair", { code: code.trim(), localPassword: pw });
      setOk(`Account ${d.owner?.email || ""} collegato. Ora puoi accedere offline con la password impostata.`);
      setCode(""); setPw(""); await refresh();
    } catch (ex) {
      setErr(ex.message || "Pairing non riuscito. Controlla il codice e riprova.");
    } finally { setBusy(false); }
  };

  // confirm() nativo non è affidabile in WKWebView (Tauri): usiamo il componente <Confirm>.
  const unpair = async () => {
    setBusy(true);
    try { await TakoAPI.post("/setup/unpair"); await refresh(); toast("Locale scollegato", { type: "success" }); }
    catch (_) { toast("Errore nello scollegamento", { type: "error" }); }
    finally { setBusy(false); }
  };

  if (!st) return null;
  // Cloud non configurato su questa appliance: niente sezione (modo local puro).
  if (!st.configured) return null;

  const inp = { width: "100%", margin: "6px 0 12px", padding: "10px 12px", borderRadius: 11, border: "1px solid var(--hairline,#ddd)", fontSize: 14.5, background: "var(--sunken,#fafafa)" };
  const lab = { fontSize: 12.5, fontWeight: 700, color: "var(--ink-2,#555)" };

  return (
    <Card pad={mobile ? 18 : 26} style={{ maxWidth: 580, marginBottom: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Account proprietario (cloud)</div>
      <div style={{ fontSize: 13, color: "var(--ink-2,#888)", marginBottom: 16 }}>
        Collega questo locale al tuo account Tako del sito per accedere come titolare, anche offline.
      </div>
      {st.paired ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14 }}>Collegato a <b>{st.ownerEmail || "—"}</b>{st.ownerName ? ` (${st.ownerName})` : ""}.</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2,#888)" }}>Puoi accedere offline con la password owner locale impostata al pairing.</div>
          <div><Btn kind="soft" size="sm" disabled={busy} onClick={() => setConfirmUnpair(true)}>Scollega questo locale</Btn></div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label style={lab}>Codice di collegamento (dal sito Tako)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} type="text" required minLength={8} placeholder="incolla qui il codice" style={inp} />
          <label style={lab}>Password owner per l'accesso offline</label>
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" required minLength={8} placeholder="almeno 8 caratteri" style={inp} />
          {err && <div style={{ color: "var(--danger,#d9533a)", fontSize: 13, margin: "4px 0 8px" }}>{err}</div>}
          <Btn kind="brand" disabled={busy} onClick={submit}>{busy ? "Collego…" : "Collega account"}</Btn>
        </form>
      )}
      {ok && <div style={{ color: "var(--ok,#2F7D58)", fontSize: 13, marginTop: 10 }}>{ok}</div>}
      <Confirm open={confirmUnpair} onClose={() => setConfirmUnpair(false)} onConfirm={unpair} danger
        title="Scollegare questo locale?"
        body="Il locale verrà scollegato dall'account cloud. Dovrai ri-accoppiarlo per riavere l'accesso da titolare."
        confirmLabel="Scollega" />
    </Card>
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
      <CloudPairing mobile={mobile} />
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

/* ═══════════════════ DISPOSITIVI (QR + Collega, unificate) ═══════════════════ */
/* Raccoglie in un'unica voce di sidebar due schermate affini (owner-only). */
function ScreenDispositivi({ mobile }) {
  const [tab, setTab] = React.useState("qr");
  const QR = window.ScreenQR, Collega = window.ScreenCollega;
  const tabs = [["qr", "QR Codes"], ["collega", "Collega dispositivi"]];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 8, padding: mobile ? "12px 16px 4px" : "16px 24px 4px", flex: "none" }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 15px", borderRadius: 999, border: "1px solid var(--hairline)", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
              background: tab === id ? "var(--brand)" : "transparent", color: tab === id ? "var(--on-brand)" : "var(--ink-2)" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "qr" ? (QR ? <QR mobile={mobile} /> : null) : (Collega ? <Collega mobile={mobile} /> : null)}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenMenu, ScreenStatistiche, ScreenInsights, ScreenInventario, ScreenStaff, ScreenImpostazioni, ScreenCollega, ScreenDispositivi });
