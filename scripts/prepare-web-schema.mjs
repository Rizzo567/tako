import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const operationalMigrationsDirectory = resolve(repositoryRoot, 'packages/db/src/migrations')
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`
const identifier = (value) => `"${value.replaceAll('"', '""')}"`

export function prepareWebSchema(migrationsDirectory = operationalMigrationsDirectory) {
  const journal = JSON.parse(readFileSync(resolve(migrationsDirectory, 'meta/_journal.json'), 'utf8'))
  if (journal.dialect !== 'postgresql' || !journal.entries.length) throw new Error('Invalid operational migration journal')
  const migrations = journal.entries.map((entry, index) => {
    if (entry.idx !== index || !/^[a-z0-9_]+$/.test(entry.tag) || !Number.isSafeInteger(entry.when)) throw new Error('Invalid migration ordering or tag')
    if (index && entry.when <= journal.entries[index - 1].when) throw new Error('Migration timestamps must increase')
    const sql = readFileSync(resolve(migrationsDirectory, `${entry.tag}.sql`), 'utf8')
    let executedSql = sql
    if (entry.tag === '0002_add_rls') {
      const marker = '-- 3. Application role (non-superuser)'
      const markerPosition = sql.indexOf(marker)
      if (markerPosition === -1 || !sql.slice(markerPosition).includes("CREATE ROLE tako_app LOGIN PASSWORD 'change_in_production'")) {
        throw new Error('Legacy role block changed: review the hosted transformation before generating SQL')
      }
      executedSql = sql.slice(0, markerPosition) + '-- Hosted bootstrap omits appliance role provisioning and its grants.\n'
    }
    return { ...entry, sql, executedSql, hash: createHash('sha256').update(sql).digest('hex'), executedHash: createHash('sha256').update(executedSql).digest('hex') }
  })
  const tables = [...new Set(migrations.flatMap(({ sql }) => [...sql.matchAll(/^\s*CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?"?([a-z_]+)"?/gm)].map((match) => match[1])))].sort()
  if (!tables.includes('restaurants') || !tables.includes('users')) throw new Error('Operational tables missing')
  const tableArray = `ARRAY[${tables.map(literal).join(', ')}]::text[]`
  const history = migrations.map(({ hash, when }) => `(${literal(hash)}, ${when})`).join(',\n  ')
  const sql = `-- Tako originale: operational database bootstrap, NEW dedicated project only.
-- Generated from the operational Drizzle journal; no seed, no credentials.
-- A pre-existing operational table or migration history aborts the transaction.
BEGIN;
SET LOCAL search_path = public;
SELECT pg_advisory_xact_lock(hashtext('tako-web-operational-bootstrap'));
DO $bootstrap_guard$
DECLARE existing_name text;
BEGIN
  SELECT c.relname INTO existing_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname=ANY(${tableArray}) LIMIT 1;
  IF existing_name IS NOT NULL THEN
    RAISE EXCEPTION 'Tako bootstrap refused: public.% already exists', existing_name;
  END IF;
  IF to_regclass('drizzle.__drizzle_migrations') IS NOT NULL OR to_regclass('public.__drizzle_migrations') IS NOT NULL THEN
    RAISE EXCEPTION 'Tako bootstrap refused: existing Drizzle migration history';
  END IF;
END
$bootstrap_guard$;

${migrations.map(({ tag, executedSql, executedHash }) => `-- Operational migration: ${tag}\n-- Executed SHA256: ${executedHash}\n${executedSql}`).join('\n\n')}

-- Match Drizzle's default history schema, table and SHA256 of original SQL bytes.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES
  ${history};

DO $web_privileges$
DECLARE recipient text; target record;
BEGIN
  FOR recipient IN SELECT 'PUBLIC' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    FOR target IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE (n.nspname='public' AND c.relname=ANY(${tableArray}))
         OR (n.nspname='drizzle' AND c.relname='__drizzle_migrations') LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %s', target.nspname, target.relname,
        CASE WHEN recipient='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(recipient) END);
    END LOOP;
    FOR target IN SELECT DISTINCT sn.nspname, seq.relname FROM pg_class seq
      JOIN pg_namespace sn ON sn.oid=seq.relnamespace
      JOIN pg_depend d ON d.objid=seq.oid AND d.deptype IN ('a','i')
      JOIN pg_class tab ON tab.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=tab.relnamespace
      WHERE seq.relkind='S' AND ((tn.nspname='public' AND tab.relname=ANY(${tableArray}))
        OR (tn.nspname='drizzle' AND tab.relname='__drizzle_migrations')) LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %s', target.nspname, target.relname,
        CASE WHEN recipient='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(recipient) END);
    END LOOP;
  END LOOP;
END
$web_privileges$;
COMMIT;
`
  return { sql, migrations, tables }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const destination = process.argv[2]
  if (!destination || process.argv.length !== 3) throw new Error('Usage: node scripts/prepare-web-schema.mjs /absolute/output.sql')
  const result = prepareWebSchema()
  writeFileSync(resolve(destination), result.sql, { mode: 0o600 })
  console.log(`Generated ${result.migrations.length} operational migrations, ${result.tables.length} tables: ${resolve(destination)}`)
}
