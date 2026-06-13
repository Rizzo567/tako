// Cookie di autenticazione condivisi (HttpOnly). Centralizza nomi e opzioni così
// staff (sessione) e cliente (JWT tavolo) restano coerenti.
import type { CookieSerializeOptions } from '@fastify/cookie'

export const SESSION_COOKIE = 'tako_session' // token di sessione staff (opaco)
export const TABLE_COOKIE = 'tako_table'     // JWT legato al tavolo del cliente

const isProd = process.env['NODE_ENV'] === 'production'

/** Opzioni base: HttpOnly, SameSite=Lax, Secure in prod. `path`/`maxAge` per-uso. */
export function authCookieOptions(maxAgeSeconds: number, path = '/'): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path,
    maxAge: maxAgeSeconds,
  }
}

export const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 giorni
export const TABLE_SESSION_MAX_AGE = 60 * 60 * 4       // 4 ore
