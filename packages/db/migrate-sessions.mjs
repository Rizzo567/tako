import postgres from 'postgres'
import { readFileSync } from 'fs'

const sql = postgres('postgresql://tako:tako@localhost:5432/takodb')
const migration = readFileSync('./src/migrations/0005_add_table_sessions.sql', 'utf8')
await sql.unsafe(migration)
console.log('Migration 0005 applied: table_sessions created')
await sql.end()
