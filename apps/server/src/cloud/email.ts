// Servizio email come INTERFACCIA (MASTER_PLAN-cloud-auth Fase 2a).
// In Fase 2a esiste SOLO il transport `mock` (console): logga il contenuto e ritorna ok.
// Il transport `resend` reale è Fase 2b (vedi TODO sotto).
// Il selettore è l'env EMAIL_TRANSPORT (default 'mock').

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

// ─── TODO Fase 2b: transport Resend ──────────────────────────────────────────
// Implementare un `resendTransport` che usa RESEND_API_KEY e EMAIL_FROM:
//   import { Resend } from 'resend'
//   const resend = new Resend(process.env.RESEND_API_KEY)
//   const { data } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
//   return { ok: true, transport: 'resend', id: data?.id }
// Aggiungere `resend` come dipendenza e gestire errori/retry. Selezionare via
// EMAIL_TRANSPORT=resend. NON loggare il body in produzione (privacy).
const resendTransport: EmailTransport = async () => {
  throw new Error('Transport email "resend" non implementato (Fase 2b)')
}

function selectTransport(): EmailTransport {
  const t = (process.env['EMAIL_TRANSPORT'] ?? 'mock').toLowerCase()
  if (t === 'resend') return resendTransport
  return mockTransport
}

/** Invia un'email tramite il transport selezionato. Non lancia in mock. */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
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
