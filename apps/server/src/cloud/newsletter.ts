// Iscrizione newsletter via Resend Audiences (decisione 2026-07-10): niente sistema
// di invio custom — le newsletter si spediscono dalla dashboard Resend (broadcast +
// unsubscribe GDPR nativi). Qui SOLO l'aggiunta del contatto, chiamata al momento
// della VERIFICA email (double opt-in di fatto: checkbox alla registrazione + click
// sul link di verifica). Best-effort: un fallimento non deve mai rompere la verifica.

const RESEND_CONTACTS_TIMEOUT_MS = 8000

/** True se l'integrazione è configurata (entrambe le env presenti). */
export function newsletterConfigured(): boolean {
  return !!process.env['RESEND_API_KEY'] && !!process.env['RESEND_AUDIENCE_ID']
}

/**
 * Aggiunge il contatto alla Resend Audience. Idempotente lato Resend (email già
 * presente → ok). Se le env mancano logga e salta: il flusso di verifica non cambia.
 */
export async function subscribeToNewsletter(email: string, name: string | null): Promise<void> {
  if (!newsletterConfigured()) {
    console.warn('[cloud/newsletter] RESEND_API_KEY/RESEND_AUDIENCE_ID non configurate: iscrizione saltata per', email)
    return
  }
  const audienceId = process.env['RESEND_AUDIENCE_ID']!
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), RESEND_CONTACTS_TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env['RESEND_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, first_name: name ?? undefined, unsubscribed: false }),
      signal: ac.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[cloud/newsletter] iscrizione fallita (${res.status}) per ${email}: ${body.slice(0, 200)}`)
    }
  } catch (err) {
    console.error('[cloud/newsletter] iscrizione fallita:', err)
  } finally {
    clearTimeout(timer)
  }
}
