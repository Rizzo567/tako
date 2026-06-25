// Client Drizzle CLOUD (control-plane identità) — SEPARATO dal client locale.
// ISOLAMENTO (MASTER_PLAN-cloud-auth §3 / contratto database-cloud-identity):
//  - usa lo schema cloud (`@tako/db/schema/cloud`), MAI lo schema locale;
//  - usa `CLOUD_DATABASE_URL` (env DISTINTA da DATABASE_URL): non deve MAI puntare
//    al Postgres locale dell'appliance. Se manca, il modo cloud non parte.
// Il client è lazy come quello locale: la connessione si apre alla prima query.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as cloudSchema from '@tako/db/schema/cloud'

type CloudDrizzle = ReturnType<typeof drizzle<typeof cloudSchema>>

let _cloudDb: CloudDrizzle | null = null

function real(): CloudDrizzle {
  if (!_cloudDb) {
    const connectionString = process.env['CLOUD_DATABASE_URL']
    if (!connectionString) {
      // Fail-fast: in modo cloud questa env è obbligatoria. Senza, rischieremmo di
      // scrivere identità cloud sul DB locale dell'appliance (mai accettabile).
      throw new Error('CLOUD_DATABASE_URL è obbligatoria in TAKO_MODE=cloud')
    }
    _cloudDb = drizzle(postgres(connectionString), { schema: cloudSchema })
  }
  return _cloudDb
}

// Proxy trasparente: ogni accesso inizializza il client al primo uso (come ./client.ts locale).
export const cloudDb: CloudDrizzle = new Proxy({} as CloudDrizzle, {
  get(_t, prop) {
    const r = real() as unknown as Record<string | symbol, unknown>
    const v = r[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(r) : v
  },
})

export type CloudDB = typeof cloudDb
// Re-export delle tabelle cloud così le route importano da un solo punto.
export {
  cloudOwners,
  cloudOauthAccounts,
  cloudEmailVerificationTokens,
  cloudPasswordResetTokens,
  cloudSessions,
  cloudRestaurants,
  cloudAppliances,
  cloudPairingCodes,
  cloudAuditLog,
} from '@tako/db/schema/cloud'
