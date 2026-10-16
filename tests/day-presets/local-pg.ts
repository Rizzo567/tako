/** Postgres locale usa-e-getta per i test F2: initdb in una cartella temporanea, migrazioni reali del repo
 * (packages/db + scripts/serverless/menu-day-presets.sql + trigger live del compito 2 con realtime.send finto).
 * Nessun DB reale, nessuna rete. */
import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import postgres from 'postgres'

const BIN = process.env.TAKO_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin/'
const ROOT = resolve(import.meta.dirname, '../..')

export async function startLocalPg(port: number) {
 const dir = mkdtempSync(tmpdir() + '/tako-presets-')
 writeFileSync(dir + '/.metadata_never_index', '')
 const run = (name: string, args: string[]) => execFileSync(BIN + name, args, { stdio: 'pipe' })
 run('initdb', ['-D', dir + '/data', '-A', 'trust', '--no-locale', '--encoding=UTF8'])
 run('pg_ctl', ['-D', dir + '/data', '-l', dir + '/log', '-o', `-k ${dir} -p ${port} -h 127.0.0.1`, '-w', 'start'])
 const url = `postgresql://${process.env.USER}@127.0.0.1:${port}/postgres`
 const client = postgres(url, { max: 1, onnotice: () => {} })
 await client.unsafe(`CREATE ROLE takomenu_runtime NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;`)
 const migrations = resolve(ROOT, 'packages/db/src/migrations')
 for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort())
  for (const statement of readFileSync(resolve(migrations, f), 'utf8').split('--> statement-breakpoint')) if (statement.trim()) await client.unsafe(statement)
 // Realtime finto: registra ogni broadcast del live (compito 2) invece di inviarlo.
 await client.unsafe(`CREATE SCHEMA realtime; CREATE TABLE realtime.sent(id serial PRIMARY KEY,topic text,payload jsonb,at timestamptz DEFAULT clock_timestamp());
  CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO realtime.sent(topic,payload) VALUES(topic,payload) $$;`)
 await client.unsafe(readFileSync(resolve(ROOT, 'docs/webapp/apri-menu-e-live-2026-10-16/compito-2/sql/up.sql'), 'utf8').replace(/(drop|create) policy[\s\S]*?;\s*/gi, ''))
 await client.unsafe(readFileSync(resolve(ROOT, 'scripts/serverless/menu-day-presets.sql'), 'utf8'))
 const stop = async () => { await client.end({ timeout: 1 }).catch(() => {}); try { run('pg_ctl', ['-D', dir + '/data', '-m', 'immediate', 'stop']) } catch { /* già fermo */ } rmSync(dir, { recursive: true, force: true }) }
 return { url, client, stop }
}
