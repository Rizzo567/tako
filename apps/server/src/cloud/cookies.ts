// Cookie e CSRF per il modo cloud. Distinti da lib/cookies.ts (modo local), così il
// comportamento locale resta intatto.
// COOKIE_MODE governa SameSite e CSRF (§7):
//  - 'samesite' (default): sessione su sottodominio/same-site → SameSite=Lax basta,
//    niente token CSRF (il browser non invia il cookie su POST cross-site).
//  - 'crosssite': front-end e API su origin diverse → serve SameSite=None;Secure +
//    difesa CSRF esplicita (double-submit token: header X-Tako-CSRF == cookie).
import type { CookieSerializeOptions } from '@fastify/cookie'
import { cookieMode } from './config.js'

export const CLOUD_SESSION_COOKIE = 'tako_cloud_session' // token opaco di sessione owner
export const CLOUD_CSRF_COOKIE = 'tako_cloud_csrf'       // token CSRF double-submit (crosssite)
export const CSRF_HEADER = 'x-tako-csrf'

// In crosssite i cookie DEVONO essere Secure (i browser rifiutano SameSite=None senza Secure).
const cookieSecure = process.env['COOKIE_SECURE'] === '1' || cookieMode() === 'crosssite'

/** Opzioni del cookie di sessione (HttpOnly). SameSite dipende da COOKIE_MODE. */
export function cloudSessionCookieOptions(maxAgeSeconds: number): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: cookieMode() === 'crosssite' ? 'none' : 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

/** Cookie CSRF: NON HttpOnly (il client lo legge per rimandarlo nell'header). */
export function csrfCookieOptions(maxAgeSeconds: number): CookieSerializeOptions {
  return {
    httpOnly: false,
    sameSite: cookieMode() === 'crosssite' ? 'none' : 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}
