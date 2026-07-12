'use client'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'

// i18n lato client per la PWA cliente. SOLO il display è tradotto: i nomi canonici
// italiani dei piatti restano nel carrello/ordine inviato al backend (la traduzione
// dei nomi/descrizioni piatto arriva a parte da /customer/menu-translations e viene
// applicata solo per il display in MenuView).

export type Lang = 'it' | 'en' | 'es' | 'de'
const SUPPORTED: Lang[] = ['it', 'en', 'es', 'de']
const LANG_KEY = 'tako-lang'

// ── stringhe UI (chrome) — finali, dal design handoff ──
export const UI = {
  table:            { it: 'Tavolo', en: 'Table', es: 'Mesa', de: 'Tisch' },
  viewCart:         { it: 'Vedi carrello', en: 'View cart', es: 'Ver carrito', de: 'Warenkorb ansehen' },
  soldOut:          { it: 'Esaurito', en: 'Sold out', es: 'Agotado', de: 'Ausverkauft' },
  add:              { it: 'Aggiungi', en: 'Add', es: 'Añadir', de: 'Hinzufügen' },
  added:            { it: 'aggiunto', en: 'added', es: 'añadido', de: 'hinzugefügt' },
  allergens:        { it: 'Allergeni', en: 'Allergens', es: 'Alérgenos', de: 'Allergene' },
  choosePortion:    { it: 'Scegli la porzione', en: 'Choose your portion', es: 'Elige la ración', de: 'Portion wählen' },
  included:         { it: 'incluso', en: 'included', es: 'incluido', de: 'inklusive' },
  kitchenNotes:     { it: 'Note per la cucina', en: 'Notes for the kitchen', es: 'Notas para la cocina', de: 'Anmerkungen für die Küche' },
  notesPh:          { it: 'Es. senza cipolla, ben cotto…', en: 'e.g. no onion, well done…', es: 'Ej. sin cebolla, muy hecho…', de: 'z. B. ohne Zwiebel, gut durch…' },
  filterTitle:      { it: 'Filtra per allergeni', en: 'Filter by allergens', es: 'Filtrar por alérgenos', de: 'Nach Allergenen filtern' },
  filterSub:        { it: 'Nascondi i piatti che li contengono', en: 'Hide dishes that contain them', es: 'Oculta los platos que los contienen', de: 'Gerichte ausblenden, die sie enthalten' },
  reset:            { it: 'Azzera', en: 'Reset', es: 'Borrar', de: 'Zurücksetzen' },
  showDishes:       { it: 'Mostra piatti', en: 'Show dishes', es: 'Mostrar platos', de: 'Gerichte anzeigen' },
  done:             { it: 'Fatto', en: 'Done', es: 'Hecho', de: 'Fertig' },
  hidingWith:       { it: 'Nascondo i piatti con', en: 'Hiding dishes with', es: 'Ocultando platos con', de: 'Blende Gerichte aus mit' },
  yourOrder:        { it: 'Il tuo ordine', en: 'Your order', es: 'Tu pedido', de: 'Deine Bestellung' },
  cartEmpty:        { it: 'Il carrello è vuoto', en: 'Your cart is empty', es: 'Tu carrito está vacío', de: 'Dein Warenkorb ist leer' },
  cartEmptySub:     { it: 'Aggiungi qualcosa di buono dal menù.', en: 'Add something tasty from the menu.', es: 'Añade algo rico del menú.', de: 'Füge etwas Leckeres aus dem Menü hinzu.' },
  backToMenu:       { it: 'Torna al menù', en: 'Back to menu', es: 'Volver al menú', de: 'Zurück zum Menü' },
  orderNotesPh:     { it: "Note per tutto l'ordine (es. portate insieme)", en: 'Notes for the whole order (e.g. bring together)', es: 'Notas para todo el pedido (ej. traer junto)', de: 'Anmerkungen zur Bestellung (z. B. zusammen servieren)' },
  total:            { it: 'Totale', en: 'Total', es: 'Total', de: 'Gesamt' },
  confirmOrder:     { it: 'Conferma ordine', en: 'Confirm order', es: 'Confirmar pedido', de: 'Bestellung bestätigen' },
  sending:          { it: 'Invio…', en: 'Sending…', es: 'Enviando…', de: 'Senden…' },
  navMenu:          { it: 'Menù', en: 'Menu', es: 'Menú', de: 'Menü' },
  navOrder:         { it: 'Ordine', en: 'Order', es: 'Pedido', de: 'Bestellung' },
  navAssistant:     { it: 'Assistente', en: 'Assistant', es: 'Asistente', de: 'Assistent' },
  hdrWaiter:        { it: 'Cameriere', en: 'Waiter', es: 'Camarero', de: 'Kellner' },
  hdrCart:          { it: 'Carrello', en: 'Cart', es: 'Carrito', de: 'Warenkorb' },
  noActiveOrder:    { it: 'Nessun ordine attivo', en: 'No active order', es: 'Sin pedidos activos', de: 'Keine aktive Bestellung' },
  noActiveOrderSub: { it: 'Quando ordini, qui segui tutto in tempo reale.', en: 'Once you order, follow everything here in real time.', es: 'Cuando pidas, sigue todo aquí en tiempo real.', de: 'Sobald du bestellst, verfolgst du hier alles in Echtzeit.' },
  goToMenu:         { it: 'Vai al menù', en: 'Go to menu', es: 'Ir al menú', de: 'Zum Menü' },
  orderWord:        { it: 'Ordine', en: 'Order', es: 'Pedido', de: 'Bestellung' },
  summary:          { it: 'Riepilogo', en: 'Summary', es: 'Resumen', de: 'Übersicht' },
  notePre:          { it: 'Nota:', en: 'Note:', es: 'Nota:', de: 'Notiz:' },
  addMore:          { it: 'Aggiungi altro', en: 'Add more', es: 'Añadir más', de: 'Mehr hinzufügen' },
  language:         { it: 'Lingua', en: 'Language', es: 'Idioma', de: 'Sprache' },
  languageSub:      { it: 'Scegli la lingua del menù', en: 'Choose your menu language', es: 'Elige el idioma del menú', de: 'Sprache des Menüs wählen' },
  callWaiter:       { it: 'Chiama il cameriere', en: 'Call the waiter', es: 'Llamar al camarero', de: 'Kellner rufen' },
  waiterDone:       { it: 'Fatto!', en: 'Done!', es: '¡Hecho!', de: 'Fertig!' },
  waiterComing:     { it: 'arriviamo subito al tavolo', en: "we'll be right at table", es: 'llegamos enseguida a la mesa', de: 'wir kommen sofort an Tisch' },
  waiterHelp:       { it: 'Ho bisogno di aiuto', en: 'I need help', es: 'Necesito ayuda', de: 'Ich brauche Hilfe' },
  waiterHelpSub:    { it: 'Un cameriere arriva al tavolo', en: 'A waiter will come to your table', es: 'Un camarero vendrá a la mesa', de: 'Ein Kellner kommt an den Tisch' },
  waiterBill:       { it: 'Vorrei il conto', en: "I'd like the bill", es: 'Quiero la cuenta', de: 'Die Rechnung, bitte' },
  waiterBillSub:    { it: 'Prepariamo il conto del tavolo', en: "We'll prepare the table's bill", es: 'Preparamos la cuenta de la mesa', de: 'Wir bereiten die Rechnung vor' },
  waiterWater:      { it: 'Acqua, per favore', en: 'Water, please', es: 'Agua, por favor', de: 'Wasser, bitte' },
  waiterWaterSub:   { it: "Portiamo dell'acqua", en: "We'll bring some water", es: 'Traemos agua', de: 'Wir bringen Wasser' },
  toastOrderSent:   { it: 'Ordine inviato in cucina!', en: 'Order sent to the kitchen!', es: '¡Pedido enviado a la cocina!', de: 'Bestellung an die Küche gesendet!' },
  toastOrderReady:  { it: 'Il tuo ordine è pronto! 🛎️', en: 'Your order is ready! 🛎️', es: '¡Tu pedido está listo! 🛎️', de: 'Deine Bestellung ist fertig! 🛎️' },
  toastWaiter:      { it: 'Cameriere avvisato! 🔔', en: 'Waiter notified! 🔔', es: '¡Camarero avisado! 🔔', de: 'Kellner benachrichtigt! 🔔' },
  waiterError:      { it: 'Impossibile chiamare il cameriere. Riprova.', en: 'Could not call the waiter. Try again.', es: 'No se pudo llamar al camarero. Inténtalo de nuevo.', de: 'Kellner konnte nicht gerufen werden. Erneut versuchen.' },
  orderError:       { it: "Errore nell'invio. Riprova.", en: 'Sending failed. Try again.', es: 'Error al enviar. Inténtalo de nuevo.', de: 'Senden fehlgeschlagen. Erneut versuchen.' },
  orderItemsUnavailable: { it: 'Alcuni piatti non sono più disponibili: aggiorna il carrello.', en: 'Some dishes are no longer available: update your cart.', es: 'Algunos platos ya no están disponibles: actualiza el carrito.', de: 'Einige Gerichte sind nicht mehr verfügbar: Warenkorb aktualisieren.' },
  // chat
  chatOnline:       { it: 'online · risponde subito', en: 'online · replies instantly', es: 'en línea · responde al instante', de: 'online · antwortet sofort' },
  chatPlaceholder:  { it: 'Scrivi un messaggio…', en: 'Write a message…', es: 'Escribe un mensaje…', de: 'Nachricht schreiben…' },
  chatError:        { it: 'Scusa, ho avuto un intoppo. Riprova tra un attimo.', en: 'Sorry, something went wrong. Try again in a moment.', es: 'Perdona, algo salió mal. Inténtalo en un momento.', de: 'Entschuldigung, etwas ist schiefgelaufen. Versuche es gleich erneut.' },
  addedToCart:      { it: 'Aggiunto al carrello', en: 'Added to cart', es: 'Añadido al carrito', de: 'Zum Warenkorb hinzugefügt' },
  orderSent:        { it: 'Ordine inviato!', en: 'Order sent!', es: '¡Pedido enviado!', de: 'Bestellung gesendet!' },
  trackOrder:       { it: 'Traccia ordine', en: 'Track order', es: 'Seguir pedido', de: 'Bestellung verfolgen' },
  waiterNotified:   { it: 'Il cameriere è stato avvisato.', en: 'The waiter has been notified.', es: 'El camarero ha sido avisado.', de: 'Der Kellner wurde benachrichtigt.' },
} as const

export type UIKey = keyof typeof UI

// ── tag piatti ──
const TAG: Record<string, Record<Lang, string>> = {
  'Vegetariano':    { it: 'Vegetariano', en: 'Vegetarian', es: 'Vegetariano', de: 'Vegetarisch' },
  'Consigliato':    { it: 'Consigliato', en: 'Recommended', es: 'Recomendado', de: 'Empfohlen' },
  'Da condividere': { it: 'Da condividere', en: 'To share', es: 'Para compartir', de: 'Zum Teilen' },
  'Novità':         { it: 'Novità', en: 'New', es: 'Novedad', de: 'Neu' },
  'Piccante':       { it: 'Piccante', en: 'Spicy', es: 'Picante', de: 'Scharf' },
}

// ── etichette allergeni ──
const ALLG: Record<string, Record<Lang, string>> = {
  glutine:   { it: 'Glutine', en: 'Gluten', es: 'Gluten', de: 'Gluten' },
  latte:     { it: 'Latte', en: 'Milk', es: 'Leche', de: 'Milch' },
  uova:      { it: 'Uova', en: 'Eggs', es: 'Huevos', de: 'Eier' },
  pesce:     { it: 'Pesce', en: 'Fish', es: 'Pescado', de: 'Fisch' },
  molluschi: { it: 'Molluschi', en: 'Molluscs', es: 'Moluscos', de: 'Weichtiere' },
  arachidi:  { it: 'Arachidi', en: 'Peanuts', es: 'Cacahuetes', de: 'Erdnüsse' },
  soia:      { it: 'Soia', en: 'Soy', es: 'Soja', de: 'Soja' },
  noci:      { it: 'Frutta a guscio', en: 'Tree nuts', es: 'Frutos secos', de: 'Schalenfrüchte' },
  sedano:    { it: 'Sedano', en: 'Celery', es: 'Apio', de: 'Sellerie' },
  senape:    { it: 'Senape', en: 'Mustard', es: 'Mostaza', de: 'Senf' },
  sesamo:    { it: 'Sesamo', en: 'Sesame', es: 'Sésamo', de: 'Sesam' },
  lupini:    { it: 'Lupini', en: 'Lupin', es: 'Altramuces', de: 'Lupinen' },
}

// ── step di tracking (id semantico → status backend + label/desc tradotti) ──
export const ORDER_STEPS: { id: string; status: string[]; label: Record<Lang, string>; desc: Record<Lang, string> }[] = [
  { id: 'ricevuto',   status: ['pending'],           label: { it: 'Ricevuto', en: 'Received', es: 'Recibido', de: 'Erhalten' },              desc: { it: 'Tako ha ricevuto il tuo ordine', en: 'We received your order', es: 'Hemos recibido tu pedido', de: 'Wir haben deine Bestellung erhalten' } },
  { id: 'confermato', status: ['confirmed'],         label: { it: 'Confermato', en: 'Confirmed', es: 'Confirmado', de: 'Bestätigt' },        desc: { it: 'Il ristorante ha confermato', en: 'The restaurant confirmed it', es: 'El restaurante lo ha confirmado', de: 'Das Restaurant hat sie bestätigt' } },
  { id: 'in_cucina',  status: ['preparing'],         label: { it: 'In cucina', en: 'In the kitchen', es: 'En cocina', de: 'In der Küche' }, desc: { it: 'Lo chef sta preparando', en: 'Your dishes are being prepared', es: 'Tus platos se están preparando', de: 'Deine Gerichte werden zubereitet' } },
  { id: 'pronto',     status: ['ready'],             label: { it: 'Pronto', en: 'Ready', es: 'Listo', de: 'Fertig' },                        desc: { it: 'In arrivo al tuo tavolo', en: 'Your order is ready', es: 'Tu pedido está listo', de: 'Deine Bestellung ist fertig' } },
  { id: 'servito',    status: ['served', 'paid'],    label: { it: 'Servito', en: 'Served', es: 'Servido', de: 'Serviert' },                  desc: { it: 'Buon appetito!', en: 'Enjoy your meal!', es: '¡Buen provecho!', de: 'Guten Appetit!' } },
]

export function stepIndexForStatus(status?: string | null): number {
  if (!status) return 0
  const i = ORDER_STEPS.findIndex(s => s.status.includes(status))
  return i < 0 ? 0 : i
}

const coerce = (lang: string): Lang => (SUPPORTED.includes(lang as Lang) ? (lang as Lang) : 'it')

export function trTag(tag: string, lang: string): string {
  const e = TAG[tag]
  return e ? e[coerce(lang)] : tag
}
export function trAllergen(id: string, lang: string, fallback: string): string {
  const e = ALLG[id.toLowerCase()]
  return e ? e[coerce(lang)] : fallback
}
export function trStep(id: string, lang: string): { label: string; desc: string } {
  const s = ORDER_STEPS.find(x => x.id === id)
  const l = coerce(lang)
  return s ? { label: s.label[l], desc: s.desc[l] } : { label: id, desc: '' }
}

interface I18nCtx {
  lang: string
  setLang: (l: string) => void
  languages: string[]
  defaultLang: string
  t: (key: UIKey) => string
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ restaurantId, children }: { restaurantId: string | null; children: ReactNode }) {
  const [languages, setLanguages] = useState<string[]>(['it'])
  const [defaultLang, setDefaultLang] = useState('it')
  const [lang, setLangState] = useState<string>('it')

  // Carica le lingue del ristorante e sceglie la lingua iniziale (salvata se valida, altrimenti default).
  useEffect(() => {
    if (!restaurantId) return
    api.get(`/customer/menu-languages?restaurantId=${restaurantId}`).then(r => {
      const langs: string[] = (r.data.data.languages ?? ['it']).map((l: string) => String(l).toLowerCase())
      const def: string = String(r.data.data.defaultLanguage ?? langs[0] ?? 'it').toLowerCase()
      setLanguages(langs.length ? langs : ['it'])
      setDefaultLang(def)
      const saved = typeof window !== 'undefined' ? localStorage.getItem(LANG_KEY)?.toLowerCase() : null
      setLangState(saved && langs.includes(saved) ? saved : def)
    }).catch(() => { setLanguages(['it']); setDefaultLang('it'); setLangState('it') })
  }, [restaurantId])

  const setLang = (l: string) => {
    const next = l.toLowerCase()
    setLangState(next)
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, next)
  }

  const value = useMemo<I18nCtx>(() => ({
    lang, setLang, languages, defaultLang,
    t: (key: UIKey) => UI[key][coerce(lang)],
  }), [lang, languages, defaultLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n must be used within I18nProvider')
  return c
}
