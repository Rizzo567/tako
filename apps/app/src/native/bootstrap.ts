// Ponte fra l'index (che risolve endpoint e sessione) e il gruppo (tabs).
//
// expo-router monta i layout per conto suo: il gruppo nativo non può ricevere
// props dall'index. L'index scrive qui PRIMA di navigare; il layout delle tab
// legge e, se non trova nulla (deep link freddo su /oggi, reload in sviluppo),
// rimanda alla radice dove la decisione nativo/WebView si rifà da capo.
import type { Session } from './session'

interface Boot {
  session: Session
  base: string
}

let boot: Boot | null = null

export function setNativeBoot(b: Boot): void { boot = b }
export function getNativeBoot(): Boot | null { return boot }
export function clearNativeBoot(): void { boot = null }

// Dopo "Scollega questo telefono" l'index NON deve re-importare la sessione che
// vive nel localStorage della WebView (è un altro device token, ancora valido):
// senza questo freno il logout rimbalzerebbe subito dentro. Vale per il processo
// corrente: al prossimo avvio l'import torna lecito, che è il comportamento
// giusto per un telefono ancora arruolato via QR.
let skipWebImport = false

export function disableWebImport(): void { skipWebImport = true }
export function webImportDisabled(): boolean { return skipWebImport }
