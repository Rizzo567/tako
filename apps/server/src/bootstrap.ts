// Entry point della webapp (TAKO_MODE=web): valida la configurazione ospitata
// (DB gestito, origine pubblica, segreti forti) e avvia il server. I segreti
// arrivano solo dall'ambiente (.env.web in locale, variabili Render in produzione).
import { startServer } from './index.js'
import { validateWebRuntime } from './lib/web-runtime.js'

validateWebRuntime()
await startServer()
