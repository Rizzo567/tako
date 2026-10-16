// Prezzo promo e scarsità («Ultime porzioni», «Solo oggi») — F3+F4 feature vendita 16/10/2026.
// Regole (decise da Manuel il 16/10):
// - la giornata del locale cambia alle 06:00 nel suo fuso (ripiego Europe/Rome);
// - promo valida solo se 0 < promo < prezzo pieno; senza fine resta finché non si toglie,
//   con fine `until` (YYYY-MM-DD) vale fino alle 06:00 del giorno dopo;
// - «Solo oggi» vale per la giornata in cui è stato impostato (data salvata), poi scade da solo;
// - «Ultime porzioni» resta finché non si toglie; quando il piatto diventa esaurito si rimuove.
// Tutto si risolve in LETTURA (publicWorkspace): nessun job, nessuna scrittura alla scadenza.
import type { Workspace } from './menu-workspace-contract.js'

export const DEFAULT_TIMEZONE = 'Europe/Rome'
export const BUSINESS_DAY_START_HOUR = 6

export type ItemPromo = { price: number; until?: string | null }
export type ItemScarcity = { lastPortions?: boolean; onlyToday?: string | null }
type SalesItem = { price: number; available?: boolean; promo?: ItemPromo | null; scarcity?: ItemScarcity | null }

/** Fuso valido o ripiego Europe/Rome (33 locali su 35 non hanno settings.timezone). */
export function salesTimezone(value: unknown): string {
  if (typeof value === 'string' && value) { try { new Intl.DateTimeFormat('en', { timeZone: value }); return value } catch { /* ripiego */ } }
  return DEFAULT_TIMEZONE
}

const addDays = (date: string, days: number) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
/** 0 = domenica … 6 = sabato, della data di calendario indicata. */
export const weekdayOf = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay()

/** Data della «giornata del locale»: prima delle 06:00 locali è ancora il giorno prima. */
export function businessDate(timezone?: string | null, now = new Date()): string {
  const zone = salesTimezone(timezone)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(v => [v.type, v.value]))
  const date = `${p.year}-${p.month}-${p.day}`
  return Number(p.hour) < BUSINESS_DAY_START_HOUR ? addDays(date, -1) : date
}

/** Promo: maggiore di zero e minore del prezzo pieno (che deve essere > 0). */
export function validPromoPrice(promo: number, full: number): boolean {
  return Number.isFinite(promo) && Number.isFinite(full) && promo > 0 && full > 0 && promo < full
}

export function promoActive(item: SalesItem, today: string): boolean {
  const promo = item.promo
  if (!promo || !validPromoPrice(promo.price, item.price)) return false
  return !promo.until || today <= promo.until
}
export const onlyTodayActive = (item: SalesItem, today: string) => !!item.scarcity?.onlyToday && item.scarcity.onlyToday === today
export const lastPortionsActive = (item: SalesItem) => !!item.scarcity?.lastPortions && item.available !== false

/** Stato visibile al cliente: solo ciò che è valido ADESSO. */
export function salesView(item: SalesItem, today: string): { promoPrice?: number; lastPortions?: true; onlyToday?: true } {
  return {
    ...(promoActive(item, today) ? { promoPrice: item.promo!.price } : {}),
    ...(lastPortionsActive(item) ? { lastPortions: true as const } : {}),
    ...(onlyTodayActive(item, today) ? { onlyToday: true as const } : {}),
  }
}

/** Copia pubblica: promo e scarsità scadute o non valide spariscono dal documento letto. */
export function resolveSalesItem<T extends SalesItem>(item: T, today: string): T {
  const next = { ...item }
  if (next.promo && !promoActive(next, today)) delete next.promo
  if (next.scarcity) {
    const lastPortions = lastPortionsActive(next), onlyToday = onlyTodayActive(next, today)
    if (!lastPortions && !onlyToday) delete next.scarcity
    else next.scarcity = { lastPortions, onlyToday: onlyToday ? next.scarcity.onlyToday! : null }
  }
  return next
}

/** «Piatto del giorno» e ogni calendario con data di fine: scaduto dalle 06:00 del giorno dopo, anche sulla pagina pubblica che ignora gli orari. */
export function scheduleExpired(schedule: { enabled?: boolean; until?: string | null } | undefined, today: string): boolean {
  return !!schedule?.enabled && !!schedule.until && today > schedule.until
}

/** Per i preset (F2): «Solo oggi» dentro un preset vale per il giorno in cui il preset va online. */
export function stampOnlyToday(workspace: Workspace, menuId: string, today: string): Workspace {
  for (const menu of workspace.menus) if (menu.id === menuId) for (const section of menu.sections) for (const item of section.items) if (item.scarcity?.onlyToday) item.scarcity.onlyToday = today
  return workspace
}

// --- Date dette a voce: «fino a domenica», «fino a domani», «fino al 20», «fino al 20/10» ---
const weekdays: [RegExp, number][] = [[/^domenic/, 0], [/^luned/, 1], [/^marted/, 2], [/^mercoled/, 3], [/^gioved/, 4], [/^venerd/, 5], [/^sabat/, 6]]
const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const validDate = (y: number, m: number, d: number) => { const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const t = new Date(iso + 'T12:00:00Z'); return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null }
/** Ultimo giorno incluso della promo, o null se l'espressione non è chiara. Le date passate passano all'anno/mese successivo. */
export function resolveUntil(phrase: string, today: string): string | null {
  const t = phrase.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/.\- ]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^solo\s+(?:per\s+)?/, '')
    .replace(/^(?:fino|finoa|sino)\s+(?:a|al|alla|all|ad)?\s*|^(?:entro|per)\s+(?:il|la|l)?\s*/, '').replace(/^(?:il|la|l)\s+/, '').replace(/^tutto il weekend$/, 'weekend').trim()
    .replace(/^(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|oggi) sera$/, '$1')
  if (!t) return null
  // Round 3: «fine mese» = ultimo giorno del mese del giorno di servizio.
  if (/^fine (?:del )?mese$/.test(t)) { const d = new Date(today.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10) }
  if (/^(?:tutto |questo )?(?:il )?weekend$/.test(t)) return addDays(today, (7 - weekdayOf(today)) % 7)
  if (/^(oggi|stasera|stanotte|fine giornata|questa sera)$/.test(t)) return today
  if (/^domani( sera)?$/.test(t)) return addDays(today, 1)
  if (/^dopodomani$/.test(t)) return addDays(today, 2)
  if (/^(fine settimana|fine della settimana|weekend|tutta la settimana|questa settimana)$/.test(t)) return addDays(today, (7 - weekdayOf(today)) % 7)
  const day = weekdays.find(([r]) => r.test(t.replace(/^(prossim[oa]|questa|questo)\s+/, '')))
  if (day && /^(prossim[oa]\s+|questa\s+|questo\s+)?[a-z]+$/.test(t)) return addDays(today, (day[1] - weekdayOf(today) + 7) % 7)
  const [year, month] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  let m = t.match(/^(\d{1,2})[/.\- ](\d{1,2})(?:[/.\- ](\d{2,4}))?$/)
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : year; let iso = validDate(y, Number(m[2]), Number(m[1])); if (iso && !m[3] && iso < today) iso = validDate(y + 1, Number(m[2]), Number(m[1])); return iso && iso >= today ? iso : null }
  m = t.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (m && months.includes(m[2]!)) { const mm = months.indexOf(m[2]!) + 1, y = m[3] ? Number(m[3]) : year; let iso = validDate(y, mm, Number(m[1])); if (iso && !m[3] && iso < today) iso = validDate(y + 1, mm, Number(m[1])); return iso && iso >= today ? iso : null }
  m = t.match(/^(\d{1,2})$/)
  if (m) { let iso = validDate(year, month, Number(m[1])); if (!iso || iso < today) iso = month === 12 ? validDate(year + 1, 1, Number(m[1])) : validDate(year, month + 1, Number(m[1])); return iso }
  return null
}
/** «domenica 18/10» per i messaggi del bot. */
export function untilLabel(until: string): string {
  const names = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  return `${names[weekdayOf(until)]} ${until.slice(8, 10)}/${until.slice(5, 7)}`
}

// --- Etichette pubbliche, tradotte una volta sola (statiche, niente LLM). Copia identica in apps/web/src/lib/menu-sales-copy.ts (test di parità). ---
export type SalesLabel = 'promo' | 'lastPortions' | 'onlyToday'
export const SALES_LABELS: Record<string, Record<SalesLabel, string>> = {
  it: { promo: 'Promo', lastPortions: 'Ultime porzioni', onlyToday: 'Solo oggi' },
  en: { promo: 'Offer', lastPortions: 'Last portions', onlyToday: 'Today only' },
  fr: { promo: 'Promo', lastPortions: 'Dernières portions', onlyToday: 'Aujourd’hui seulement' },
  de: { promo: 'Angebot', lastPortions: 'Letzte Portionen', onlyToday: 'Nur heute' },
  es: { promo: 'Oferta', lastPortions: 'Últimas raciones', onlyToday: 'Solo hoy' },
  pt: { promo: 'Promoção', lastPortions: 'Últimas porções', onlyToday: 'Só hoje' },
  nl: { promo: 'Actie', lastPortions: 'Laatste porties', onlyToday: 'Alleen vandaag' },
  pl: { promo: 'Promocja', lastPortions: 'Ostatnie porcje', onlyToday: 'Tylko dziś' },
  ru: { promo: 'Акция', lastPortions: 'Последние порции', onlyToday: 'Только сегодня' },
  ar: { promo: 'عرض', lastPortions: 'آخر الحصص', onlyToday: 'اليوم فقط' },
  zh: { promo: '优惠', lastPortions: '最后几份', onlyToday: '仅限今日' },
  ja: { promo: 'セール', lastPortions: '残りわずか', onlyToday: '本日限り' },
}
export const salesLabel = (key: SalesLabel, language = 'it') => SALES_LABELS[language.split('-')[0]!]?.[key] ?? SALES_LABELS.it![key]
