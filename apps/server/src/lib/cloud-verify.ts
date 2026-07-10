// Verifica email OBBLIGATORIA alla registrazione ristorante sull'appliance
// (decisione 2026-07-10): l'appliance NON invia email — delega al control-plane
// cloud esistente (register/resend su api.takoitalia.com, Resend già live), e
// scopre l'avvenuta verifica con un "login probe" al momento del login locale
// (nessuna password salvata in chiaro, nessun polling, nessun endpoint nuovo).
//
// Il gate è attivo SOLO se CLOUD_BASE_URL è configurata (stessa env del pairing);
// senza cloud (dev, demo offline) la registrazione resta quella storica.
// Override esplicito per spegnerlo anche col cloud configurato: TAKO_EMAIL_VERIFICATION=0.

const CLOUD_HTTP_TIMEOUT_MS = 8000

function cloudBaseUrl(): string | null {
  const v = process.env['CLOUD_BASE_URL']?.trim()
  return v ? v.replace(/\/+$/, '') : null
}

/** True se la verifica email alla registrazione è attiva su questa appliance. */
export function emailVerificationEnabled(): boolean {
  return !!cloudBaseUrl() && process.env['TAKO_EMAIL_VERIFICATION'] !== '0'
}

async function cloudPost(path: string, body: unknown): Promise<Response> {
  const base = cloudBaseUrl()
  if (!base) throw new Error('CLOUD_BASE_URL non configurata')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), CLOUD_HTTP_TIMEOUT_MS)
  try {
    return await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Registra l'owner sul cloud (cloud_owners) → il cloud invia l'email di verifica
 * via Resend. Il cloud risponde SEMPRE 200 generico (anti-enumeration), quindi
 * qui distinguiamo solo ok / errore-server / irraggiungibile.
 */
export async function cloudRegisterOwner(input: { email: string; password: string; name: string; newsletter?: boolean }): Promise<'ok' | 'error' | 'unreachable'> {
  try {
    const res = await cloudPost('/api/auth/register', {
      email: input.email,
      password: input.password,
      name: input.name,
      newsletter: !!input.newsletter,
    })
    if (res.ok) return 'ok'
    // 400 WEAK_PASSWORD/VALIDATION: policy cloud più severa → trattato come errore
    // esplicito (il chiamante rifiuta la registrazione locale con il messaggio cloud).
    return 'error'
  } catch {
    return 'unreachable'
  }
}

/**
 * Scopre se l'email dell'owner è stata verificata sul cloud provando il login cloud
 * con le stesse credenziali appena validate in locale (mai salvate).
 *  - 'verified'      → login cloud riuscito (il cloud fa passare solo email verificate)
 *  - 'not_verified'  → password giusta ma EMAIL_NOT_VERIFIED (403)
 *  - 'invalid'       → il cloud non riconosce le credenziali (account cloud pre-esistente
 *                      con password diversa, o mai sincronizzato)
 *  - 'unreachable'   → cloud giù/offline: il chiamante decide la policy
 */
export async function cloudLoginProbe(email: string, password: string): Promise<'verified' | 'not_verified' | 'invalid' | 'unreachable'> {
  try {
    const res = await cloudPost('/api/auth/login', { email, password })
    if (res.ok) return 'verified'
    if (res.status === 403) {
      const body = await res.json().catch(() => null) as { error?: { code?: string } } | null
      if (body?.error?.code === 'EMAIL_NOT_VERIFIED') return 'not_verified'
    }
    return 'invalid'
  } catch {
    return 'unreachable'
  }
}

/** Reinvia l'email di verifica (proxy del resend cloud, 200 generico). Best-effort. */
export async function cloudResendVerification(email: string): Promise<void> {
  try {
    await cloudPost('/api/auth/resend-verification', { email })
  } catch {
    /* best-effort: la UI mostra comunque il messaggio generico */
  }
}
