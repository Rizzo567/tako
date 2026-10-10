// Cookie di autenticazione condivisi (HttpOnly). Centralizza nomi e opzioni così
// staff (sessione) e cliente (JWT tavolo) restano coerenti.
import { webOrigin } from './web-runtime.js'
import type { CookieSerializeOptions } from '@fastify/cookie'

export const SESSION_COOKIE = 'tako_session' // token di sessione staff (opaco)
export const TABLE_COOKIE = 'tako_table'     // JWT legato al tavolo del cliente

/** Opzioni base: HttpOnly, SameSite=Lax, Secure quando l'origine pubblica è HTTPS
 * (solo lo sviluppo su localhost usa HTTP). `path`/`maxAge` per-uso. */
export function authCookieOptions(maxAgeSeconds: number, path = '/'): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(webOrigin()).protocol === 'https:',
    path,
    maxAge: maxAgeSeconds,
  }
}

// Sessione staff LONG-LIVED con refresh rolling (vedi middleware/auth.ts): la
// scadenza viene rinnovata a ogni uso, quindi finché usi Tako non ti disconnette.
export const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 90 // 90 giorni
// Sessioni 'mobile' (telefoni collegati, elencati in «Dispositivi»): 30 giorni con
// lo stesso refresh rolling. Non viaggiano mai in un cookie: solo Bearer.
export const MOBILE_SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 giorni
// Ogni quanto (al massimo) rinnovare la scadenza di una sessione staff attiva:
// evita una UPDATE a ogni richiesta, rinnova al più una volta al giorno.
export const SESSION_REFRESH_AFTER_MS = 60 * 60 * 24 * 1000 // 1 giorno
export const TABLE_SESSION_MAX_AGE = 60 * 60 * 4       // 4 ore
