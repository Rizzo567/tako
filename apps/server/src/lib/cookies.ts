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

// Sessione staff LONG-LIVED con refresh rolling (vedi middleware/auth.ts): su un
// appliance desktop personale il login deve "restare". La scadenza viene rinnovata
// a ogni uso, quindi finché usi Tako non ti disconnette. Il cookie WKWebView di
// Tauri è persistente → sopravvive ai riavvii dell'app.
export const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 90 // 90 giorni
// Ogni quanto (al massimo) rinnovare la scadenza di una sessione staff attiva:
// evita una UPDATE a ogni richiesta, rinnova al più una volta al giorno.
export const SESSION_REFRESH_AFTER_MS = 60 * 60 * 24 * 1000 // 1 giorno
export const TABLE_SESSION_MAX_AGE = 60 * 60 * 4       // 4 ore
