// Servizio email come INTERFACCIA (MASTER_PLAN-cloud-auth).
// Due transport selezionati via env EMAIL_TRANSPORT:
//  - 'mock' (default): logga il contenuto su console (test/dev end-to-end senza provider).
//  - 'resend' (Fase 2b): invio reale via API Resend (RESEND_API_KEY + EMAIL_FROM).
// In più: una quota/rate-limit LOGICA sull'invio (anti mail-bombing — §7bis) applicata a
// monte di entrambi i transport, così Tako non può essere usato come amplificatore per
// bombardare di email vittime terze.
import { emailFrom } from './config.js'
import { incrWithTtl } from './redis.js'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  // opzionale: testo alternativo (i template forniscono già l'HTML)
  text?: string
}

export interface EmailResult {
  ok: boolean
  transport: string
  // id del provider (Fase 2b); in mock è undefined
  id?: string
}

type EmailTransport = (msg: EmailMessage) => Promise<EmailResult>

// ─── Transport MOCK (Fase 2a) ────────────────────────────────────────────────
// Non invia nulla: stampa su console così i flussi sono testabili end-to-end senza
// un provider reale. NON loggare MAI segreti applicativi: qui logghiamo solo il
// contenuto dell'email (che l'utente riceverebbe comunque). I link contengono token
// monouso a breve scadenza: accettabile in dev/mock, dove serve poterli copiare.
const mockTransport: EmailTransport = async (msg) => {
  // eslint-disable-next-line no-console
  console.log(
    [
      '──────────── [EMAIL MOCK] ────────────',
      `to:      ${msg.to}`,
      `subject: ${msg.subject}`,
      '--- html ---',
      msg.html,
      '──────────────────────────────────────',
    ].join('\n'),
  )
  return { ok: true, transport: 'mock' }
}

// ─── Transport Resend (reale) ────────────────────────────────────────────────
// Invio via API HTTP di Resend. Usiamo fetch nativo (Node 18+/20) per non aggiungere
// dipendenze pesanti: l'endpoint è stabile e a payload semplice. La key si legge SOLO
// da env (RESEND_API_KEY); se assente con EMAIL_TRANSPORT=resend → errore chiaro a monte
// (validateEmailConfig). Timeout esplicito + niente leak: in caso di errore logghiamo lo
// stato HTTP, MAI la key né il corpo dell'email (privacy/PII del destinatario).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const RESEND_TIMEOUT_MS = 10_000

function resendApiKey(): string {
  const k = process.env['RESEND_API_KEY']
  if (!k) {
    throw new Error('RESEND_API_KEY è obbligatoria quando EMAIL_TRANSPORT=resend')
  }
  return k
}

const resendTransport: EmailTransport = async (msg) => {
  const apiKey = resendApiKey()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS)
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      // NON includere il body dell'email; solo lo stato per la diagnostica.
      throw new Error(`Resend ha risposto ${res.status}`)
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, transport: 'resend', id: data.id }
  } finally {
    clearTimeout(timer)
  }
}

function selectTransport(): EmailTransport {
  const t = (process.env['EMAIL_TRANSPORT'] ?? 'mock').toLowerCase()
  if (t === 'resend') return resendTransport
  return mockTransport
}

/**
 * Valida la configurazione email all'avvio del modo cloud: se EMAIL_TRANSPORT=resend
 * la RESEND_API_KEY deve essere presente, altrimenti fail-fast con messaggio chiaro
 * (meglio di fallire silenziosamente al primo invio). No-op per il transport mock.
 */
export function validateEmailConfig(): void {
  if ((process.env['EMAIL_TRANSPORT'] ?? 'mock').toLowerCase() === 'resend') {
    resendApiKey() // lancia se assente
  }
}

// ─── Quota / rate-limit logico sull'invio (anti mail-bombing — §7bis / NEW-06) ─────────
// Limita il numero di email che possiamo spedire a UN DATO destinatario in una finestra
// temporale, a prescindere da quante richieste arrivano. Difende vittime terze: anche se un
// attaccante spamma /register o /resend con l'email di un altro, quell'indirizzo non riceve
// più di MAX_PER_WINDOW messaggi per finestra.
// NEW-06: lo stato vive su REDIS (chiave `email:quota:<emailLower>`, TTL = finestra) così è
// CONDIVISO tra repliche del control-plane; FALLBACK in-memory per-istanza quando Redis non è
// disponibile (dev/test/single-istanza) — il comportamento osservabile resta identico.
const SEND_WINDOW_MS = 60 * 60 * 1000 // 1 ora
const SEND_WINDOW_S = SEND_WINDOW_MS / 1000
const SEND_MAX_PER_WINDOW = 5
const emailQuotaKey = (to: string) => `email:quota:${to.trim().toLowerCase()}`

// Fallback in-memory (usato SOLO se Redis assente). Cleanup pigro per non crescere.
const sendLog = new Map<string, number[]>()

function memQuotaAllows(to: string): boolean {
  const key = to.trim().toLowerCase()
  const now = Date.now()
  const recent = (sendLog.get(key) ?? []).filter((t) => now - t < SEND_WINDOW_MS)
  if (recent.length >= SEND_MAX_PER_WINDOW) {
    sendLog.set(key, recent)
    return false
  }
  recent.push(now)
  sendLog.set(key, recent)
  if (sendLog.size > 5000) {
    for (const [k, v] of sendLog) {
      const live = v.filter((t) => now - t < SEND_WINDOW_MS)
      if (live.length === 0) sendLog.delete(k)
      else sendLog.set(k, live)
    }
  }
  return true
}

async function quotaAllows(to: string): Promise<boolean> {
  // INCR atomico su Redis (con EXPIRE alla prima email della finestra). Se Redis non è
  // disponibile → ramo in-memory. La logica "consuma una unità e verifica la soglia" è la
  // stessa dei due rami, così i test (senza Redis) restano verdi.
  const count = await incrWithTtl(emailQuotaKey(to), SEND_WINDOW_S)
  if (count === null) return memQuotaAllows(to)
  return count <= SEND_MAX_PER_WINDOW
}

/**
 * Invia un'email tramite il transport selezionato.
 * - Applica una quota per-destinatario (anti mail-bombing): oltre la soglia ritorna
 *   `{ ok:false, transport:'throttled' }` SENZA inviare e senza lanciare.
 * - In mock non lancia mai. In resend può lanciare su errore di rete/HTTP: i chiamanti
 *   già fanno `.catch()` best-effort sui flussi anti-enumeration.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  if (!(await quotaAllows(msg.to))) {
    return { ok: false, transport: 'throttled' }
  }
  const transport = selectTransport()
  return transport(msg)
}

// ─── Template ────────────────────────────────────────────────────────────────
// Funzioni pure che costruiscono l'HTML. I link sono già pronti (costruiti da chi
// chiama, da env fisse — vedi links.ts — MAI dall'header Host).
const FROM_LABEL = 'Tako'

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222">
<h1 style="font-size:20px">${escapeHtml(title)}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#888">${escapeHtml(FROM_LABEL)} — se non hai richiesto questa email, ignorala.</p>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function verifyEmailTemplate(opts: { name?: string | null; verifyUrl: string }): { subject: string; html: string } {
  const hi = opts.name ? `Ciao ${escapeHtml(opts.name)},` : 'Ciao,'
  return {
    subject: 'Conferma il tuo indirizzo email — Tako',
    html: layout('Conferma la tua email', `
<p>${hi}</p>
<p>Per attivare il tuo account Tako, conferma il tuo indirizzo email:</p>
<p><a href="${escapeHtml(opts.verifyUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Conferma email</a></p>
<p style="font-size:13px;color:#666">Il link scade tra 24 ore. Se il pulsante non funziona, copia questo indirizzo nel browser:<br>${escapeHtml(opts.verifyUrl)}</p>`),
  }
}

export function resetPasswordTemplate(opts: { name?: string | null; resetUrl: string }): { subject: string; html: string } {
  const hi = opts.name ? `Ciao ${escapeHtml(opts.name)},` : 'Ciao,'
  return {
    subject: 'Reimposta la tua password — Tako',
    html: layout('Reimposta la password', `
<p>${hi}</p>
<p>Abbiamo ricevuto una richiesta di reset password per il tuo account Tako. Clicca per impostarne una nuova:</p>
<p><a href="${escapeHtml(opts.resetUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reimposta password</a></p>
<p style="font-size:13px;color:#666">Il link scade tra 1 ora ed è utilizzabile una sola volta. Se non hai richiesto il reset, ignora questa email: la tua password resta invariata.<br>${escapeHtml(opts.resetUrl)}</p>`),
  }
}
