// Entry point DEDICATO al modo cloud (control-plane identità — TAKO_MODE=cloud).
// Distinto da ../bootstrap.ts (modo local) di proposito:
//
//  - bootstrap.ts importa STATICAMENTE `@tako/db/embedded` (→ `embedded-postgres`,
//    una dipendenza nativa pesante usata solo dall'appliance locale). In un container
//    cloud non vogliamo nemmeno caricare quel modulo: qui NON lo importiamo affatto.
//  - In cloud i segreti arrivano SOLO da env/secret-manager (Fly secrets): non
//    auto-provvisioniamo JWT_SECRET su filesystem (SEC-010). Le validazioni fail-fast
//    (SESSION_SECRET, CLOUD_DATABASE_URL, RESEND_API_KEY) sono dentro startCloudServer().
//
// startServer() rileva isCloudMode() e instrada su startCloudServer(); qui imponiamo
// comunque TAKO_MODE=cloud per sicurezza, così l'entrypoint è auto-consistente anche
// se l'orchestratore del container dimentica la env (il Dockerfile la setta lo stesso).
import { startServer } from '../index.js'

if ((process.env['TAKO_MODE'] ?? '').toLowerCase() !== 'cloud') {
  // Non sovrascriviamo a sorpresa un valore esplicito diverso: segnaliamo l'incoerenza.
  if (process.env['TAKO_MODE']) {
    throw new Error(
      `entry.ts è l'entrypoint CLOUD ma TAKO_MODE="${process.env['TAKO_MODE']}". Avvia bootstrap.ts per il modo local.`,
    )
  }
  process.env['TAKO_MODE'] = 'cloud'
}

await startServer()
