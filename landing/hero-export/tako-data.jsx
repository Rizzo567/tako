// tako-data.jsx — mock data, currency, allergens, stores (cart/session/order), order simulation
// Mirrors the real Tako data contracts (Zustand stores + /api endpoints) with mocked data.

const { useSyncExternalStore, useEffect: useFx } = React;

/* ───────────────── currency ───────────────── */
const _eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const eur = (v) => _eur.format(v || 0);

/* ───────────────── allergens (EU) ───────────────── */
const ALLERGENS = [
  { id: 'glutine',   label: 'Glutine',   emoji: '🌾' },
  { id: 'latte',     label: 'Latte',     emoji: '🥛' },
  { id: 'uova',      label: 'Uova',      emoji: '🥚' },
  { id: 'pesce',     label: 'Pesce',     emoji: '🐟' },
  { id: 'molluschi', label: 'Molluschi', emoji: '🦪' },
  { id: 'arachidi',  label: 'Arachidi',  emoji: '🥜' },
  { id: 'soia',      label: 'Soia',      emoji: '🫛' },
  { id: 'noci',      label: 'Frutta a guscio', emoji: '🌰' },
  { id: 'sedano',    label: 'Sedano',    emoji: '🥬' },
  { id: 'senape',    label: 'Senape',    emoji: '🌭' },
  { id: 'sesamo',    label: 'Sesamo',    emoji: '⚪' },
  { id: 'lupini',    label: 'Lupini',    emoji: '🫘' },
];
const ALLERGEN_MAP = Object.fromEntries(ALLERGENS.map(a => [a.id, a]));

/* dish placeholder tile colour, derived from name (premium monogram look) */
const DISH_HUES = [18, 32, 8, 150, 200, 42, 0];
function dishStyle(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = DISH_HUES[h % DISH_HUES.length];
  return {
    background: `linear-gradient(150deg, hsl(${hue} 46% 62%), hsl(${(hue + 24) % 360} 52% 47%))`,
  };
}

/* ───────────────── menu (GET /customer/restaurant/{id}/menu) ───────────────── */
const MENU = [
  { id: 'antipasti', name: 'Antipasti', items: [
    { id: 'i1', name: 'Bruschette al pomodoro', desc: 'Pane casereccio tostato, pomodorini, basilico e olio EVO.', price: 7.0, allergens: ['glutine'], tags: ['Vegetariano'], available: true,
      variants: [{ id: 'v1', name: 'Da 4', delta: 0 }, { id: 'v2', name: 'Da 8 · da condividere', delta: 4.0 }] },
    { id: 'i2', name: 'Polpette al sugo', desc: 'Polpette di manzo nel nostro ragù lento, servite con crostini.', price: 9.5, allergens: ['glutine', 'uova', 'latte'], tags: ['Consigliato'], available: true },
    { id: 'i3', name: 'Burrata e prosciutto', desc: 'Burrata pugliese, prosciutto crudo 18 mesi, focaccia.', price: 12.0, allergens: ['latte', 'glutine'], tags: [], available: true },
    { id: 'i4', name: 'Tagliere del Mauro', desc: 'Selezione di salumi e formaggi locali, miele e composte.', price: 16.0, allergens: ['latte'], tags: ['Da condividere'], available: false },
  ]},
  { id: 'primi', name: 'Primi', items: [
    { id: 'i5', name: 'Spaghetti alle vongole', desc: 'Spaghetti di Gragnano, vongole veraci, aglio, prezzemolo.', price: 15.0, allergens: ['glutine', 'molluschi'], tags: ['Consigliato'], available: true },
    { id: 'i6', name: 'Risotto ai funghi porcini', desc: 'Carnaroli mantecato, porcini freschi, Parmigiano 24 mesi.', price: 13.0, allergens: ['latte'], tags: ['Vegetariano'], available: true },
    { id: 'i7', name: 'Lasagna della nonna', desc: 'Sfoglia all\u2019uovo, ragù di carne, besciamella. Come a casa.', price: 12.0, allergens: ['glutine', 'latte', 'uova', 'sedano'], tags: ['Novità'], available: true },
    { id: 'i8', name: 'Gnocchi al pesto', desc: 'Gnocchi di patate, pesto genovese, fagiolini e patate.', price: 11.5, allergens: ['glutine', 'latte', 'noci'], tags: ['Vegetariano'], available: true },
  ]},
  { id: 'pizze', name: 'Pizze', items: [
    { id: 'i9', name: 'Margherita', desc: 'Pomodoro San Marzano, fiordilatte, basilico, olio EVO.', price: 8.0, allergens: ['glutine', 'latte'], tags: ['Vegetariano'], available: true,
      variants: [{ id: 'v1', name: 'Normale', delta: 0 }, { id: 'v2', name: 'Maxi', delta: 3.0 }] },
    { id: 'i10', name: 'Diavola', desc: 'Pomodoro, fiordilatte, salame piccante di Calabria.', price: 10.0, allergens: ['glutine', 'latte'], tags: ['Piccante'], available: true,
      variants: [{ id: 'v1', name: 'Normale', delta: 0 }, { id: 'v2', name: 'Maxi', delta: 3.0 }] },
    { id: 'i11', name: 'Quattro formaggi', desc: 'Fiordilatte, gorgonzola, fontina, Parmigiano.', price: 11.0, allergens: ['glutine', 'latte'], tags: ['Vegetariano'], available: false },
  ]},
  { id: 'dolci', name: 'Dolci', items: [
    { id: 'i12', name: 'Tiramisù', desc: 'La ricetta di famiglia: savoiardi, mascarpone, caffè.', price: 6.0, allergens: ['glutine', 'latte', 'uova'], tags: ['Consigliato'], available: true },
    { id: 'i13', name: 'Panna cotta ai frutti di bosco', desc: 'Panna cotta vellutata, coulis di frutti di bosco.', price: 5.5, allergens: ['latte'], tags: [], available: true },
  ]},
  { id: 'bevande', name: 'Bevande', items: [
    { id: 'i14', name: 'Acqua naturale', desc: 'Bottiglia 0,75 L.', price: 2.5, allergens: [], tags: [], available: true },
    { id: 'i15', name: 'Birra artigianale', desc: 'Bionda non filtrata del birrificio locale.', price: 5.0, allergens: ['glutine'], tags: [], available: true,
      variants: [{ id: 'v1', name: '0,33 L', delta: 0 }, { id: 'v2', name: '0,5 L', delta: 2.0 }] },
    { id: 'i16', name: 'Vino della casa', desc: 'Rosso o bianco, al calice.', price: 4.5, allergens: [], tags: [], available: true },
  ]},
];
const ALL_ITEMS = MENU.flatMap(s => s.items.map(it => ({ ...it, sectionId: s.id })));
const itemById = (id) => ALL_ITEMS.find(it => it.id === id);

/* ───────────────── order steps (Socket order:updated) ───────────────── */
const ORDER_STEPS = [
  { id: 'ricevuto',  label: 'Ricevuto',  desc: 'Abbiamo ricevuto il tuo ordine' },
  { id: 'confermato',label: 'Confermato', desc: 'Il ristorante lo ha confermato' },
  { id: 'in_cucina', label: 'In cucina',  desc: 'I tuoi piatti sono in preparazione' },
  { id: 'pronto',    label: 'Pronto',     desc: 'Il tuo ordine è pronto' },
  { id: 'servito',   label: 'Servito',    desc: 'Buon appetito!' },
];
const stepIndex = (id) => ORDER_STEPS.findIndex(s => s.id === id);

/* ───────────────── tiny external store ───────────────── */
function makeStore(key, initial) {
  let state;
  try { const raw = localStorage.getItem(key); state = raw ? { ...initial, ...JSON.parse(raw) } : { ...initial }; }
  catch (e) { state = { ...initial }; }
  const subs = new Set();
  const save = () => { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} };
  return {
    get: () => state,
    set: (patch) => { state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }; save(); subs.forEach(f => f()); },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}
function useStore(store) { return useSyncExternalStore(store.subscribe, store.get); }

/* session */
const sessionStore = makeStore('tako-session', {
  restaurantId: 'r1', restaurantName: 'Trattoria da Mauro',
  tableId: 't7', tableNumber: 7, sessionId: 'sess_demo',
  aiEnabled: true, primaryColor: '#ED7159',
});

/* cart */
const cartStore = makeStore('tako-cart', { items: [] });
const lineKey = (it) => `${it.menuItemId}::${it.variantId || '-'}::${(it.notes || '').trim().toLowerCase()}`;
const cart = {
  add(line) {
    const key = lineKey(line);
    cartStore.set(s => {
      const items = s.items.slice();
      const i = items.findIndex(x => x.key === key);
      if (i >= 0) items[i] = { ...items[i], quantity: items[i].quantity + line.quantity };
      else items.push({ ...line, key });
      return { items };
    });
  },
  remove(key) { cartStore.set(s => ({ items: s.items.filter(x => x.key !== key) })); },
  setQty(key, q) {
    if (q <= 0) return cart.remove(key);
    cartStore.set(s => ({ items: s.items.map(x => x.key === key ? { ...x, quantity: q } : x) }));
  },
  clear() { cartStore.set({ items: [] }); },
};
const cartTotal = (items) => items.reduce((t, x) => t + x.unitPrice * x.quantity, 0);
const cartCount = (items) => items.reduce((t, x) => t + x.quantity, 0);

/* order (tracking) */
const orderStore = makeStore('tako-order', { orderId: null, status: null, items: [], notes: '', placedAt: null });
let _orderTimer = null;
function placeOrder() {
  const items = cartStore.get().items.map(x => ({ ...x }));
  const notes = cartStore.get().orderNotes || '';
  const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  orderStore.set({ orderId, status: 'ricevuto', items, notes, placedAt: Date.now() });
  cart.clear();
  startOrderSim();
  return orderId;
}
// simulate Socket.io order:updated advancing the status
function startOrderSim() {
  clearInterval(_orderTimer);
  const STEP_MS = 6500;
  _orderTimer = setInterval(() => {
    const st = orderStore.get();
    const idx = stepIndex(st.status);
    if (idx < 0 || idx >= ORDER_STEPS.length - 1) { clearInterval(_orderTimer); return; }
    const next = ORDER_STEPS[idx + 1].id;
    orderStore.set({ status: next });
    window.dispatchEvent(new CustomEvent('tako:order-updated', { detail: { orderId: st.orderId, status: next } }));
    if (next === 'pronto') window.dispatchEvent(new CustomEvent('tako:order-ready', { detail: { orderId: st.orderId } }));
    if (next === 'servito') clearInterval(_orderTimer);
  }, STEP_MS);
}
// resume sim if a live order exists on reload
if (orderStore.get().orderId && stepIndex(orderStore.get().status) < ORDER_STEPS.length - 1) startOrderSim();

Object.assign(window, {
  eur, ALLERGENS, ALLERGEN_MAP, dishStyle,
  MENU, ALL_ITEMS, itemById,
  ORDER_STEPS, stepIndex,
  useStore, sessionStore, cartStore, cart, cartTotal, cartCount, lineKey,
  orderStore, placeOrder, startOrderSim,
});
