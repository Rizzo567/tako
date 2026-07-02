/* ───────────────── Tako Dashboard — data layer REALE ─────────────────
   Sostituisce i dati demo. Stesse FORME dei globali del prototipo, ma popolate
   dal backend (/api same-origin via proxy Next) + realtime via socket.io.
   La UI (kit, shell, schermate) resta verbatim e legge questi stessi globali. */

/* ═══════════ costanti UI (verbatim dal prototipo, non sono dati) ═══════════ */
const ORDER_STATUS = {
  attesa:     { label: "In attesa",      tone: "wait" },
  confermato: { label: "Confermato",     tone: "info" },
  prep:       { label: "In preparazione",tone: "brand" },
  pronto:     { label: "Pronto",         tone: "ok" },
  servito:    { label: "Servito",        tone: "muted" },
  pagato:     { label: "Pagato",         tone: "okDeep" },
  annullato:  { label: "Annullato",      tone: "danger" },
};
const TABLE_STATUS = {
  libero:    { label: "Libero",     color: "var(--st-free)" },
  occupato:  { label: "Occupato",   color: "var(--st-busy)" },
  attesa:    { label: "In attesa",  color: "var(--st-wait)" },
  pronto:    { label: "Pronto",     color: "var(--st-ready)" },
  pulizia:   { label: "Pulizia",    color: "var(--st-clean)" },
  prenotato: { label: "Prenotato",  color: "var(--st-resv)" },
};
const STATIONS = ["Cucina", "Griglia", "Pizzeria", "Bar"];
const ROLES = {
  owner:    { label: "Titolare",  name: "—", initials: "—" },
  cameriere:{ label: "Cameriere", name: "—", initials: "—" },
  chef:     { label: "Chef",      name: "—", initials: "—" },
  cassiere: { label: "Cassiere",  name: "—", initials: "—" },
};
const BRAND_PALETTES = {
  arancione: { label: "Arancione", brand: "#ED7159", deep: "#D9533A", tint: "#FCE7DF", wash: "#FBF1ED", on: "#FFFFFF" },
  blu:       { label: "Blu",       brand: "#3E7BD0", deep: "#2C5FA8", tint: "#E4ECF9", wash: "#EFF4FB", on: "#FFFFFF" },
  giallo:    { label: "Giallo",    brand: "#F0B429", deep: "#CE9410", tint: "#FBF0D2", wash: "#FBF7EA", on: "#2A1F1A" },
  verde:     { label: "Verde",     brand: "#4FA980", deep: "#2F7D58", tint: "#E1F1E9", wash: "#EEF6F1", on: "#FFFFFF" },
  rosa:      { label: "Rosa",      brand: "#E86FA6", deep: "#C9497F", tint: "#FBE4EF", wash: "#FBF0F6", on: "#FFFFFF" },
};
const CUR = { sym: "€" };
const CURRENCIES = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF " };
const SETUP = [
  { k: "Dati ristorante", done: false, route: "impostazioni" },
  { k: "Tavoli",          done: false, route: "tavoli" },
  { k: "Menu",            done: false, route: "menu" },
  { k: "QR Code",         done: false, route: "qr" },
  { k: "Team",            done: false, route: "staff" },
];
const SETTINGS_DEFAULTS = {
  nome: "", indirizzo: "", telefono: "",
  servizioTavolo: true, asporto: true, pagaTavolo: true, ai: false, prenotazioni: false,
  copertoOn: true, coperto: 2, manceSuggerite: true,
  suoniOrdini: true, autoConferma: false, stampaAuto: true,
  kdsWarn: 10, kdsLate: 15, kdsCompatta: false,
  mostraOnboarding: true, kpi: { incasso: true, ordini: true, ticket: true, coperti: true },
  valuta: "EUR", iva: 10, fuso: "Europe/Rome", lingue: ["IT", "EN", "FR"], linguaDefault: "IT",
  printerIp: "", printerPort: "9100",
};

/* dati dinamici (riempiti dal backend) — forme identiche al prototipo */
let RESTAURANT = { name: "", city: "", vat: "", brand: "#ED7159" };
let KPI = { incasso: 0, ordiniAttivi: 0, ticketMedio: 0, coperti: 0, conti: 0, inAttesa: 0 };
let WEEK = [], ORDERS = [], ROOMS = [], WAITER_CALLS = [], BILLS = [];
let CASSA_OGGI = { incasso: 0, mance: 0, conti: 0, ticket: 0 };
let MENU = [], ENGINEERING = [], INVENTORY = [], STAFF = [];
let PEAK_HOURS = [], TOP_DISHES = [], QR_ANALYTICS = { scansioni: 0, conversione: 0, tempoPrimo: "—" };

/* ═══════════ mapping enum DB ⇄ prototipo ═══════════ */
const ORD_DB2UI = { pending:"attesa", confirmed:"confermato", preparing:"prep", ready:"pronto", served:"servito", paid:"pagato", cancelled:"annullato" };
const ORD_UI2DB = { attesa:"pending", confermato:"confirmed", prep:"preparing", pronto:"ready", servito:"served", pagato:"paid", annullato:"cancelled" };
const ITEM_DB2UI = { pending:"attesa", preparing:"prep", ready:"pronto", served:"servito" };
const ITEM_UI2DB = { attesa:"pending", prep:"preparing", pronto:"ready", servito:"served" };
const TBL_DB2UI = { free:"libero", occupied:"occupato", waiting:"attesa", cleaning:"pulizia", reserved:"prenotato" };
const TBL_UI2DB = { libero:"free", occupato:"occupied", attesa:"waiting", pulizia:"cleaning", prenotato:"reserved", pronto:"occupied" };
const TYPE_DB2UI = { table:"tavolo", takeaway:"asporto" };
const ROLE_DB2UI = { owner:"owner", dipendente:"cameriere", chef:"chef", cassiere:"cassiere" };
const ROLE_UI2DB = { owner:"owner", cameriere:"dipendente", chef:"chef", cassiere:"cassiere" };
const CALL_TYPE_LABEL = { help:"Aiuto", bill:"Chiede il conto", water:"Acqua e pane" };
const QUAD_DB2UI = { star:"star", plowhorse:"plow", puzzle:"puzzle", dog:"dog" };

/* ═══════════ helper API (same-origin /api, cookie sessione) ═══════════ */
const TakoAPI = {
  async req(method, path, body) {
    const opt = { method, credentials: "include", headers: {} };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const r = await fetch("/api" + path, opt);
    let j = null; try { j = await r.json(); } catch (_) {}
    if (!r.ok) { const e = new Error(j?.error?.message || r.statusText); e.code = j?.error?.code; e.status = r.status; throw e; }
    return j ? j.data : null;
  },
  get(p) { return this.req("GET", p); },
  post(p, b) { return this.req("POST", p, b); },
  put(p, b) { return this.req("PUT", p, b); },
  patch(p, b) { return this.req("PATCH", p, b); },
  del(p) { return this.req("DELETE", p); },
};

/* ═══════════ trasformazioni reale → forma prototipo ═══════════ */
const hhmm = (iso) => { try { const d = new Date(iso); return d.toTimeString().slice(0, 5); } catch (_) { return ""; } };
const minsSince = (iso) => { try { return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); } catch (_) { return 0; } };
const DOW = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];

function mapOrder(o) {
  const short = (o.id || "").replace(/-/g, "").slice(0, 4).toUpperCase();
  return {
    id: `${o.tableNumber != null ? "T" + String(o.tableNumber).padStart(2, "0") : "AS"}-${short}`,
    _id: o.id,
    tavolo: o.tableNumber != null ? String(o.tableNumber) : null,
    tipo: TYPE_DB2UI[o.type] || "tavolo",
    stato: ORD_DB2UI[o.status] || "attesa",
    orario: hhmm(o.createdAt),
    min: minsSince(o.createdAt),
    note: o.notes || "",
    items: (o.items || []).map((it) => ({
      nome: it.name, qty: it.quantity, prezzo: Number(it.unitPrice) || 0,
      station: it.kitchenStation || "Cucina", note: it.notes || "",
      stato: ITEM_DB2UI[it.status] || "attesa",
      _id: it.id,
    })),
    _raw: o,
  };
}
function mapRoom(r) {
  return {
    id: r.id, nome: r.name,
    // Numero tavolo come STRINGA end-to-end + sort naturale (10 dopo 9, non dopo 1).
    tables: (r.tables || []).map((t) => ({
      n: String(t.number), posti: t.seats, stato: TBL_DB2UI[t.status] || "libero",
      x: t.posX != null ? t.posX : 10, y: t.posY != null ? t.posY : 10,
      _hasPos: t.posX != null && t.posY != null, _id: t.id, _qr: t.qrToken,
    })).sort((a, b) => String(a.n).localeCompare(String(b.n), undefined, { numeric: true })),
  };
}
function mapBill(b) {
  return { id: b.id, tavolo: b.tableNumber != null ? String(b.tableNumber) : null, coperti: b.covers || 0,
           subtotale: Number(b.subtotal) || 0, apertura: hhmm(b.createdAt),
           total: Number(b.total) || 0, tip: Number(b.tip) || 0, _raw: b };
}
function mapInventory(i) {
  return { nome: i.name, unita: i.unit, giac: Number(i.quantity) || 0, min: Number(i.minQuantity) || 0,
           costo: i.costPerUnit != null ? Number(i.costPerUnit) : 0, forn: i.supplier || "", _id: i.id };
}
function mapStaff(u) {
  return { nome: u.name, email: u.email, ruolo: ROLE_DB2UI[u.role] || u.role, tel: u.phone || "",
           attivo: !!u.active, online: false, _id: u.id };
}

/* costruisce MENU [{sezione,piatti[]}] dal primo menu attivo */
async function loadMenu() {
  const menus = await TakoAPI.get("/menus");
  if (!menus || !menus.length) return [];
  const active = menus.find((m) => m.active) || menus[0];
  const full = await TakoAPI.get("/menus/" + active.id);
  window.__menuId = active.id;
  const sections = (full.sections || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  return sections.map((s) => ({
    sezione: s.name,
    _id: s.id, _menuId: active.id,
    piatti: (s.items || []).map((it) => ({
      nome: it.name, prezzo: Number(it.price) || 0, costo: it.costPrice != null ? Number(it.costPrice) : 0,
      disp: !!it.available, station: it.kitchenStation || "Cucina", tag: it.tags || [], alg: it.allergens || [],
      desc: it.description || "", img: it.imageUrl || "", _id: it.id, _sectionId: s.id,
      // varianti reali dal backend (itemVariants): { _id, nome, mod }
      varianti: (it.variants || []).map((v) => ({ _id: v.id, nome: v.name, mod: Number(v.priceModifier) || 0 })),
      // traduzioni multilingua: [{ lang, name, description }]
      traduzioni: it.translations || [],
    })),
  }));
}

/* ═══════════ caricamento completo (post-login) ═══════════ */
async function loadAll() {
  const today = new Date(); const from = new Date(today); from.setDate(from.getDate() - 6);
  const iso = (d) => d.toISOString().slice(0, 10);
  const [rest, active, rooms, bills, cassa, stats, menu, inv, staff, insights] = await Promise.all([
    TakoAPI.get("/restaurants/me").catch(() => null),
    TakoAPI.get("/orders/active").catch(() => []),
    TakoAPI.get("/tables/rooms").catch(() => []),
    TakoAPI.get("/bills/open").catch(() => []),
    TakoAPI.get("/bills/summary/today").catch(() => null),
    TakoAPI.get(`/stats/dashboard?from=${iso(from)}&to=${iso(today)}`).catch(() => null),
    loadMenu().catch(() => []),
    TakoAPI.get("/inventory").catch(() => []),
    TakoAPI.get("/staff").catch(() => []),
    TakoAPI.get("/insights/menu?days=30").catch(() => null),
  ]);

  if (rest) {
    RESTAURANT = { name: rest.name || "", city: (rest.address || "").split(",").pop()?.trim() || "", vat: rest.settings?.vat || "", brand: rest.primaryColor || "#ED7159" };
    window.__settings_raw = rest;
    Object.assign(SETTINGS_DEFAULTS, {
      nome: rest.name || "", indirizzo: rest.address || "", telefono: rest.phone || "",
      valuta: rest.settings?.currency || "EUR", iva: rest.settings?.vatRate ?? 10, fuso: rest.settings?.timezone || "Europe/Rome",
      lingue: rest.settings?.languages || ["IT"], linguaDefault: rest.settings?.defaultLanguage || "IT",
      servizioTavolo: rest.settings?.tableServiceEnabled ?? true, asporto: rest.settings?.takeawayEnabled ?? true,
      pagaTavolo: rest.settings?.payAtTableEnabled ?? true, ai: rest.settings?.aiEnabled ?? false,
      printerIp: rest.settings?.printerIp || "", printerPort: rest.settings?.printerPort || "9100",
      // preferenze operative persistite (read-back)
      coperto: rest.settings?.coverCharge ?? 2, copertoOn: rest.settings?.coverChargeEnabled ?? true,
      manceSuggerite: rest.settings?.suggestedTips ?? true, suoniOrdini: rest.settings?.orderSounds ?? true,
      autoConferma: rest.settings?.autoConfirm ?? false, stampaAuto: rest.settings?.autoPrint ?? true,
      kdsWarn: rest.settings?.kdsWarnMinutes ?? 10, kdsLate: rest.settings?.kdsLateMinutes ?? 15,
      kdsCompatta: rest.settings?.kdsCompact ?? false, prenotazioni: rest.settings?.reservationsEnabled ?? false,
      mostraOnboarding: rest.settings?.showOnboarding ?? true,
    });
  }
  ORDERS = (active || []).map(mapOrder);
  ROOMS = (rooms || []).map(mapRoom);
  BILLS = (bills || []).map(mapBill);
  if (cassa) CASSA_OGGI = { incasso: Number(cassa.revenue) || 0, mance: Number(cassa.tips) || 0, conti: cassa.billsCount || 0, ticket: Number(cassa.avgTicket) || 0 };
  if (stats) {
    KPI = {
      incasso: Number(stats.todayRevenue ?? stats.revenue) || 0,
      ordiniAttivi: ORDERS.filter((o) => ["attesa","confermato","prep","pronto"].includes(o.stato)).length,
      ticketMedio: Number(stats.avgTicket) || 0, coperti: stats.totalCovers || 0,
      conti: stats.billsCount || 0, inAttesa: stats.pendingOrdersCount || 0,
    };
    WEEK = (stats.dailyRevenue || []).map((d) => ({ g: DOW[new Date(d.date).getDay()], v: Number(d.amount) || 0 }));
    TOP_DISHES = (stats.topItems || []).map((t) => ({ nome: t.name, n: t.qty }));
    PEAK_HOURS = (stats.sessions?.scansPerHour || []).map((s) => ({ h: String(s.hour), v: s.count }));
    const se = stats.sessions || {};
    QR_ANALYTICS = { scansioni: se.totalScans || 0, conversione: Math.round(se.conversionRate || 0),
                     tempoPrimo: se.avgTimeToFirstOrderSec ? `${Math.floor(se.avgTimeToFirstOrderSec/60)}m ${se.avgTimeToFirstOrderSec%60}s` : "—" };
  }
  MENU = menu || [];
  INVENTORY = (inv || []).map(mapInventory);
  STAFF = (staff || []).map(mapStaff);
  if (insights) ENGINEERING = (insights.items || []).filter((i) => QUAD_DB2UI[i.quadrant]).map((i) => ({ nome: i.name, vol: i.totalQty, margine: Math.round(i.marginPercent || 0), cls: QUAD_DB2UI[i.quadrant] }));

  // onboarding reale — ogni step riflette i dati veri
  SETUP[0].done = !!(RESTAURANT.name && RESTAURANT.name.trim());
  SETUP[1].done = ROOMS.some((r) => r.tables.length);
  SETUP[2].done = MENU.some((s) => s.piatti.length);
  SETUP[3].done = ROOMS.some((r) => r.tables.some((t) => t._qr));
  SETUP[4].done = STAFF.length > 1;

  syncGlobals();
}

/* ripubblica i globali su window (le schermate li leggono da lì) */
function syncGlobals() {
  Object.assign(window, {
    RESTAURANT, KPI, WEEK, ORDERS, ROOMS, WAITER_CALLS, BILLS, CASSA_OGGI,
    MENU, ENGINEERING, INVENTORY, STAFF, PEAK_HOURS, TOP_DISHES, QR_ANALYTICS,
    ORDER_STATUS, TABLE_STATUS, BRAND_PALETTES, CUR, CURRENCIES, STATIONS, ROLES, SETUP, SETTINGS_DEFAULTS,
    _ORDERS: ORDERS, _ROOMS: ROOMS, _BILLS: BILLS, _WAITER: WAITER_CALLS,
  });
}
syncGlobals();

/* ═══════════ socket realtime ═══════════ */
let _socket = null;
function connectSocket(restaurantId, onEvent) {
  if (!window.io) return null;
  _socket = window.io({ withCredentials: true, transports: ["websocket", "polling"] });
  let _firstConnect = true;
  _socket.on("connect", () => {
    _socket.emit("join:restaurant", restaurantId);
    // Riconnessione: ricarica tutti i dati per colmare gli eventi persi mentre offline.
    // (Salta il primo connect: loadAll è già stato eseguito all'avvio.)
    if (!_firstConnect && window.takoReload) { try { window.takoReload(); } catch (_) {} }
    _firstConnect = false;
  });
  const fwd = (ev) => _socket.on(ev, (p) => onEvent(ev, p));
  ["order:new","order:updated","table:updated","waiter:called","waiter:resolved","menu:updated","menu:item_availability","inventory:alert"].forEach(fwd);
  return _socket;
}

/* ═══════════ azioni scrittura schermate secondarie (wiring centralizzato) ═══════════
   Le schermate chiamano queste e poi window.takoReload() per rinfrescare i dati.
   takoReload è impostata dall'app-root. */
const TakoActions = {
  // menu
  menuToggle: (itemId, available) => TakoAPI.patch(`/menus/items/${itemId}/availability`, { available }),
  menuSaveItem: (itemId, fields) => TakoAPI.patch(`/menus/items/${itemId}`, fields),
  translationSave: (itemId, lang, fields) => TakoAPI.put(`/menus/items/${itemId}/translations/${lang}`, fields),
  translationDelete: (itemId, lang) => TakoAPI.del(`/menus/items/${itemId}/translations/${lang}`),
  menuCreateItem: (sectionId, fields) => TakoAPI.post(`/menus/sections/${sectionId}/items`, fields),
  menuDeleteItem: (itemId) => TakoAPI.del(`/menus/items/${itemId}`),
  menuCreateSection: (name) => TakoAPI.post(`/menus/${window.__menuId}/sections`, { name }),
  variantCreate: (itemId, name, priceModifier) => TakoAPI.post(`/menus/items/${itemId}/variants`, { name, priceModifier }),
  variantDelete: (itemId, variantId) => TakoAPI.del(`/menus/items/${itemId}/variants/${variantId}`),
  // inventario
  invMove: (itemId, type, quantity, note) => TakoAPI.post(`/inventory/${itemId}/movements`, { type, quantity, note }),
  invCreate: (fields) => TakoAPI.post(`/inventory`, fields),
  invImportText: (text) => TakoAPI.post(`/inventory/import-text`, { text }),
  invImportConfirm: (items) => TakoAPI.post(`/inventory/import-confirm`, { items }),
  // staff
  staffCreate: (fields) => TakoAPI.post(`/staff`, fields),
  staffUpdate: (id, fields) => TakoAPI.patch(`/staff/${id}`, fields),
  staffDelete: (id) => TakoAPI.del(`/staff/${id}`),
  // tavoli / sale
  tableCreate: (fields) => TakoAPI.post(`/tables`, fields),
  tableUpdate: (id, fields) => TakoAPI.patch(`/tables/${id}`, fields),
  tableDelete: (id) => TakoAPI.del(`/tables/${id}`),
  roomCreate: (name) => TakoAPI.post(`/tables/rooms`, { name }),
  tableQr: (id) => TakoAPI.get(`/tables/${id}/qr`),
  tableQrRefresh: (id) => TakoAPI.post(`/tables/${id}/qr/refresh`),
  // info rete: IP LAN corrente + base URL cliente usata nei QR (segue il WiFi)
  systemInfo: () => TakoAPI.get(`/system/info`),
  // upload immagine (multipart): NON usare TakoAPI.req (forza JSON). Il browser
  // imposta da solo il boundary multipart. Ritorna { url }.
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/uploads/image", { method: "POST", credentials: "include", body: fd });
    let j = null; try { j = await r.json(); } catch (_) {}
    if (!r.ok) { const e = new Error(j?.error?.message || r.statusText); e.code = j?.error?.code; throw e; }
    return j ? j.data : null;
  },
  // comanda (ordine creato dallo staff)
  staffOrder: (body) => TakoAPI.post(`/orders`, body),
  // conti / cassa
  billCreate: (body) => TakoAPI.post(`/bills`, body),
  billUpdate: (id, fields) => TakoAPI.patch(`/bills/${id}`, fields),
  // La mancia viaggia dentro il POST /payments (requireAuth: il cameriere può incassare),
  // non più con un PATCH separato che dava 403 al cameriere.
  billPay: (id, amount, method, tip) => TakoAPI.post(`/bills/${id}/payments`, tip ? { amount, method, tip } : { amount, method }),
  // chiamate cameriere
  waiterResolve: (tableId) => TakoAPI.post(`/tables/${tableId}/waiter-resolve`),
  // AI (Groq)
  menuImportText: (menuId, text) => TakoAPI.post(`/menus/${menuId}/import-text`, { text }),
  menuImportConfirm: (menuId, sections) => TakoAPI.post(`/menus/${menuId}/import-confirm`, { sections }),
  statsRange: async (days = 7) => {
    const to = new Date(); const from = new Date(Date.now() - (days - 1) * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    return TakoAPI.get(`/stats/dashboard?from=${iso(from)}&to=${iso(to)}`);
  },
  insightsAi: async (days = 30) => {
    const d = await TakoAPI.get(`/insights/menu?days=${days}`);
    if (!d.items || !d.items.length) return { suggestions: [] };
    return TakoAPI.post(`/insights/menu/ai`, { items: d.items, periodDays: d.periodDays ?? days, totalRevenue: d.totalRevenue ?? 0 });
  },
  // sessione
  logout: () => TakoAPI.post(`/auth/logout`),
  // stampa di prova
  printTest: () => TakoAPI.post(`/print/test`, {}),
};

/* espone helper + funzioni (i dati _ORDERS/_ROOMS/_BILLS sono props piane via syncGlobals) */
Object.assign(window, {
  TakoAPI, TakoActions, loadAll, syncGlobals, connectSocket,
  ORD_UI2DB, ITEM_UI2DB, TBL_UI2DB, ROLE_DB2UI, ROLE_UI2DB, CALL_TYPE_LABEL,
  mapOrder, mapRoom, mapBill, mapInventory, mapStaff, minsSince,
});
