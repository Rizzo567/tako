import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://tako:tako@localhost:5432/takodb'

const queryClient = postgres(connectionString)
export const db = drizzle(queryClient, { schema })

export type DB = typeof db
