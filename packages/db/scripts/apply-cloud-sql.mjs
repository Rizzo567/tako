// Applica lo schema cloud (cloud_*) al Postgres cloud (Supabase/Neon) leggendo il file
// di migrazione esatto — niente copia-incolla manuale. Idempotente (IF NOT EXISTS).
//
// Uso (dalla root del monorepo del worktree cloud):
//   CLOUD_DATABASE_URL='postgresql://...5432/postgres' node packages/db/scripts/apply-cloud-sql.mjs
//
// Usa la connessione con porta 5432 (session pooler/diretta), NON la 6543.

import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const url = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('❌ Manca CLOUD_DATABASE_URL (o DATABASE_URL). Esempio:')
  console.error("   CLOUD_DATABASE_URL='postgresql://...:5432/postgres' node packages/db/scripts/apply-cloud-sql.mjs")
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const sqlFile = join(here, '..', 'src', 'migrations-cloud', '0000_init_cloud_identity.sql')
const raw = readFileSync(sqlFile, 'utf8')

// Rimuove le righe di commento, poi separa le singole istruzioni sul ';'.
// La nostra DDL non contiene corpi con $$ o ';' interni → split sicuro.
const cleaned = raw
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
const statements = cleaned.split(';').map((s) => s.trim()).filter((s) => s.length > 0)

const sql = postgres(url, { ssl: 'require', max: 1 })

let ok = 0
try {
  for (const st of statements) {
    await sql.unsafe(st)
    ok++
  }
  console.log(`✅ Schema cloud applicato: ${ok} istruzioni eseguite.`)
  const rows = await sql`select table_name from information_schema.tables where table_schema='public' and table_name like 'cloud_%' order by table_name`
  console.log('   Tabelle cloud presenti:', rows.map((r) => r.table_name).join(', '))
} catch (e) {
  console.error(`❌ Errore dopo ${ok} istruzioni:`, e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
