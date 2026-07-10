import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:5432/takodb')
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`
console.log('Migration 0004 applied: phone column added to users')
await sql.end()
