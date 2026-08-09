// Forme dei dati del server usate dall'app, e le mappe stato → colore/etichetta.
// Le mappe sono le stesse della dashboard staff: lo stesso ordine deve avere lo
// stesso colore sul tablet e sul telefono, altrimenti il ristoratore impara due
// linguaggi per la stessa cosa.
import type { Tone } from '../ui/kit'

export interface TableRow {
  id: string
  number: string
  seats: number
  roomId: string | null
  status: 'free' | 'occupied' | 'waiting' | 'cleaning' | 'reserved'
  shape?: string | null
  posX: number | null
  posY: number | null
  openedAt?: string | null
}

export interface RoomRow {
  id: string
  name: string
  position: number
  tables: TableRow[]
}

export interface OrderItemRow {
  id: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string | null
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

export interface OrderRow {
  id: string
  restaurantId: string
  tableId: string | null
  tableNumber: string | null
  type: 'table' | 'takeaway'
  status: OrderStatus
  total: number
  notes?: string | null
  customerName?: string | null
  createdAt: string
  items?: OrderItemRow[]
}

export interface BillRow {
  id: string
  tableId: string | null
  tableNumber: string | null
  covers: number | null
  subtotal: number
  discount: number | null
  discountNote?: string | null
  tip: number | null
  total: number
  status: 'open' | 'closed' | 'cancelled'
  createdAt: string
  closedAt?: string | null
  takeaway?: boolean
  customerName?: string | null
}

export interface WaiterCallRow {
  id: string
  tableId: string
  tableNumber: string | null
  type: 'help' | 'bill' | 'water'
  createdAt: string
}

// Stati tavolo → colore. Sono i sei --st-* dei token: il colore È l'informazione,
// il testo la ripete solo nella legenda.
export const TABLE_COLOR: Record<TableRow['status'], string> = {
  free: 'var(--st-free)',
  occupied: 'var(--st-busy)',
  waiting: 'var(--st-wait)',
  ready: 'var(--st-ready)',
  cleaning: 'var(--st-clean)',
  reserved: 'var(--st-resv)',
} as unknown as Record<TableRow['status'], string>

export const TABLE_LABEL: Record<TableRow['status'], string> = {
  free: 'Libero',
  occupied: 'Occupato',
  waiting: 'In attesa',
  cleaning: 'Da pulire',
  reserved: 'Prenotato',
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: 'In attesa', tone: 'wait' },
  confirmed: { label: 'Confermato', tone: 'info' },
  preparing: { label: 'In preparazione', tone: 'brand' },
  ready: { label: 'Pronto', tone: 'ok' },
  served: { label: 'Servito', tone: 'muted' },
  paid: { label: 'Pagato', tone: 'ok' },
  cancelled: { label: 'Annullato', tone: 'danger' },
}

// Prossimo passo del ciclo di vita: un solo pulsante grande, quello giusto. Le
// transizioni consentite sono decise dal SERVER (orders.ts ALLOWED_TRANSITIONS):
// qui c'è solo la scorciatoia più utile per ciascuno stato.
export const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: 'confirmed', label: 'Conferma' },
  confirmed: { to: 'preparing', label: 'In preparazione' },
  preparing: { to: 'ready', label: 'Segna pronto' },
  ready: { to: 'served', label: 'Segna servito' },
}

export const CALL_LABEL: Record<WaiterCallRow['type'], string> = {
  help: 'Chiede assistenza',
  bill: 'Chiede il conto',
  water: 'Chiede acqua',
}

/**
 * Etichetta breve di un ordine: il numero del tavolo così com'è ("T1", "12", "Sala2")
 * oppure "ASP" per l'asporto. Niente prefissi aggiunti: i numeri di tavolo sono testo
 * libero e possono già contenere una lettera — "TT1" non è un tavolo di nessuno.
 */
export function orderTag(o: OrderRow): string {
  if (o.type === 'takeaway' || o.tableNumber == null) return 'ASP'
  const n = String(o.tableNumber).trim()
  return /^\d+$/.test(n) ? n.padStart(2, '0') : n
}

/**
 * Un tavolo è "piazzato" sulla piantina solo se ha coordinate VERE. (0,0) è il default
 * della colonna, non una scelta del ristoratore: mostrarlo incollato all'angolo in alto
 * a sinistra sarebbe un'informazione inventata. Quei tavoli finiscono nella griglia.
 */
export function isPlaced(t: TableRow): boolean {
  if (t.posX == null || t.posY == null) return false
  return !(t.posX === 0 && t.posY === 0)
}
