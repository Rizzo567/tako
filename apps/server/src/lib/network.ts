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
 * IPv4 LAN "primario": preferisce i range privati reali (WiFi di casa, hotspot)
 * e scarta il link-local (169.254.x). Serve a costruire URL che il telefono del
 * cliente può raggiungere sulla stessa rete del Mac.
 */
export function primaryLanIPv4(): string | null {
  const all = getLanIPv4s().filter((ip) => !ip.startsWith('169.254.'))
  const isPrivate = (ip: string) =>
    /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  return all.find(isPrivate) ?? all[0] ?? null
}

/**
 * Base URL dell'app cliente (web PWA) usato nei QR dei tavoli.
 * DINAMICO: ricalcolato dall'IP LAN corrente del Mac a ogni richiesta, così i QR
 * restano validi quando cambia il WiFi senza riavviare nulla.
 * Override esplicito solo via CLIENT_BASE_URL (dominio fisso / reverse proxy).
 * Porta del client configurabile via CLIENT_PORT (default 3002).
 */
export function clientBaseUrl(): string {
  const override = process.env['CLIENT_BASE_URL']?.trim()
  if (override) return override.replace(/\/+$/, '')
  const port = process.env['CLIENT_PORT'] ?? '3002'
  const ip = primaryLanIPv4() ?? 'localhost'
  return `http://${ip}:${port}`
}
