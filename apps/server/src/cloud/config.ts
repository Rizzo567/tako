// Config centralizzata del modo cloud. Tutte le env del control-plane si leggono qui,
// così le route non toccano process.env e i default/validazioni sono in un solo posto.
// I LINK email si costruiscono SOLO da SITE_BASE_URL (env fissa), MAI dall'header Host
// (mitigazione host-header injection — §7).

/** True se il server gira come control-plane cloud. */
export function isCloudMode(): boolean {
  return (process.env['TAKO_MODE'] ?? 'local').toLowerCase() === 'cloud'
}

/** Base URL pubblica del sito (front-end cloud). Usata per costruire i link email. */
export function siteBaseUrl(): string {
  const v = process.env['SITE_BASE_URL']
  if (!v) throw new Error('SITE_BASE_URL è obbligatoria in TAKO_MODE=cloud')
  return v.replace(/\/+$/, '')
}

/** Allowlist ESATTA di origin per CORS (lista separata da virgola). Mai wildcard. */
export function allowedOrigins(): string[] {
  const raw = process.env['ALLOWED_ORIGINS'] ?? ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Modalità cookie: 'samesite' (default, SameSite=Lax) | 'crosssite' (SameSite=None+CSRF). */
export function cookieMode(): 'samesite' | 'crosssite' {
  return process.env['COOKIE_MODE'] === 'crosssite' ? 'crosssite' : 'samesite'
}

/** Mittente delle email (per Fase 2b/Resend; informativo in mock). */
export function emailFrom(): string {
  return process.env['EMAIL_FROM'] ?? 'Tako <no-reply@example.com>'
}

// ─── Costruzione link (da env fisse, mai da Host) ────────────────────────────
export function buildVerifyUrl(token: string): string {
  return `${siteBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`
}

export function buildResetUrl(token: string): string {
  return `${siteBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
}

/**
 * Valida un redirect richiesto dal client contro l'allowlist SITE_BASE_URL.
 * Ritorna l'URL solo se ha la STESSA origin di SITE_BASE_URL, altrimenti il
 * fallback sicuro (la home del sito). Evita open-redirect (§7).
 */
export function safeRedirect(requested: string | undefined): string {
  const base = siteBaseUrl()
  if (!requested) return base
  try {
    const u = new URL(requested, base)
    const b = new URL(base)
    if (u.origin === b.origin) return u.toString()
  } catch {
    /* url malformato → fallback */
  }
  return base
}
