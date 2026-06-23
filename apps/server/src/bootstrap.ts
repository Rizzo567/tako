// Entry point del server. Avvia il DB embedded (se EMBEDDED_DB=1) e ne imposta
// DATABASE_URL *prima* di importare il server vero (./index.js), così il client
// Drizzle — che legge DATABASE_URL al momento dell'import — punta al DB giusto.
//
// L'ordine è critico: ./index.js importa le route che importano @tako/db (client),
// e quell'import cattura la connection string. Per questo lo carichiamo con import
// dinamico DOPO aver avviato il DB.
import { maybeStartEmbeddedDb } from '@tako/db/embedded'

await maybeStartEmbeddedDb()
await import('./index.js')
