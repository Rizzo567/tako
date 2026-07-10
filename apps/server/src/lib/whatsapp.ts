// ─────────────────────────── Tako — BRIDGE WHATSAPP ↔ COPILOT OWNER ───────────────────────────
// Il ristoratore comanda la dashboard scrivendo su WhatsApp al numero collegato. Stesso motore
// AI del copilot Cowork (lib/ai-actions.runAssistant, scope 'owner') e STESSO prompt di sistema
// (lib/owner-prompt.ownerSystemPrompt): quello che l'owner può fare in chat lo fa anche da WhatsApp.
//
// Sicurezza (allineata al copilot dashboard):
//   • Solo NUMERI IN WHITELIST possono comandare. Numeri sconosciuti → ignorati (nessuna risposta,
//     nessun leak). Bootstrap: se la whitelist è vuota, il primo che scrive "collega tako" diventa owner.
//   • Le MUTATION non si eseguono mai in chat: si PROPONGONO e richiedono un "SÌ" esplicito (come la
//     card di conferma della dashboard). Store proposte in memoria con TTL 10 min.
//   • Il canale è DISABILITATO di default: parte solo con TAKO_WHATSAPP=1 o config `enabled:true`.
//
// Baileys è importato DINAMICAMENTE dentro startWhatsApp(): il server parte anche senza la dipendenza
// installata (e senza tirar giù nulla se Baileys esplode). I tipi Baileys sono trattati come `any`
// localizzato — l'API multi-device cambia tra versioni e non vogliamo accoppiarci ai suoi .d.ts.

import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { db, restaurants, rooms } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import { runAssistant, executeAction } from './ai-actions.js'
import { ownerSystemPrompt } from './owner-prompt.js'

// ─────────────────────────── Percorsi & config su disco ───────────────────────────
// TAKO_HOME è impostato dalla shell desktop; fallback ~/.tako (stesso schema di bootstrap.ts).
function takoHome(): string {
  return process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
}
function authDir(): string {
  const d = join(takoHome(), 'whatsapp-auth')
  mkdirSync(d, { recursive: true })
  return d
}
function configPath(): string {
  return join(takoHome(), 'whatsapp-config.json')
}

interface WhatsAppConfig {
  enabled: boolean
  allowedNumbers: string[]
}

function readConfig(): WhatsAppConfig {
  try {
    const raw = readFileSync(configPath(), 'utf8')
    const j = JSON.parse(raw)
    return {
      enabled: j?.enabled === true,
      allowedNumbers: Array.isArray(j?.allowedNumbers) ? j.allowedNumbers.map(normalizeNumber).filter(Boolean) : [],
    }
  } catch {
    return { enabled: false, allowedNumbers: [] }
  }
}

function writeConfig(patch: Partial<WhatsAppConfig>): WhatsAppConfig {
  const cur = readConfig()
  const next: WhatsAppConfig = { ...cur, ...patch }
  if (patch.allowedNumbers) next.allowedNumbers = patch.allowedNumbers.map(normalizeNumber).filter(Boolean)
  try {
    mkdirSync(takoHome(), { recursive: true })
    writeFileSync(configPath(), JSON.stringify(next, null, 2), { mode: 0o600 })
  } catch (err) {
    console.error('[whatsapp] impossibile scrivere la config:', err)
  }
  return next
}

// Normalizza un numero/JID a sole cifre: "3934...@s.whatsapp.net" o "+39 34..." → "3934...".
function normalizeNumber(input: string): string {
  return String(input ?? '').split('@')[0]!.split(':')[0]!.replace(/\D/g, '')
}

// ─────────────────────────── Stato in memoria ───────────────────────────
let sock: any = null
let starting = false
let connected = false
let lastQr: string | null = null
let me: string | null = null
let allowedNumbers: string[] = []

// Proposte di mutation in attesa di conferma, per numero. TTL 10 minuti.
interface PendingProposal { name: string; args: any; label: string; at: number }
const pendingByNumber = new Map<string, PendingProposal>()
const PENDING_TTL_MS = 10 * 60 * 1000

// Cronologia conversazione per numero (ultimi 8 scambi = 16 messaggi). TTL 1 ora.
interface HistoryEntry { msgs: { role: 'user' | 'assistant'; content: string }[]; at: number }
const historyByNumber = new Map<string, HistoryEntry>()
const HISTORY_TTL_MS = 60 * 60 * 1000
const HISTORY_MAX = 16

// Parole di conferma / annullamento (match sull'intero messaggio, trim + lowercase).
const CONFIRM_RE = /^(s[iì]|ok(ay)?|conferma|vai|procedi|yes|👍)$/i
const CANCEL_RE = /^(no|annulla|cancella|stop|👎)$/i

// ─────────────────────────── API pubblica ───────────────────────────
export function getWhatsAppStatus(): { enabled: boolean; connected: boolean; qr: string | null; me: string | null; allowedNumbers: string[] } {
  return {
    enabled: readConfig().enabled || process.env['TAKO_WHATSAPP'] === '1',
    connected,
    qr: connected ? null : lastQr,
    me,
    allowedNumbers: allowedNumbers.length ? allowedNumbers : readConfig().allowedNumbers,
  }
}

// Aggiorna la whitelist (chiamata dalla route). Persistita su disco + applicata a caldo.
export function setAllowedNumbers(numbers: string[]): string[] {
  const cfg = writeConfig({ allowedNumbers: numbers })
  allowedNumbers = cfg.allowedNumbers
  console.log(`[whatsapp] whitelist aggiornata: ${allowedNumbers.length} numeri`)
  return allowedNumbers
}

export async function stopWhatsApp(): Promise<void> {
  writeConfig({ enabled: false })
  try {
    if (sock) {
      // logout NON viene chiamato di proposito: vogliamo poter riattivare senza riscansionare.
      sock.ev?.removeAllListeners?.()
      sock.end?.(undefined)
    }
  } catch { /* best-effort */ }
  sock = null
  connected = false
  lastQr = null
  me = null
  console.log('[whatsapp] canale disattivato')
}

// Avvia la connessione WhatsApp. Idempotente: se già connesso/in avvio non fa nulla.
export async function startWhatsApp(): Promise<void> {
  if (sock || starting) { console.log('[whatsapp] già avviato o in avvio'); return }
  starting = true
  writeConfig({ enabled: true })
  allowedNumbers = readConfig().allowedNumbers

  // Import dinamico: se Baileys manca, errore chiaro senza abbattere il server.
  let baileys: any
  try {
    baileys = await import('@whiskeysockets/baileys')
  } catch (err) {
    starting = false
    console.error('[whatsapp] dipendenza @whiskeysockets/baileys non installata:', err)
    throw Object.assign(new Error('Baileys non installato: esegui `pnpm --filter @tako/server add @whiskeysockets/baileys`'), { code: 'WA_DEP_MISSING' })
  }

  try {
    const makeWASocket = baileys.default ?? baileys.makeWASocket
    const { useMultiFileAuthState, DisconnectReason } = baileys
    const { state, saveCreds } = await useMultiFileAuthState(authDir())

    sock = makeWASocket({
      auth: state,
      // printQRInTerminal è deprecato: gestiamo il QR noi via connection.update → endpoint /status.
      browser: ['Tako', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) {
        lastQr = qr
        console.log('[whatsapp] nuovo QR pronto per la scansione (owner → Impostazioni → WhatsApp)')
      }
      if (connection === 'open') {
        connected = true
        lastQr = null
        me = normalizeNumber(sock?.user?.id ?? '') || null
        console.log(`[whatsapp] connesso come ${me ?? '?'}`)
      } else if (connection === 'close') {
        connected = false
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut
        console.log(`[whatsapp] connessione chiusa (code ${statusCode ?? '?'})${loggedOut ? ' — logout, richiede nuova scansione' : ''}`)
        sock = null
        // Riconnetti se NON è un logout esplicito.
        if (!loggedOut && readConfig().enabled) {
          setTimeout(() => { startWhatsApp().catch(e => console.error('[whatsapp] riconnessione fallita:', e)) }, 3000)
        } else {
          me = null
        }
      }
    })

    sock.ev.on('messages.upsert', async (evt: any) => {
      try {
        if (evt?.type !== 'notify') return
        for (const msg of (evt.messages ?? [])) {
          await handleIncoming(msg)
        }
      } catch (err) {
        console.error('[whatsapp] errore nella gestione messaggi:', err)
      }
    })

    console.log('[whatsapp] socket avviato, in attesa di connessione/QR')
  } catch (err) {
    sock = null
    console.error('[whatsapp] avvio fallito:', err)
    throw err
  } finally {
    starting = false
  }
}

// ─────────────────────────── Gestione messaggio in arrivo ───────────────────────────
async function handleIncoming(msg: any): Promise<void> {
  // Ignora i messaggi propri e quelli senza mittente.
  if (!msg?.key || msg.key.fromMe) return
  const jid: string = msg.key.remoteJid ?? ''
  // Solo chat 1:1 (numeri): niente gruppi/broadcast/status.
  if (!jid.endsWith('@s.whatsapp.net')) return
  const number = normalizeNumber(jid)
  if (!number) return

  const text = extractText(msg).trim()
  if (!text) return

  // Autorizzazione: bootstrap se whitelist vuota, altrimenti whitelist stretta.
  const cfg = readConfig()
  allowedNumbers = cfg.allowedNumbers
  if (!allowedNumbers.length) {
    if (/^collega\s+tako$/i.test(text)) {
      const next = setAllowedNumbers([number])
      console.log(`[whatsapp] bootstrap owner registrato: ${number}`)
      await reply(jid, `✅ Tako collegato a questo numero. Ora puoi comandare la dashboard da qui.\nEsempi: "incasso di oggi", "segna esaurito la carbonara", "crea tavolo 12 da 4 in sala principale".`)
      allowedNumbers = next
    }
    // Whitelist vuota e messaggio diverso da "collega tako": ignora in silenzio.
    return
  }
  if (!allowedNumbers.includes(number)) {
    console.log(`[whatsapp] messaggio da numero NON autorizzato ignorato: ${number}`)
    return
  }

  // ── Conferma/annullamento di una proposta pending ──
  const pending = getPending(number)
  if (pending) {
    if (CONFIRM_RE.test(text)) {
      clearPending(number)
      await executePending(jid, number, pending)
      return
    }
    if (CANCEL_RE.test(text)) {
      clearPending(number)
      await reply(jid, '❌ Proposta annullata.')
      return
    }
    // Nessun sì/no: la proposta scade da sola (TTL), procediamo con un nuovo turno AI.
  }

  await runOwnerTurn(jid, number, text)
}

// Estrae il testo da un messaggio Baileys (conversation o extendedTextMessage).
function extractText(msg: any): string {
  const m = msg?.message
  if (!m) return ''
  return m.conversation
    ?? m.extendedTextMessage?.text
    ?? m.imageMessage?.caption
    ?? m.videoMessage?.caption
    ?? ''
}

// Esegue una mutation confermata e risponde col summary.
async function executePending(jid: string, number: string, pending: PendingProposal): Promise<void> {
  try {
    const restaurantId = await primaryRestaurantId()
    if (!restaurantId) { await reply(jid, 'Nessun ristorante configurato.'); return }
    const res = await executeAction(pending.name, pending.args, { restaurantId, role: 'owner' }, 'owner', { allowMutation: true })
    console.log(`[whatsapp] comando eseguito da ${number}: ${pending.name} → ${res.ok ? 'ok' : 'ko'}`)
    pushHistory(number, 'assistant', res.summary)
    await reply(jid, res.ok ? `✅ ${res.summary}` : `⚠️ ${res.summary}`)
  } catch (err) {
    console.error('[whatsapp] esecuzione proposta fallita:', err)
    await reply(jid, 'Tako non è al momento disponibile, riprova tra poco.')
  }
}

// Un turno del copilot owner: chiama runAssistant, gestisce eventuali proposte pending.
async function runOwnerTurn(jid: string, number: string, text: string): Promise<void> {
  try {
    const restaurantId = await primaryRestaurantId()
    if (!restaurantId) { await reply(jid, 'Nessun ristorante configurato.'); return }

    const [restaurant] = await db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    const activeRooms = await db.select({ name: rooms.name }).from(rooms).where(and(eq(rooms.restaurantId, restaurantId), eq(rooms.active, true)))
    const systemPrompt = ownerSystemPrompt(restaurant?.name, activeRooms.map(r => r.name))

    const history = getHistory(number)
    const turn = await runAssistant({
      scope: 'owner',
      ctx: { restaurantId, role: 'owner' },
      systemPrompt,
      history,
      userMessage: text,
    })

    pushHistory(number, 'user', text)
    pushHistory(number, 'assistant', turn.message)
    console.log(`[whatsapp] comando da ${number}: "${text.slice(0, 60)}" → ${turn.pending.length} proposte`)

    let out = turn.message || 'Fatto.'
    if (turn.pending.length) {
      // Salva SOLO la prima proposta come pending confermabile.
      const first = turn.pending[0]!
      setPending(number, { name: first.name, args: first.args, label: first.label, at: Date.now() })
      out += `\n\n👉 ${first.label}\nRispondi SÌ per confermare o NO per annullare.`
      if (turn.pending.length > 1) {
        out += `\n(Le altre ${turn.pending.length - 1} modifiche proposte vanno fatte dalla dashboard.)`
      }
    }
    await reply(jid, out)
  } catch (err) {
    console.error('[whatsapp] turno copilot fallito:', err)
    await reply(jid, 'Tako non è al momento disponibile, riprova tra poco.')
  }
}

// ─────────────────────────── Helper ───────────────────────────
// Appliance mono-ristorante: il primo (e unico) ristorante del DB.
async function primaryRestaurantId(): Promise<string | null> {
  const [r] = await db.select({ id: restaurants.id }).from(restaurants).limit(1)
  return r?.id ?? null
}

async function reply(jid: string, text: string): Promise<void> {
  try {
    if (sock) await sock.sendMessage(jid, { text })
  } catch (err) {
    console.error('[whatsapp] invio risposta fallito:', err)
  }
}

function getPending(number: string): PendingProposal | null {
  const p = pendingByNumber.get(number)
  if (!p) return null
  if (Date.now() - p.at > PENDING_TTL_MS) { pendingByNumber.delete(number); return null }
  return p
}
function setPending(number: string, p: PendingProposal): void { pendingByNumber.set(number, p) }
function clearPending(number: string): void { pendingByNumber.delete(number) }

function getHistory(number: string): { role: 'user' | 'assistant'; content: string }[] {
  const h = historyByNumber.get(number)
  if (!h) return []
  if (Date.now() - h.at > HISTORY_TTL_MS) { historyByNumber.delete(number); return [] }
  return h.msgs
}
function pushHistory(number: string, role: 'user' | 'assistant', content: string): void {
  const h = historyByNumber.get(number) ?? { msgs: [], at: Date.now() }
  h.msgs.push({ role, content })
  if (h.msgs.length > HISTORY_MAX) h.msgs = h.msgs.slice(-HISTORY_MAX)
  h.at = Date.now()
  historyByNumber.set(number, h)
}
