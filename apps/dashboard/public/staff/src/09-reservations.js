/* ───────────────── Tako Dashboard — Prenotazioni ─────────────────
   Schermata gestione prenotazioni (vista giorno navigabile, CRUD, azioni
   rapide di stato, assegnazione tavolo). Stile coerente con le altre schermate.
   Legge/scrive dal backend via window.TakoAPI (route /api/reservations).
   NB: nessuna dichiarazione top-level duplicata rispetto agli altri file
   (React hooks, Btn, Card, Overlay, ScreenScroll, PageHead… sono già in scope). */

/* ═══════════ stati prenotazione (DB enum → label + tono badge) ═══════════ */
const RES_STATUS = {
  requested: { label: "Richiesta",  tone: "wait" },
  confirmed: { label: "Confermata", tone: "info" },
  seated:    { label: "Seduti",     tone: "ok" },
  no_show:   { label: "No show",    tone: "danger" },
  cancelled: { label: "Annullata",  tone: "muted" },
};

/* ═══════════ helper API prenotazioni (usa il client globale TakoAPI) ═══════════ */
const resApi = {
  list: (date) => window.TakoAPI.get(`/reservations?date=${date}`),
  create: (body) => window.TakoAPI.post(`/reservations`, body),
  update: (id, fields) => window.TakoAPI.patch(`/reservations/${id}`, fields),
  setStatus: (id, status) => window.TakoAPI.patch(`/reservations/${id}/status`, { status }),
  assignTable: (id, tableId) => window.TakoAPI.patch(`/reservations/${id}/table`, { tableId }),
  remove: (id) => window.TakoAPI.del(`/reservations/${id}`),
};

/* ═══════════ helper date locali ═══════════ */
const resToday = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (ora locale)
function resAddDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}
function resPrettyDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const s = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const resHHMM = (iso) => { try { return new Date(iso).toTimeString().slice(0, 5); } catch (_) { return ""; } };
/* ISO (timestamptz) → valore per <input type="datetime-local"> in ora locale */
function resIsoToLocalInput(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/* tutti i tavoli del locale come opzioni { _id, n, room } (da window.ROOMS) */
function resAllTables() {
  return (window.ROOMS || []).flatMap((r) => (r.tables || []).map((t) => ({ _id: t._id, n: t.n, room: r.nome })));
}

/* ═══════════ stili locali (self-contained, niente dipendenza dall'ordine di caricamento) ═══════════ */
const RES_INPUT = { width: "100%", height: 44, padding: "0 13px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--raised)", fontFamily: "var(--f-ui)", fontSize: 14.5, color: "var(--ink)", outline: "none", boxSizing: "border-box" };
const RES_LABEL = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 };
function ResField({ label, children }) {
  return <label style={{ display: "block", marginBottom: 14 }}><span style={RES_LABEL}>{label}</span>{children}</label>;
}

/* ═══════════════════ MODALE CREA / MODIFICA ═══════════════════ */
function ReservationModal({ open, onClose, reservation, defaultDate, onSaved }) {
  const isEdit = !!reservation;
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [coperti, setCoperti] = useState(2);
  const [quando, setQuando] = useState("");
  const [durata, setDurata] = useState(90);
  const [tableId, setTableId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const tavoli = resAllTables();

  useEffect(() => {
    if (!open) return;
    if (reservation) {
      setNome(reservation.customerName || "");
      setTel(reservation.customerPhone || "");
      setCoperti(reservation.partySize || 2);
      setQuando(resIsoToLocalInput(reservation.startsAt));
      setDurata(reservation.durationMin || 90);
      setTableId(reservation.tableId || "");
      setNote(reservation.notes || "");
    } else {
      setNome(""); setTel(""); setCoperti(2);
      // default: giorno visualizzato alle 20:00
      setQuando(`${defaultDate || resToday()}T20:00`);
      setDurata(90); setTableId(""); setNote("");
    }
  }, [open, reservation, defaultDate]);

  const save = async () => {
    if (saving) return;
    if (nome.trim().length < 1) { toast("Inserisci il nome del cliente", { type: "error" }); return; }
    if (tel.trim().length < 1) { toast("Inserisci un recapito telefonico", { type: "error" }); return; }
    if (!quando) { toast("Scegli data e ora", { type: "error" }); return; }
    const startsAt = new Date(quando);
    if (isNaN(startsAt.getTime())) { toast("Data/ora non valida", { type: "error" }); return; }
    setSaving(true);
    try {
      const payload = {
        customerName: nome.trim(),
        customerPhone: tel.trim(),
        partySize: Number(coperti) || 1,
        startsAt: startsAt.toISOString(),
        durationMin: Number(durata) || 90,
        tableId: tableId || null,
        notes: note.trim() || null,
      };
      if (isEdit) {
        await resApi.update(reservation.id, payload);
        toast("Prenotazione aggiornata", { type: "success" });
      } else {
        await resApi.create(payload);
        toast("Prenotazione creata", { type: "success" });
      }
      onClose();
      onSaved && onSaved();
    } catch (e) {
      toast(e.code === "RESERVATION_OVERLAP" ? "Il tavolo è già prenotato in quella fascia oraria." : e.message, { type: "error" });
    } finally { setSaving(false); }
  };

  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 420, maxWidth: "calc(100vw - 40px)", background: "var(--surface)", borderRadius: 24, boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", maxHeight: "calc(100% - 48px)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="clock" size={20} /></div>
          <h3 style={{ fontSize: 18, flex: 1 }}>{isEdit ? "Modifica prenotazione" : "Nuova prenotazione"}</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div className="scroll" style={{ padding: 20, overflowY: "auto" }}>
          <ResField label="Nome cliente"><input style={RES_INPUT} value={nome} autoFocus onChange={(e) => setNome(e.target.value)} placeholder="Es. Marco Rossi" /></ResField>
          <ResField label="Telefono"><input style={RES_INPUT} value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+39…" /></ResField>
          <div style={{ display: "flex", gap: 12 }}>
            <ResField label="Coperti"><input style={RES_INPUT} type="number" min="1" value={coperti} onChange={(e) => setCoperti(e.target.value)} /></ResField>
            <ResField label="Durata (min)"><input style={RES_INPUT} type="number" min="15" step="15" value={durata} onChange={(e) => setDurata(e.target.value)} /></ResField>
          </div>
          <ResField label="Data e ora"><input style={RES_INPUT} type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></ResField>
          <ResField label="Tavolo (opzionale)">
            <select style={RES_INPUT} value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">Nessun tavolo assegnato</option>
              {tavoli.map((t) => <option key={t._id} value={t._id}>Tavolo {t.n}{t.room ? ` · ${t.room}` : ""}</option>)}
            </select>
          </ResField>
          <ResField label="Note (opzionale)"><textarea style={{ ...RES_INPUT, height: 66, padding: 13, resize: "none" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Allergie, occasione, richieste…" /></ResField>
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvo…" : (isEdit ? "Salva" : "Crea prenotazione")}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* ═══════════════════ RIGA PRENOTAZIONE ═══════════════════ */
function ReservationRow({ r, mobile, onEdit, onStatus, onDelete }) {
  const st = RES_STATUS[r.status] || RES_STATUS.requested;
  const cancelled = r.status === "cancelled";
  return (
    <div style={{ display: "flex", alignItems: mobile ? "flex-start" : "center", gap: 14, padding: "13px 16px", borderBottom: "1px solid var(--hairline)", flexWrap: mobile ? "wrap" : "nowrap", opacity: cancelled ? 0.55 : 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 56, flex: "none" }}>
        <span className="num" style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{resHHMM(r.startsAt)}</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.durationMin}′</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.customerName}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
          <Icon name="user" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {r.partySize} coperti
          {r.tableNumber != null ? <> · <Icon name="table" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Tavolo {r.tableNumber}</> : <span style={{ color: "var(--wait)" }}> · senza tavolo</span>}
          {r.customerPhone ? <> · <span className="mono">{r.customerPhone}</span></> : null}
        </div>
        {r.notes ? <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3, fontStyle: "italic" }}>{r.notes}</div> : null}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {!cancelled && r.status !== "confirmed" && r.status !== "seated" && (
          <Btn size="sm" kind="soft" icon="check" onClick={() => onStatus(r, "confirmed")}>Conferma</Btn>
        )}
        {!cancelled && r.status !== "seated" && (
          <Btn size="sm" kind="soft" icon="user" onClick={() => onStatus(r, "seated")}>Seduti</Btn>
        )}
        {!cancelled && (
          <Btn size="sm" kind="ghost" onClick={() => onStatus(r, "no_show")}>No-show</Btn>
        )}
        <IconBtn name="edit" tone="ghost" onClick={() => onEdit(r)} label="Modifica" />
        {!cancelled
          ? <IconBtn name="x" tone="ghost" style={{ color: "var(--danger)" }} onClick={() => onStatus(r, "cancelled")} label="Annulla" />
          : <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} onClick={() => onDelete(r)} label="Elimina" />}
      </div>
    </div>
  );
}

/* ═══════════════════ SCHERMATA PRENOTAZIONI ═══════════════════ */
function ScreenPrenotazioni({ mobile }) {
  const [date, setDate] = useState(resToday());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);      // { reservation: null|r } quando aperto
  const [delTarget, setDelTarget] = useState(null);

  const load = async (d) => {
    setLoading(true);
    try {
      const rows = await resApi.list(d);
      setList(rows || []);
    } catch (e) {
      setList([]); toast(e.message, { type: "error" });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(date); }, [date]);

  const onStatus = async (r, status) => {
    const prev = list;
    setList((l) => l.map((x) => x.id === r.id ? { ...x, status } : x));
    try {
      await resApi.setStatus(r.id, status);
      toast(`Prenotazione · ${(RES_STATUS[status] || {}).label || status}`, { type: "success" });
    } catch (e) { setList(prev); toast(e.message, { type: "error" }); }
  };
  const onDelete = async (r) => {
    try {
      await resApi.remove(r.id);
      toast("Prenotazione eliminata", { type: "success" });
      setDelTarget(null);
      load(date);
    } catch (e) { toast(e.message, { type: "error" }); setDelTarget(null); }
  };

  const attive = list.filter((r) => r.status !== "cancelled");
  const coperti = attive.reduce((a, r) => a + (r.partySize || 0), 0);
  const isToday = date === resToday();

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="serve" title="Prenotazioni" sub={`${attive.length} prenotazioni · ${coperti} coperti`}
        actions={<Btn kind="brand" icon="plus" onClick={() => setModal({ reservation: null })}>Nuova prenotazione</Btn>} />

      {/* navigazione giorno */}
      <Card pad={mobile ? 12 : 14} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <IconBtn name="chevL" tone="soft" onClick={() => setDate((d) => resAddDays(d, -1))} label="Giorno precedente" />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, fontFamily: "var(--f-display)" }}>{resPrettyDate(date)}</div>
          {isToday && <div style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>Oggi</div>}
        </div>
        <IconBtn name="chevR" tone="soft" onClick={() => setDate((d) => resAddDays(d, 1))} label="Giorno successivo" />
        {!isToday && <Btn size="sm" kind="soft" onClick={() => setDate(resToday())}>Oggi</Btn>}
      </Card>

      {loading ? (
        <Card pad={40} style={{ textAlign: "center", color: "var(--ink-3)" }}>Carico…</Card>
      ) : list.length === 0 ? (
        <Empty tako="serve" title="Nessuna prenotazione" sub="Non ci sono prenotazioni per questo giorno."
          action={<Btn kind="brand" icon="plus" onClick={() => setModal({ reservation: null })}>Aggiungi prenotazione</Btn>} />
      ) : (
        <Card pad={0} style={{ overflow: "hidden" }}>
          {list.map((r) => (
            <ReservationRow key={r.id} r={r} mobile={mobile}
              onEdit={(res) => setModal({ reservation: res })}
              onStatus={onStatus}
              onDelete={(res) => setDelTarget(res)} />
          ))}
        </Card>
      )}

      <ReservationModal open={!!modal} reservation={modal ? modal.reservation : null} defaultDate={date}
        onClose={() => setModal(null)} onSaved={() => load(date)} />
      <Confirm open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => delTarget && onDelete(delTarget)} danger
        title="Eliminare la prenotazione?" body="La prenotazione verrà rimossa definitivamente." confirmLabel="Elimina" />
    </ScreenScroll>
  );
}

Object.assign(window, { ScreenPrenotazioni, ReservationModal, ReservationRow, RES_STATUS });
