/* ───────────────────────── Tako Dashboard — dati demo ─────────────────────────
   Trattoria da Mario · Milano. Dati realistici, nessun lorem ipsum. */

const RESTAURANT = {
  name: "Trattoria da Mario",
  city: "Milano",
  vat: "IT 0294 8571 209",
  brand: "#ED7159",
};

const ROLES = {
  owner:    { label: "Titolare",  name: "Mario Rossi",      initials: "MR" },
  cameriere:{ label: "Cameriere", name: "Giulia Ferri",     initials: "GF" },
  chef:     { label: "Chef",      name: "Antonio Esposito", initials: "AE" },
  cassiere: { label: "Cassiere",  name: "Sara Bianchi",     initials: "SB" },
};

/* KPI di giornata */
const KPI = {
  incasso: 2847.50,
  ordiniAttivi: 12,
  ticketMedio: 33.10,
  coperti: 86,
  conti: 24,
  inAttesa: 3,
};

/* andamento 7 giorni (incasso €) */
const WEEK = [
  { g: "Lun", v: 1980 },
  { g: "Mar", v: 2240 },
  { g: "Mer", v: 2090 },
  { g: "Gio", v: 2670 },
  { g: "Ven", v: 3420 },
  { g: "Sab", v: 3980 },
  { g: "Dom", v: 2847 },
];

/* onboarding 5 step */
const SETUP = [
  { k: "Dati ristorante", done: true },
  { k: "Tavoli",          done: true },
  { k: "Menu",            done: true },
  { k: "QR Code",         done: false },
  { k: "Team",            done: false },
];

/* stazioni cucina */
const STATIONS = ["Cucina", "Griglia", "Pizzeria", "Bar"];

/* stati ordine */
const ORDER_STATUS = {
  attesa:     { label: "In attesa",      tone: "wait" },
  confermato: { label: "Confermato",     tone: "info" },
  prep:       { label: "In preparazione",tone: "brand" },
  pronto:     { label: "Pronto",         tone: "ok" },
  servito:    { label: "Servito",        tone: "muted" },
  pagato:     { label: "Pagato",         tone: "okDeep" },
  annullato:  { label: "Annullato",      tone: "danger" },
};

/* ordini live */
const ORDERS = [
  { id: "T05-241", tavolo: 5, tipo: "tavolo", stato: "prep", orario: "20:42", min: 8, note: "Tavolo con bambini",
    items: [
      { nome: "Tonnarelli cacio e pepe", qty: 2, prezzo: 13, station: "Cucina", note: "1 senza pepe", stato: "prep" },
      { nome: "Polpo alla griglia", qty: 1, prezzo: 16, station: "Griglia", note: "", stato: "prep" },
      { nome: "Acqua naturale 1L", qty: 2, prezzo: 3, station: "Bar", note: "", stato: "pronto" },
    ] },
  { id: "T11-242", tavolo: 11, tipo: "tavolo", stato: "attesa", orario: "20:46", min: 2, note: "",
    items: [
      { nome: "Pizza Margherita", qty: 3, prezzo: 8, station: "Pizzeria", note: "1 senza basilico", stato: "attesa" },
      { nome: "Pizza Diavola", qty: 1, prezzo: 10, station: "Pizzeria", note: "", stato: "attesa" },
      { nome: "Birra Moretti 0.4", qty: 4, prezzo: 5, station: "Bar", note: "", stato: "attesa" },
    ] },
  { id: "T02-240", tavolo: 2, tipo: "tavolo", stato: "pronto", orario: "20:35", min: 15, note: "",
    items: [
      { nome: "Risotto agli scampi", qty: 2, prezzo: 18, station: "Cucina", note: "", stato: "pronto" },
      { nome: "Tagliata di manzo", qty: 1, prezzo: 22, station: "Griglia", note: "Al sangue", stato: "pronto" },
    ] },
  { id: "T08-239", tavolo: 8, tipo: "tavolo", stato: "confermato", orario: "20:31", min: 19, note: "Anniversario",
    items: [
      { nome: "Antipasto di mare", qty: 1, prezzo: 19, station: "Cucina", note: "", stato: "prep" },
      { nome: "Spaghetti alle vongole", qty: 2, prezzo: 15, station: "Cucina", note: "", stato: "attesa" },
      { nome: "Vino Vermentino", qty: 1, prezzo: 24, station: "Bar", note: "", stato: "pronto" },
    ] },
  { id: "AS-238", tavolo: null, tipo: "asporto", stato: "prep", orario: "20:28", min: 22, note: "Ritiro 21:00 — Luca",
    items: [
      { nome: "Pizza Capricciosa", qty: 2, prezzo: 11, station: "Pizzeria", note: "", stato: "prep" },
      { nome: "Tiramisù", qty: 2, prezzo: 6, station: "Cucina", note: "", stato: "attesa" },
    ] },
  { id: "T14-237", tavolo: 14, tipo: "tavolo", stato: "servito", orario: "20:05", min: 45, note: "",
    items: [
      { nome: "Lasagna al forno", qty: 4, prezzo: 12, station: "Cucina", note: "", stato: "servito" },
      { nome: "Acqua frizzante 1L", qty: 2, prezzo: 3, station: "Bar", note: "", stato: "servito" },
    ] },
];

/* sale e tavoli (mappa) */
const ROOMS = [
  { id: "interna", nome: "Sala interna", tables: [
    { n: 1, posti: 2, stato: "libero",    x: 8,  y: 12 },
    { n: 2, posti: 4, stato: "pronto",    x: 32, y: 12 },
    { n: 3, posti: 4, stato: "occupato",  x: 56, y: 12 },
    { n: 4, posti: 6, stato: "occupato",  x: 80, y: 12 },
    { n: 5, posti: 4, stato: "occupato",  x: 8,  y: 46 },
    { n: 6, posti: 2, stato: "pulizia",   x: 32, y: 46 },
    { n: 7, posti: 4, stato: "libero",    x: 56, y: 46 },
    { n: 8, posti: 6, stato: "attesa",    x: 80, y: 46 },
    { n: 9, posti: 2, stato: "prenotato", x: 20, y: 80 },
    { n: 10,posti: 4, stato: "libero",    x: 50, y: 80 },
  ]},
  { id: "dehors", nome: "Dehors", tables: [
    { n: 11, posti: 4, stato: "occupato",  x: 12, y: 22 },
    { n: 12, posti: 4, stato: "libero",    x: 44, y: 22 },
    { n: 13, posti: 2, stato: "libero",    x: 76, y: 22 },
    { n: 14, posti: 6, stato: "occupato",  x: 28, y: 64 },
    { n: 15, posti: 2, stato: "prenotato", x: 64, y: 64 },
  ]},
];

const TABLE_STATUS = {
  libero:    { label: "Libero",     color: "var(--st-free)" },
  occupato:  { label: "Occupato",   color: "var(--st-busy)" },
  attesa:    { label: "In attesa",  color: "var(--st-wait)" },
  pronto:    { label: "Pronto",     color: "var(--st-ready)" },
  pulizia:   { label: "Pulizia",    color: "var(--st-clean)" },
  prenotato: { label: "Prenotato",  color: "var(--st-resv)" },
};

/* chiamate cameriere da risolvere */
const WAITER_CALLS = [
  { tavolo: 3, motivo: "Chiede il conto", min: 2 },
  { tavolo: 8, motivo: "Acqua e pane",     min: 5 },
];

/* conti aperti (cassa) */
const BILLS = [
  { id: "C-024", tavolo: 3,  coperti: 4, subtotale: 78,  apertura: "19:40" },
  { id: "C-021", tavolo: 5,  coperti: 4, subtotale: 51,  apertura: "20:10" },
  { id: "C-019", tavolo: 4,  coperti: 6, subtotale: 142, apertura: "19:25" },
  { id: "C-018", tavolo: 11, coperti: 4, subtotale: 63,  apertura: "20:20" },
];
const CASSA_OGGI = { incasso: 2847.50, mance: 184, conti: 24, ticket: 33.10 };

/* menu → sezioni → piatti */
const MENU = [
  { sezione: "Antipasti", piatti: [
    { nome: "Antipasto di mare", prezzo: 19, costo: 7.2, disp: true,  station: "Cucina", tag: ["Pesce"], alg: ["crostacei","pesce"], desc: "Polpo, gamberi, cozze e vongole." },
    { nome: "Tagliere misto",    prezzo: 16, costo: 5.8, disp: true,  station: "Cucina", tag: [], alg: ["latte","glutine"], desc: "Salumi e formaggi del territorio." },
    { nome: "Burrata pugliese",  prezzo: 12, costo: 4.1, disp: false, station: "Cucina", tag: ["Veg"], alg: ["latte"], desc: "Burrata, pomodorini, basilico." },
  ]},
  { sezione: "Primi", piatti: [
    { nome: "Tonnarelli cacio e pepe", prezzo: 13, costo: 3.2, disp: true, station: "Cucina", tag: ["Top"], alg: ["latte","glutine","uova"], desc: "Pasta fresca, pecorino, pepe." },
    { nome: "Spaghetti alle vongole",  prezzo: 15, costo: 5.0, disp: true, station: "Cucina", tag: ["Pesce"], alg: ["glutine","molluschi"], desc: "Vongole veraci, aglio, prezzemolo." },
    { nome: "Risotto agli scampi",     prezzo: 18, costo: 6.4, disp: true, station: "Cucina", tag: ["Pesce"], alg: ["crostacei"], desc: "Carnaroli, scampi, zafferano." },
    { nome: "Lasagna al forno",        prezzo: 12, costo: 3.5, disp: true, station: "Cucina", tag: [], alg: ["latte","glutine","uova"], desc: "Ragù di carne, besciamella." },
  ]},
  { sezione: "Pizze", piatti: [
    { nome: "Pizza Margherita",  prezzo: 8,  costo: 2.1, disp: true, station: "Pizzeria", tag: ["Veg"], alg: ["latte","glutine"], desc: "Pomodoro, mozzarella, basilico." },
    { nome: "Pizza Diavola",     prezzo: 10, costo: 2.8, disp: true, station: "Pizzeria", tag: ["Piccante"], alg: ["latte","glutine"], desc: "Salame piccante." },
    { nome: "Pizza Capricciosa", prezzo: 11, costo: 3.3, disp: true, station: "Pizzeria", tag: [], alg: ["latte","glutine"], desc: "Prosciutto, funghi, carciofi, olive." },
  ]},
  { sezione: "Secondi", piatti: [
    { nome: "Polpo alla griglia", prezzo: 16, costo: 6.0, disp: true, station: "Griglia", tag: ["Pesce","Top"], alg: ["molluschi"], desc: "Polpo, patate, olive taggiasche." },
    { nome: "Tagliata di manzo",  prezzo: 22, costo: 9.5, disp: true, station: "Griglia", tag: [], alg: [], desc: "Controfiletto, rucola, grana." },
  ]},
  { sezione: "Dolci", piatti: [
    { nome: "Tiramisù",     prezzo: 6, costo: 1.4, disp: true,  station: "Cucina", tag: ["Top"], alg: ["latte","glutine","uova"], desc: "Mascarpone, savoiardi, caffè." },
    { nome: "Panna cotta",  prezzo: 5, costo: 1.1, disp: true,  station: "Cucina", tag: [], alg: ["latte"], desc: "Ai frutti di bosco." },
  ]},
];

/* menu engineering — quadranti */
const ENGINEERING = [
  { nome: "Tonnarelli cacio e pepe", vol: 142, margine: 75, cls: "star" },
  { nome: "Tiramisù",                vol: 128, margine: 77, cls: "star" },
  { nome: "Polpo alla griglia",      vol: 64,  margine: 62, cls: "puzzle" },
  { nome: "Risotto agli scampi",     vol: 38,  margine: 64, cls: "puzzle" },
  { nome: "Pizza Margherita",        vol: 156, margine: 49, cls: "plow" },
  { nome: "Lasagna al forno",        vol: 118, margine: 41, cls: "plow" },
  { nome: "Burrata pugliese",        vol: 22,  margine: 34, cls: "dog" },
  { nome: "Panna cotta",             vol: 31,  margine: 38, cls: "dog" },
];

/* inventario */
const INVENTORY = [
  { nome: "Mozzarella fior di latte", unita: "kg", giac: 2.4,  min: 5,  costo: 7.5,  forn: "Caseificio Sud" },
  { nome: "Pomodoro San Marzano",     unita: "kg", giac: 18,   min: 8,  costo: 2.2,  forn: "Ortofrutta Po" },
  { nome: "Farina 00",                unita: "kg", giac: 35,   min: 15, costo: 0.9,  forn: "Molino Rossi" },
  { nome: "Polpo fresco",             unita: "kg", giac: 1.2,  min: 3,  costo: 16,   forn: "Pescheria Blu" },
  { nome: "Guanciale",                unita: "kg", giac: 0.8,  min: 2,  costo: 14,   forn: "Norcineria Lazio" },
  { nome: "Vino Vermentino",          unita: "bot",giac: 9,    min: 6,  costo: 8,    forn: "Cantina Sarda" },
];

/* staff */
const STAFF = [
  { nome: "Mario Rossi",      email: "mario@trattoria.it",   ruolo: "owner",     tel: "335 1122334", attivo: true,  online: true },
  { nome: "Giulia Ferri",     email: "giulia@trattoria.it",  ruolo: "cameriere", tel: "340 9988776", attivo: true,  online: true },
  { nome: "Antonio Esposito", email: "antonio@trattoria.it", ruolo: "chef",      tel: "333 4455667", attivo: true,  online: true },
  { nome: "Sara Bianchi",     email: "sara@trattoria.it",    ruolo: "cassiere",  tel: "347 7766554", attivo: true,  online: false },
  { nome: "Luca Verdi",       email: "luca@trattoria.it",    ruolo: "cameriere", tel: "320 1239876", attivo: false, online: false },
];

/* palette brand selezionabili */
const BRAND_PALETTES = {
  arancione: { label: "Arancione", brand: "#ED7159", deep: "#D9533A", tint: "#FCE7DF", wash: "#FBF1ED", on: "#FFFFFF" },
  blu:       { label: "Blu",       brand: "#3E7BD0", deep: "#2C5FA8", tint: "#E4ECF9", wash: "#EFF4FB", on: "#FFFFFF" },
  giallo:    { label: "Giallo",    brand: "#F0B429", deep: "#CE9410", tint: "#FBF0D2", wash: "#FBF7EA", on: "#2A1F1A" },
  verde:     { label: "Verde",     brand: "#4FA980", deep: "#2F7D58", tint: "#E1F1E9", wash: "#EEF6F1", on: "#FFFFFF" },
  rosa:      { label: "Rosa",      brand: "#E86FA6", deep: "#C9497F", tint: "#FBE4EF", wash: "#FBF0F6", on: "#FFFFFF" },
};

/* statistiche extra */
const PEAK_HOURS = [
  { h: "12", v: 18 }, { h: "13", v: 42 }, { h: "14", v: 26 }, { h: "19", v: 31 },
  { h: "20", v: 68 }, { h: "21", v: 54 }, { h: "22", v: 22 },
];
const TOP_DISHES = [
  { nome: "Pizza Margherita", n: 156 },
  { nome: "Tonnarelli cacio e pepe", n: 142 },
  { nome: "Tiramisù", n: 128 },
  { nome: "Lasagna al forno", n: 118 },
];
const QR_ANALYTICS = { scansioni: 312, conversione: 71, tempoPrimo: "2m 40s" };

/* simbolo valuta mutabile (letto da euro() ovunque) */
const CUR = { sym: "€" };
const CURRENCIES = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF " };

/* impostazioni personalizzabili dal proprietario */
const SETTINGS_DEFAULTS = {
  // identità
  nome: "Trattoria da Mario", indirizzo: "Via Roma 12, Milano", telefono: "02 1234567",
  // servizio
  servizioTavolo: true, asporto: true, pagaTavolo: true, ai: true, prenotazioni: false,
  copertoOn: true, coperto: 2, manceSuggerite: true,
  // ordini & cucina
  suoniOrdini: true, autoConferma: false, stampaAuto: true,
  kdsWarn: 10, kdsLate: 15, kdsCompatta: false,
  // dashboard
  mostraOnboarding: true, kpi: { incasso: true, ordini: true, ticket: true, coperti: true },
  // generali
  valuta: "EUR", iva: 10, fuso: "Europe/Rome", lingue: ["IT", "EN", "FR"], linguaDefault: "IT",
  // stampante
  printerIp: "192.168.1.50", printerPort: "9100",
};

Object.assign(window, {
  RESTAURANT, ROLES, KPI, WEEK, SETUP, STATIONS, ORDER_STATUS, ORDERS, ROOMS, TABLE_STATUS,
  WAITER_CALLS, BILLS, CASSA_OGGI, MENU, ENGINEERING, INVENTORY, STAFF, PEAK_HOURS, TOP_DISHES, QR_ANALYTICS,
  BRAND_PALETTES, CUR, CURRENCIES, SETTINGS_DEFAULTS,
});
