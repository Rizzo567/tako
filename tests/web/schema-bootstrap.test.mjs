import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
import { prepareWebSchema, operationalMigrationsDirectory } from '../../scripts/prepare-web-schema.mjs'

const require = createRequire(resolve('packages/db/package.json'))
const EmbeddedPostgres = require('embedded-postgres').default
const { drizzle } = require('drizzle-orm/postgres-js')
const { migrate } = require('drizzle-orm/postgres-js/migrator')
const prepared = prepareWebSchema()
let pg, directory, port
const clients = []

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'tako-bootstrap-verifier-'))
  const reservation = createServer()
  await new Promise((done, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', done) })
  port = reservation.address().port
  await new Promise((done) => reservation.close(done))
  pg = new EmbeddedPostgres({ databaseDir: join(directory, 'pg'), port, user: 'bootstrap_test', password: 'local-test-only', persistent: false, initdbFlags: ['--encoding=UTF8'], onLog: () => {}, onError: () => {} })
  await pg.initialise()
  await pg.start()
})

after(async () => {
  for (const client of clients) await client.end()
  if (pg) await pg.stop()
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function database(name) {
  await pg.createDatabase(name)
  const client = postgres(`postgresql://bootstrap_test:local-test-only@127.0.0.1:${port}/${name}`, { max: 1, onnotice: () => {} })
  clients.push(client)
  return client
}

test('actual bootstrap installs journal hashes, revokes public API roles, and Drizzle does not replay', async () => {
  const sql = await database('fresh_bootstrap')
  await sql.unsafe(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, PUBLIC;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, PUBLIC;
    CREATE SCHEMA auth; CREATE TABLE auth.sentinel(id int); INSERT INTO auth.sentinel VALUES(42);
    CREATE SCHEMA storage; CREATE TABLE storage.sentinel(id int); INSERT INTO storage.sentinel VALUES(84);`)
  await sql.unsafe(prepared.sql)
  assert.equal(prepared.sql.includes('CREATE ROLE tako_app'), false)
  assert.equal(prepared.sql.includes('change_in_production'), false)
  const rows = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`
  assert.deepEqual(rows.map((row) => ({ hash: row.hash, when: Number(row.created_at) })), prepared.migrations.map(({ hash, when }) => ({ hash, when })))
  assert.equal((await sql`SELECT count(*)::int AS count FROM restaurants`)[0].count, 0)
  assert.equal((await sql`SELECT count(*)::int AS count FROM users`)[0].count, 0)
  for (const table of prepared.tables) {
    const [privilege] = await sql`SELECT has_table_privilege('anon', ${`public.${table}`}, 'SELECT') AS anon_read,
      has_table_privilege('authenticated', ${`public.${table}`}, 'INSERT') AS authenticated_write`
    assert.equal(privilege.anon_read, false, table)
    assert.equal(privilege.authenticated_write, false, table)
  }
  assert.equal((await sql`SELECT has_sequence_privilege('anon','drizzle.__drizzle_migrations_id_seq','USAGE') AS allowed`)[0].allowed, false)
  assert.equal((await sql`SELECT count(*)::int AS count FROM pg_roles WHERE rolname='tako_app'`)[0].count, 0)
  assert.equal((await sql`SELECT id FROM auth.sentinel`)[0].id, 42)
  assert.equal((await sql`SELECT id FROM storage.sentinel`)[0].id, 84)
  // A replay would fail on CREATE TABLE restaurants. A clean successful migrate
  // with identical history proves the manually applied journal is recognized.
  await migrate(drizzle(sql), { migrationsFolder: operationalMigrationsDirectory })
  assert.deepEqual(await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`, rows)
  await assert.rejects(sql.unsafe(prepared.sql), /bootstrap refused/)
  await sql.unsafe('ROLLBACK')
  assert.equal((await sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`)[0].count, prepared.migrations.length)
})

test('partial operational schema causes an atomic refusal without replacing data', async () => {
  const sql = await database('existing_table')
  await sql.unsafe('CREATE TABLE restaurants(id int); INSERT INTO restaurants VALUES(123)')
  await assert.rejects(sql.unsafe(prepared.sql), /public.restaurants already exists/)
  await sql.unsafe('ROLLBACK')
  assert.equal((await sql`SELECT id FROM restaurants`)[0].id, 123)
  assert.equal((await sql`SELECT to_regclass('public.users') AS name`)[0].name, null)
})

test('even empty pre-existing Drizzle history refuses bootstrap', async () => {
  const sql = await database('existing_history')
  await sql.unsafe('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id int)')
  await assert.rejects(sql.unsafe(prepared.sql), /existing Drizzle migration history/)
  await sql.unsafe('ROLLBACK')
  assert.equal((await sql`SELECT to_regclass('public.restaurants') AS name`)[0].name, null)
})
