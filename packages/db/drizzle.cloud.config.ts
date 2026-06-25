import type { Config } from 'drizzle-kit'

// Config Drizzle DEDICATA al control-plane cloud. Punta SOLO allo schema cloud
// e a una cartella di migrazioni separata, così le tabelle `cloud_*` non finiscono
// mai nel DB locale (appliance) e viceversa. Vedi MASTER_PLAN-cloud-auth §2.1/§3.1.
export default {
  schema: './src/schema/cloud/*.ts',
  out: './src/migrations-cloud',
  dialect: 'postgresql',
  dbCredentials: {
    // DATABASE_URL del Postgres cloud (Neon EU). Mai puntato al DB locale.
    url: process.env['DATABASE_URL'] ?? 'postgresql://tako:tako@localhost:5432/takodb',
  },
} satisfies Config
