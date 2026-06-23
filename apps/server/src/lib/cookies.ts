// Cookie di autenticazione condivisi (HttpOnly). Centralizza nomi e opzioni così
// staff (sessione) e cliente (JWT tavolo) restano coerenti.
import type { CookieSerializeOptions } from '@fastify/cookie'

export const SESSION_COOKIE = 'tako_session' // token di sessione staff (opaco)
export const TABLE_COOKIE = 'tako_table'     // JWT legato al tavolo del cliente

// Secure SOLO dietro TLS reale. Tako è un'appliance locale che gira in http sulla
// LAN: lì i browser RIFIUTANO i cookie Secure (eccetto su localhost), quindi la
// sessione non verrebbe salvata sui tablet/telefoni. Default false; imposta
// COOKIE_SECURE=1 solo se servi Tako dietro HTTPS.
const cookieSecure = process.env['COOKIE_SECURE'] === '1'

/** Opzioni base: HttpOnly, SameSite=Lax, Secure solo dietro TLS. `path`/`maxAge` per-uso. */
export function authCookieOptions(maxAgeSeconds: number, path = '/'): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path,
    maxAge: maxAgeSeconds,
  }
}

export const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 giorni
export const TABLE_SESSION_MAX_AGE = 60 * 60 * 4       // 4 ore
