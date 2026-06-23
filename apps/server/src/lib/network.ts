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
