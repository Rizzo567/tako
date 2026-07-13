// Indirizzi LAN del device host: servono per dire ai tablet/telefoni a quale
// URL collegarsi (schermata "collega dispositivi" dell'onboarding).
import { networkInterfaces } from 'os'

/** IPv4 non-loopback delle interfacce attive (es. WiFi del ristorante). */
export function getLanIPv4s(): string[] {
  const nets = networkInterfaces()
  const out: string[] = []
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address)
    }
  }
  return out
}

/**
 * IPv4 privato RFC1918 ben formato. Doppio uso:
 *  - appliance: validare l'IP LAN prima di pubblicarlo al cloud via heartbeat;
 *  - cloud (resolver /t/:id): reindirizzare SOLO a indirizzi LAN → chiude l'open-redirect
 *    (un IP pubblico arbitrario trasformerebbe il resolver in redirect di phishing).
 */
export function isPrivateLanIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim())
  if (!m) return false
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = o as [number, number, number, number]
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

/**
 * IPv4 LAN "primario": preferisce i range privati reali (WiFi del locale, hotspot) e
 * scarta il link-local (169.254.x). È l'indirizzo che il telefono del cliente può
 * raggiungere sulla stessa rete del box.
 */
export function primaryLanIPv4(): string | null {
  const all = getLanIPv4s().filter((ip) => !ip.startsWith('169.254.'))
  return all.find(isPrivateLanIPv4) ?? all[0] ?? null
}

/** Porta della PWA cliente (default 3002), configurabile via CLIENT_PORT. */
export function clientPort(): number {
  const p = Number(process.env['CLIENT_PORT'] ?? '3002')
  return Number.isInteger(p) && p > 0 && p < 65536 ? p : 3002
}

/**
 * Hostname mDNS dell'appliance (`tako.local`): nome LAN STABILE che sopravvive ai cambi
 * di IP e funziona anche col cloud irraggiungibile (richiede supporto mDNS sul device).
 * Coerente con lib/mdns.ts (label default `tako`).
 */
export function mdnsHost(): string {
  const label = (process.env['MDNS_LABEL'] ?? 'tako').trim() || 'tako'
  return `${label}.local`
}

/**
 * Base URL della PWA cliente via IP LAN CORRENTE. Fallback diretto/offline usato quando
 * l'appliance non è ancora accoppiata al cloud. Override esplicito via CLIENT_BASE_URL.
 */
export function clientBaseUrl(): string {
  const override = process.env['CLIENT_BASE_URL']?.trim()
  if (override) return override.replace(/\/+$/, '')
  const ip = primaryLanIPv4() ?? 'localhost'
  return `http://${ip}:${clientPort()}`
}

/**
 * Base URL pubblica del resolver cloud del QR stabile. Default: il control-plane su
 * api.takoitalia.com (dove vive la route /t/:applianceId/*). Override via PUBLIC_BASE_URL
 * (es. https://takoitalia.com se un redirect Cloudflare inoltra /t/* all'API).
 */
export function publicBaseUrl(): string {
  return (process.env['PUBLIC_BASE_URL']?.trim() || 'https://api.takoitalia.com').replace(/\/+$/, '')
}

/** Percorso locale della PWA cliente per un tavolo (senza slash iniziale). */
function tablePath(localRestaurantId: string, qrToken: string): string {
  return `r/${localRestaurantId}/t/${qrToken}`
}

/**
 * URL STABILE da stampare/plastificare nel QR del tavolo — NON contiene MAI l'IP.
 *  - Appliance ACCOPPIATA (applianceId noto): URL cloud stabile
 *    `${publicBaseUrl}/t/<applianceId>/r/<restaurantId>/t/<qrToken>`; il resolver cloud
 *    reindirizza all'IP LAN CORRENTE (pubblicato via heartbeat). Il QR non muore più al
 *    cambio IP del router.
 *  - NON accoppiata: fallback storico all'IP LAN corrente (nessuna regressione offline).
 * Il qrToken è stabile finché non lo si ruota (rotazione ⇒ ristampa, comportamento atteso).
 */
export function stableTableUrl(applianceId: string | null, localRestaurantId: string, qrToken: string): string {
  const path = tablePath(localRestaurantId, qrToken)
  if (applianceId) return `${publicBaseUrl()}/t/${applianceId}/${path}`
  return `${clientBaseUrl()}/${path}`
}

/**
 * URL LAN di BACKUP basato sul nome mDNS (`tako.local`): stabile sulla LAN e funzionante
 * anche col CLOUD IRRAGGIUNGIBILE. Da stampare come QR secondario "di riserva" nel locale
 * per garantire l'accesso offline-first quando il control-plane è giù ma il cliente è in WiFi.
 */
export function lanTableUrl(localRestaurantId: string, qrToken: string): string {
  return `http://${mdnsHost()}:${clientPort()}/${tablePath(localRestaurantId, qrToken)}`
}

/**
 * URL LAN basato sull'IP CORRENTE del Mac (es. http://192.168.1.50:3002/...). Per i pochi
 * telefoni senza supporto mDNS: funziona offline e su qualunque device, ma l'IP deve essere
 * reso stabile con una DHCP reservation sul router (vedi docs/setup-rete-ristorante.md),
 * altrimenti il QR muore al cambio IP.
 */
export function ipTableUrl(localRestaurantId: string, qrToken: string): string {
  return `${clientBaseUrl()}/${tablePath(localRestaurantId, qrToken)}`
}

/** Modalità del QR tavolo. 'lan' = resiliente a internet giù (mDNS tako.local); 'cloud' = resolver pubblico. */
export type QrMode = 'lan' | 'cloud'

/**
 * Sceglie l'URL da INCODARE nel QR del tavolo secondo la modalità del ristorante.
 * Default 'lan' (LAN-first): il menu si apre anche con l'uplink internet giù, purché il
 * telefono sia sul WiFi del locale. 'cloud' usa il resolver pubblico (richiede internet ma
 * non richiede mDNS sul telefono). Vedi la decisione LAN-first per la resilienza in sala.
 */
export function tableQrUrl(mode: QrMode, applianceId: string | null, localRestaurantId: string, qrToken: string): string {
  return mode === 'cloud'
    ? stableTableUrl(applianceId, localRestaurantId, qrToken)
    : lanTableUrl(localRestaurantId, qrToken)
}
