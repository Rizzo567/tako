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
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { db, restaurants, rooms } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import { runAssistant, executeAction } from './ai-actions.js'
import { ownerSystemPrompt } from './owner-prompt.js'
import { saveImageBuffer } from './image-store.js'
import { maybeStyleDishImage } from './dish-image-ai.js'

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
// Cancella le credenziali salvate: serve dopo un LOGOUT (dispositivo scollegato dal
// telefono). Senza pulizia, Baileys ricaricherebbe creds morte e WhatsApp rifiuterebbe
// la connessione all'infinito → nessun QR nuovo. Pulendo, il prossimo avvio riparte da
// zero ed emette un QR fresco.
function clearAuthDir(): void {
  try {
    rmSync(join(takoHome(), 'whatsapp-auth'), { recursive: true, force: true })
    mkdirSync(join(takoHome(), 'whatsapp-auth'), { recursive: true })
    console.log('[whatsapp] credenziali azzerate (logout) → pronto per nuovo QR')
  } catch (err) {
    console.error('[whatsapp] pulizia auth dir fallita:', err)
  }
}
function configPath(): string {
  return join(takoHome(), 'whatsapp-config.json')
}

interface WhatsAppConfig {
  enabled: boolean
  allowedNumbers: string[]
  // Codice di collegamento (opzione B): mostrato SOLO nella dashboard. Il primo numero
  // deve scrivere "collega tako <codice>" → lega il bootstrap a (accesso dashboard +
  // possesso del numero). Consumato appena la whitelist si popola.
  bootstrapCode?: string
}

function readConfig(): WhatsAppConfig {
  try {
    const raw = readFileSync(configPath(), 'utf8')
    const j = JSON.parse(raw)
    return {
      enabled: j?.enabled === true,
      allowedNumbers: Array.isArray(j?.allowedNumbers) ? j.allowedNumbers.map(normalizeNumber).filter(Boolean) : [],
      bootstrapCode: typeof j?.bootstrapCode === 'string' ? j.bootstrapCode : undefined,
    }
  } catch {
    return { enabled: false, allowedNumbers: [] }
  }
}

// Codice di collegamento a 6 cifre (crypto-random). ensure = crealo se la whitelist è
// vuota e non c'è già; regenerate = forzane uno nuovo (pulsante dashboard).
function ensureBootstrapCode(): string | null {
  const cfg = readConfig()
  if (cfg.allowedNumbers.length) return null            // già collegato: nessun codice
  if (cfg.bootstrapCode) return cfg.bootstrapCode
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  writeConfig({ bootstrapCode: code })
  return code
}
export function regenerateBootstrapCode(): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  writeConfig({ bootstrapCode: code })
  return code
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
// LID (linked-id) del NOSTRO account: su WhatsApp recenti la chat "messaggia te stesso"
// arriva con remoteJid = <nostro-lid>@lid invece del numero. Serve per riconoscerla.
let myLid: string | null = null
let allowedNumbers: string[] = []
// Timer di riconnessione IN VOLO: vanno cancellati da stopWhatsApp, altrimenti un
// /disable seguito da un reconnect schedulato riaccenderebbe il canale appena spento.
let reconnectTimers: ReturnType<typeof setTimeout>[] = []

// ID dei messaggi INVIATI da Tako: nella chat "messaggia te stesso" i nostri stessi
// messaggi tornano come eventi fromMe → li filtriamo per ID per non rispondere a noi
// stessi (anti-loop). Set con cap FIFO per non crescere all'infinito.
const sentIds = new Set<string>()
function rememberSent(id?: string | null): void {
  if (!id) return
  sentIds.add(id)
  if (sentIds.size > 300) { const first = sentIds.values().next().value; if (first) sentIds.delete(first) }
}

// downloadMediaMessage di Baileys (impostato all'avvio del socket): scarica i byte di
// un'immagine ricevuta. Serve per assegnare la foto a un piatto.
let downloadMedia: ((msg: any, type: 'buffer', opts: any, ctx: any) => Promise<Buffer>) | null = null

// Foto ricevuta in attesa del piatto a cui assegnarla (se l'owner manda l'immagine senza
// dire il piatto). Il messaggio di testo successivo = nome del piatto. TTL 10 minuti.
const pendingImageByNumber = new Map<string, { url: string; at: number }>()
const PENDING_IMAGE_TTL_MS = 10 * 60 * 1000
function getPendingImage(number: string): { url: string; at: number } | null {
  const p = pendingImageByNumber.get(number)
  if (!p) return null
  if (Date.now() - p.at > PENDING_IMAGE_TTL_MS) { pendingImageByNumber.delete(number); return null }
  return p
}
function setPendingImage(number: string, url: string): void { pendingImageByNumber.set(number, { url, at: Date.now() }) }
function clearPendingImage(number: string): void { pendingImageByNumber.delete(number) }

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
export function getWhatsAppStatus(): { enabled: boolean; connected: boolean; qr: string | null; me: string | null; allowedNumbers: string[]; bootstrapCode: string | null } {
  const cfg = readConfig()
  const nums = allowedNumbers.length ? allowedNumbers : cfg.allowedNumbers
  return {
    enabled: cfg.enabled || process.env['TAKO_WHATSAPP'] === '1',
    connected,
    qr: connected ? null : lastQr,
    me,
    allowedNumbers: nums,
    // codice mostrato SOLO quando serve il collegamento (whitelist vuota); se manca, lo crea
    bootstrapCode: nums.length ? null : ensureBootstrapCode(),
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
  // Annulla ogni riconnessione schedulata: senza questo un timer in volo (creato prima
  // del /disable) riavvierebbe il canale subito dopo lo stop.
  for (const t of reconnectTimers) clearTimeout(t)
  reconnectTimers = []
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
    downloadMedia = baileys.downloadMediaMessage ?? null
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
        myLid = normalizeNumber(sock?.user?.lid ?? '') || null
        console.log(`[whatsapp] connesso come ${me ?? '?'} (lid ${myLid ?? '?'})`)
      } else if (connection === 'close') {
        connected = false
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut
        console.log(`[whatsapp] connessione chiusa (code ${statusCode ?? '?'})${loggedOut ? ' — logout, richiede nuova scansione' : ''}`)
        sock = null
        if (loggedOut) {
          // Dispositivo scollegato dal telefono → creds morte. Le azzeriamo e, se il
          // canale è ancora attivo, ripartiamo pulito così viene emesso un QR NUOVO
          // (senza pulizia resteremmo bloccati: Baileys ricaricherebbe le creds morte).
          me = null
          lastQr = null
          clearAuthDir()
          if (readConfig().enabled) {
            const timer = setTimeout(() => {
              reconnectTimers = reconnectTimers.filter(t => t !== timer)
              // Riparti solo se nel frattempo il canale non è stato disattivato.
              if (readConfig().enabled === true) startWhatsApp().catch(e => console.error('[whatsapp] restart post-logout fallito:', e))
            }, 1500)
            reconnectTimers.push(timer)
          }
        } else if (readConfig().enabled) {
          // Disconnessione transitoria → riconnetti con le stesse creds.
          const timer = setTimeout(() => {
            reconnectTimers = reconnectTimers.filter(t => t !== timer)
            if (readConfig().enabled === true) startWhatsApp().catch(e => console.error('[whatsapp] riconnessione fallita:', e))
          }, 3000)
          reconnectTimers.push(timer)
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

    ensureBriefingScheduler()
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
  if (!msg?.key) return
  const jid: string = msg.key.remoteJid ?? ''
  const isLid = jid.endsWith('@lid')
  const isPn = jid.endsWith('@s.whatsapp.net')
  // Solo chat 1:1 (numero o lid): niente gruppi (@g.us)/broadcast/status.
  if (!isPn && !isLid) return
  const jidNum = normalizeNumber(jid)
  if (!jidNum) return

  // `number` = chiave autorizzativa (il numero di telefono). Per la self-chat che su
  // WhatsApp recenti arriva via @lid, la mappiamo al NOSTRO numero (`me`) così
  // whitelist / cronologia / pending restano coerenti tra i turni.
  let number: string
  if (msg.key.fromMe) {
    // Messaggio dell'account collegato: accettato SOLO se è la chat "messaggia te
    // stesso" (owner ↔ Tako) — jid uguale al NOSTRO account: lid == myLid oppure
    // numero == me. Un fromMe verso un CONTATTO (owner che scrive a terzi) → ignorato.
    // Filtriamo anche gli ECHI dei messaggi che Tako stesso invia (per ID) → no loop.
    const isSelf = (isLid && myLid != null && jidNum === myLid) || (isPn && me != null && jidNum === me)
    if (!isSelf) return
    if (msg.key.id && sentIds.has(msg.key.id)) return
    number = me ?? jidNum
  } else {
    // In arrivo da un contatto: per ora solo jid-numero (i lid altrui non li mappiamo).
    if (!isPn) return
    number = jidNum
  }

  const imageMsg = msg.message?.imageMessage
  const text = extractText(msg).trim()
  if (!text && !imageMsg) return   // niente da fare (nessun testo né immagine)

  // Autorizzazione: bootstrap se whitelist vuota, altrimenti whitelist stretta.
  const cfg = readConfig()
  allowedNumbers = cfg.allowedNumbers
  if (!allowedNumbers.length) {
    // Collegamento SICURO (opzione B): serve "collega tako <codice>" col codice mostrato
    // SOLO nella dashboard → lega il bootstrap ad accesso dashboard + possesso del numero.
    // Niente più "primo che scrive vince". Codice errato/assente → ignora in silenzio.
    const m = text.match(/^collega\s+tako\s+(\d{4,8})$/i)
    if (m && cfg.bootstrapCode && m[1] === cfg.bootstrapCode) {
      const next = setAllowedNumbers([number])
      writeConfig({ bootstrapCode: undefined })   // codice usa-e-getta, consumato
      console.log(`[whatsapp] bootstrap owner registrato (codice ok): ${number}`)
      await reply(jid, `✅ Tako collegato a questo numero. Ora puoi comandare la dashboard da qui.\nEsempi: "incasso di oggi", "segna esaurito la carbonara", "assegna questa foto alla carbonara" (allegando una foto).`)
      allowedNumbers = next
    }
    return
  }
  if (!allowedNumbers.includes(number)) {
    console.log(`[whatsapp] messaggio da numero NON autorizzato ignorato: ${number}`)
    return
  }

  // ── Immagine allegata → assegnala a un piatto (caption = nome del piatto) ──
  if (imageMsg) { await handleIncomingImage(msg, jid, number, text); return }

  // ── Foto già ricevuta in attesa del piatto → questo testo È il nome del piatto ──
  const pendingImg = getPendingImage(number)
  if (pendingImg) {
    if (CANCEL_RE.test(text)) { clearPendingImage(number); await reply(jid, '❌ Assegnazione foto annullata.'); return }
    clearPendingImage(number)
    await assignImageToDish(jid, number, pendingImg.url, text)
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

// Immagine ricevuta: scarica i byte, salvala (stessa pipeline degli upload), poi assegna
// al piatto indicato nella caption. Senza caption → resta in attesa del nome del piatto.
async function handleIncomingImage(msg: any, jid: string, number: string, caption: string): Promise<void> {
  const restaurantId = await primaryRestaurantId()
  if (!restaurantId) { await reply(jid, 'Nessun ristorante configurato.'); return }
  if (!downloadMedia || !sock) { await reply(jid, 'Ricezione immagini non disponibile in questo momento.'); return }
  let buf: Buffer
  try {
    buf = await downloadMedia(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage })
  } catch (err) {
    console.error('[whatsapp] download immagine fallito:', err)
    await reply(jid, 'Non sono riuscito a scaricare l\'immagine, riprova.')
    return
  }
  // Stile AI coerente (Nano Banana Pro) se attivo per il ristorante; altrimenti originale.
  buf = await maybeStyleDishImage(restaurantId, buf, msg.message?.imageMessage?.mimetype || 'image/jpeg')
  const saved = await saveImageBuffer(restaurantId, buf)
  if ('error' in saved) { await reply(jid, `⚠️ ${saved.error}`); return }
  await assignImageToDish(jid, number, saved.url, caption)
}

// Assegna una foto (già salvata, url) al piatto `dishName`. Se il piatto non è indicato o
// non è trovato, mette la foto IN ATTESA e chiede il nome del piatto.
async function assignImageToDish(jid: string, number: string, url: string, dishName: string): Promise<void> {
  const restaurantId = await primaryRestaurantId()
  if (!restaurantId) { await reply(jid, 'Nessun ristorante configurato.'); return }
  const name = (dishName || '').trim()
  if (!name) {
    setPendingImage(number, url)
    await reply(jid, '📷 Foto ricevuta. A quale piatto la assegno? Scrivi il nome (o "annulla").')
    return
  }
  const res = await executeAction('set_dish_image', { itemName: name, imageUrl: url }, { restaurantId, role: 'owner' }, 'owner', { allowMutation: true })
  if (res.ok) {
    pushHistory(number, 'assistant', res.summary)
    await reply(jid, `✅ ${res.summary}`)
  } else {
    setPendingImage(number, url)
    await reply(jid, `⚠️ ${res.summary}\nScrivi il nome esatto del piatto a cui assegnare la foto (o "annulla").`)
  }
}

// ─────────────────────────── Briefing giornaliero (WhatsApp) ───────────────────────────
// Feature flag `dailyBriefingEnabled` (default OFF): all'ora configurata invia un
// riepilogo automatico ai numeri autorizzati. Riusa le read del copilot (incasso di ieri,
// prenotazioni di oggi, scorte basse). Scheduler: controllo al minuto, una volta al giorno.
let lastBriefingDay: string | null = null
async function buildDailyBriefing(restaurantId: string): Promise<string> {
  const ctx = { restaurantId, role: 'owner' as const }
  const y = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const yStr = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(y)
  const parts: string[] = ['☀️ Buongiorno! Riepilogo Tako:']
  try { const r = await executeAction('revenue_for_date', { date: yStr }, ctx, 'owner'); parts.push(`\n📊 Ieri — ${r.summary}`) } catch { /* skip */ }
  try { const r = await executeAction('todays_reservations', {}, ctx, 'owner'); parts.push(`\n📅 ${r.summary}`) } catch { /* skip */ }
  try { const r = await executeAction('low_stock', {}, ctx, 'owner'); parts.push(`\n📦 ${r.summary}`) } catch { /* skip */ }
  return parts.join('\n')
}
async function maybeSendBriefing(): Promise<void> {
  try {
    if (!connected || !sock) return
    const restaurantId = await primaryRestaurantId()
    if (!restaurantId) return
    const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    const s = (r?.settings ?? {}) as any
    if (!s.dailyBriefingEnabled) return
    const hour = Number.isFinite(s.dailyBriefingHour) ? Number(s.dailyBriefingHour) : 9
    const tz = s.timezone || 'Europe/Rome'
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, hour: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const get = (t: string) => p.find(x => x.type === t)?.value
    const dayKey = `${get('year')}-${get('month')}-${get('day')}`
    if (Number(get('hour')) !== hour || lastBriefingDay === dayKey) return
    lastBriefingDay = dayKey
    const text = await buildDailyBriefing(restaurantId)
    for (const n of (readConfig().allowedNumbers || [])) await reply(`${n}@s.whatsapp.net`, text)
    console.log('[whatsapp] briefing giornaliero inviato')
  } catch (e) { console.error('[whatsapp] briefing fallito:', e) }
}
let briefingTimer: ReturnType<typeof setInterval> | null = null
function ensureBriefingScheduler(): void {
  if (briefingTimer) return
  briefingTimer = setInterval(() => { void maybeSendBriefing() }, 60_000)
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
    if (sock) {
      const sent = await sock.sendMessage(jid, { text })
      rememberSent(sent?.key?.id)
    }
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
