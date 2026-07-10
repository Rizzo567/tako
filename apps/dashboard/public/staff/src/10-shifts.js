/* ───────────────── Tako Dashboard — Turni Staff ─────────────────
   Schermata "Turni": stato staff (in turno/fuori) con clock-in/out,
   vista settimana dei turni e form manuale. Stile premium-soft, verbatim
   ai componenti kit. Legge/scrive via window.TakoAPI (self-contained:
   non tocca il data-layer condiviso). */

/* helper locali (prefisso sh* per non collidere con i globali del data-layer) */
const SH_DOW = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const shHHMM = (iso) => { try { const d = new Date(iso); return d.toTimeString().slice(0, 5); } catch (_) { return "--:--"; } };
const shDayNum = (iso) => { try { return new Date(iso).getDate(); } catch (_) { return ""; } };
function shMonday(d = new Date()) {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7; // 0 = lunedì
  x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - dow); return x;
}
function shAddDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function shSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
/* durata leggibile inizio→fine (o →adesso se aperto) */
function shDuration(startIso, endIso) {
  const s = new Date(startIso).getTime();
  const e = endIso ? new Date(endIso).getTime() : Date.now();
  const min = Math.max(0, Math.round((e - s) / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
/* Date → valore per <input type="datetime-local"> in ora locale */
function shToLocalInput(date) {
  const d = new Date(date); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/* mappa ruolo DB → etichetta breve */
const SH_ROLE_LABEL = { owner: "Titolare", dipendente: "Cameriere", chef: "Chef", cassiere: "Cassiere" };

/* Modale form turno manuale — creazione e modifica (solo manager). */
function ShiftFormModal({ open, onClose, shift, staff, onSaved }) {
  const isEdit = !!shift;
  const [userId, setUserId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (shift) {
      setUserId(shift.userId || "");
      setStart(shift.startsAt ? shToLocalInput(shift.startsAt) : "");
      setEnd(shift.endsAt ? shToLocalInput(shift.endsAt) : "");
      setRole(shift.role || "");
      setNotes(shift.notes || "");
    } else {
      const now = new Date();
      setUserId(staff[0] ? staff[0]._id : "");
      setStart(shToLocalInput(now));
      setEnd("");
      setRole("");
      setNotes("");
    }
    setConfirmDel(false);
  }, [open, shift]);
  const save = async () => {
    if (saving) return;
    if (!userId) { toast("Seleziona un membro", { type: "error" }); return; }
    if (!start) { toast("Inserisci l'orario di inizio", { type: "error" }); return; }
    const startsAt = new Date(start).toISOString();
    const endsAt = end ? new Date(end).toISOString() : null;
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) { toast("La fine deve essere dopo l'inizio", { type: "error" }); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await window.TakoAPI.patch(`/shifts/${shift.id}`, { startsAt, endsAt, role: role.trim() || null, notes: notes.trim() || null });
        toast("Turno aggiornato", { type: "success" });
      } else {
        await window.TakoAPI.post(`/shifts`, { userId, startsAt, endsAt, role: role.trim() || undefined, notes: notes.trim() || undefined });
        toast("Turno creato", { type: "success" });
      }
      onClose(); await onSaved();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSaving(false); }
  };
  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 400, maxWidth: "calc(100vw - 40px)", background: "var(--surface)", borderRadius: 24, boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", maxHeight: "calc(100% - 48px)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="clock" size={20} /></div>
          <h3 style={{ fontSize: 18, flex: 1 }}>{isEdit ? "Modifica turno" : "Nuovo turno"}</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div className="scroll" style={{ padding: 20, overflowY: "auto" }}>
          <Field label="Membro">
            <select style={inputStyle} value={userId} disabled={isEdit} onChange={e => setUserId(e.target.value)}>
              {!staff.length && <option value="">Nessun membro</option>}
              {staff.map(m => <option key={m._id} value={m._id}>{m.nome}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <Field label="Inizio"><input style={inputStyle} type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></Field>
            <Field label="Fine (vuoto = in corso)"><input style={inputStyle} type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Mansione (opzionale)"><input style={inputStyle} value={role} onChange={e => setRole(e.target.value)} placeholder="Es. Sala, Cucina, Cassa" /></Field>
          <Field label="Note (opzionale)"><textarea style={{ ...inputStyle, height: 70, padding: 13, resize: "none" }} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          {isEdit && (
            <Btn kind="danger" full icon="trash" onClick={() => setConfirmDel(true)}>Elimina turno</Btn>
          )}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvo…" : (isEdit ? "Salva" : "Crea turno")}</Btn>
        </div>
        <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} danger
          title="Eliminare il turno?" body="Il turno verrà rimosso definitivamente." confirmLabel="Elimina"
          onConfirm={async () => {
            try {
              await window.TakoAPI.del(`/shifts/${shift.id}`);
              toast("Turno eliminato", { type: "success" });
              setConfirmDel(false); onClose(); await onSaved();
            } catch (e) { toast(e.message, { type: "error" }); setConfirmDel(false); }
          }} />
      </div>
    </Overlay>
  );
}

function ScreenTurni({ mobile }) {
  const role = window.__takoRole || "owner";
  const isManager = role === "owner" || role === "cassiere";
  const [me, setMe] = useState(null);
  const [active, setActive] = useState([]);   // turni aperti [{ userId, startsAt, ... }]
  const [week, setWeek] = useState([]);        // turni della settimana selezionata
  const [weekStart, setWeekStart] = useState(() => shMonday());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);  // userId in corso di clock-in/out
  const [formOpen, setFormOpen] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const staff = (window.STAFF || []).filter(m => m.attivo);

  const reload = async () => {
    setLoading(true);
    const from = weekStart, to = shAddDays(weekStart, 7);
    try {
      const [act, wk] = await Promise.all([
        window.TakoAPI.get(`/shifts/active`).catch(() => []),
        window.TakoAPI.get(`/shifts?from=${from.toISOString()}&to=${to.toISOString()}`).catch(() => []),
      ]);
      setActive(act || []); setWeek(wk || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [weekStart]);
  useEffect(() => { window.TakoAPI.get("/auth/me").then(setMe).catch(() => {}); }, []);

  const openByUser = {};
  for (const s of active) openByUser[s.userId] = s;
  const myId = me && me.id;
  const canManageUser = (uid) => isManager || uid === myId;
  const onShiftCount = Object.keys(openByUser).length;

  const clock = async (uid, action) => {
    if (busyId) return;
    setBusyId(uid);
    try {
      await window.TakoAPI.post(`/shifts/${action === "in" ? "clock-in" : "clock-out"}`, { userId: uid });
      toast(action === "in" ? "Turno iniziato" : "Turno terminato", { type: "success", icon: "check" });
      await reload();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setBusyId(null); }
  };

  // giorni della settimana + turni raggruppati per giorno
  const days = Array.from({ length: 7 }, (_, i) => shAddDays(weekStart, i));
  const today = new Date();
  const shiftsOfDay = (day) => week.filter(s => shSameDay(new Date(s.startsAt), day)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const weekLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1} – ${shAddDays(weekStart, 6).getDate()}/${shAddDays(weekStart, 6).getMonth() + 1}`;
  const isThisWeek = shSameDay(weekStart, shMonday());

  const colFor = (uiRole) => ({ owner: "var(--brand)", cameriere: "var(--info)", chef: "var(--wait)", cassiere: "var(--ok)" }[uiRole] || "var(--info)");

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="hello" title="Turni" sub={`${onShiftCount} in turno · ${staff.length} membri`}
        actions={isManager ? <Btn kind="brand" icon="plus" onClick={() => { setEditShift(null); setFormOpen(true); }}>Nuovo turno</Btn> : null} />

      {/* ── Stato staff: chi è dentro/fuori + clock-in/out ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 10px" }}>
        <Icon name="staff" size={16} style={{ color: "var(--ink-3)" }} />
        <h3 style={{ fontSize: 16 }}>Chi è in turno</h3>
        <Badge tone="brand">{onShiftCount}</Badge>
      </div>
      {staff.length === 0 ? (
        <Card pad={20}><p style={{ fontSize: 13.5, color: "var(--ink-3)" }}>Nessun membro attivo. Aggiungi lo staff dalla sezione Staff.</p></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 14, marginBottom: 22 }}>
          {staff.map(m => {
            const open = openByUser[m._id];
            const can = canManageUser(m._id);
            const busy = busyId === m._id;
            return (
              <Card key={m._id} pad={16}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: "none", position: "relative" }}>
                    <Avatar initials={(m.nome || "?").split(" ").map(w => w[0]).join("")} color={colFor(m.ruolo)} size={46} />
                    <span style={{ position: "absolute", right: -1, bottom: -1, width: 14, height: 14, borderRadius: 99, background: open ? "var(--ok)" : "var(--ink-3)", border: "2px solid var(--surface)" }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{m.nome}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                      {open ? `In turno da ${shHHMM(open.startsAt)} · ${shDuration(open.startsAt)}` : "Fuori turno"}
                    </div>
                  </div>
                  {open ? <Badge tone="ok" dot>In turno</Badge> : <Badge tone="muted">Fuori</Badge>}
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
                  {open ? (
                    <Btn kind="soft" full icon="logout" disabled={!can || busy} onClick={() => clock(m._id, "out")}>{busy ? "…" : "Timbra uscita"}</Btn>
                  ) : (
                    <Btn kind="brand" full icon="check" disabled={!can || busy} onClick={() => clock(m._id, "in")}>{busy ? "…" : "Timbra entrata"}</Btn>
                  )}
                  {!can && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6, textAlign: "center" }}>Solo titolare/cassiere</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Vista settimana ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 12px" }}>
        <Icon name="clock" size={16} style={{ color: "var(--ink-3)" }} />
        <h3 style={{ fontSize: 16, flex: 1 }}>Settimana · {weekLabel}{isThisWeek ? " (corrente)" : ""}</h3>
        <IconBtn name="chevL" tone="soft" onClick={() => setWeekStart(shAddDays(weekStart, -7))} />
        <IconBtn name="home" tone="soft" onClick={() => setWeekStart(shMonday())} label="Questa settimana" />
        <IconBtn name="chevR" tone="soft" onClick={() => setWeekStart(shAddDays(weekStart, 7))} />
      </div>
      {loading ? (
        <Card pad={20}><p style={{ fontSize: 13.5, color: "var(--ink-3)" }}>Caricamento turni…</p></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(7,1fr)", gap: mobile ? 10 : 8 }}>
          {days.map((day, i) => {
            const list = shiftsOfDay(day);
            const isToday = shSameDay(day, today);
            return (
              <Card key={i} pad={0} style={{ overflow: "hidden", border: isToday ? "1.5px solid var(--brand)" : undefined }}>
                <div style={{ padding: "10px 12px", background: isToday ? "var(--brand-tint)" : "var(--sunken)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: isToday ? "var(--brand)" : "var(--ink-2)", fontFamily: "var(--f-display)" }}>{SH_DOW[i]}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{shDayNum(day)}</span>
                  {list.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>{list.length}</span>}
                </div>
                <div style={{ padding: 8, minHeight: mobile ? 0 : 90, display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.length === 0 ? (
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", padding: "6px 4px" }}>—</span>
                  ) : list.map(s => (
                    <button key={s.id} className="press" disabled={!isManager} onClick={() => { if (!isManager) return; setEditShift(s); setFormOpen(true); }}
                      style={{ textAlign: "left", background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 10, padding: "7px 9px", cursor: isManager ? "pointer" : "default" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: s.endsAt ? "var(--ink-3)" : "var(--ok)", flex: "none" }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.userName}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }} className="num">
                        {shHHMM(s.startsAt)}{s.endsAt ? `–${shHHMM(s.endsAt)}` : " · in corso"}
                      </div>
                      {s.role && <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1 }}>{SH_ROLE_LABEL[s.role] || s.role}</div>}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ShiftFormModal open={formOpen} onClose={() => setFormOpen(false)} shift={editShift} staff={staff} onSaved={reload} />
    </ScreenScroll>
  );
}

window.ScreenTurni = ScreenTurni;
