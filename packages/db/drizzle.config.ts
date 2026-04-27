import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://tako:tako@localhost:5432/takodb',
  },
} satisfies Config
