import postgres from 'postgres'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, chmod, copyFile, readdir, lstat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareWebSchema } from './prepare-web-schema.mjs'

export const excludedTables = ['sessions', 'table_sessions', 'device_enroll_codes', 'push_subscriptions', 'web_session_locations', 'web_password_resets']
const tables = prepareWebSchema().tables.filter((table) => !excludedTables.includes(table))
const digest = (value) => createHash('sha256').update(value).digest('hex')
const connect = (url) => {
  const parsed = new URL(url)
  const local = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)
  let ssl
  if (!local) {
    if (!process.env.DATABASE_CA_CERT_PATH) throw new Error('Managed database requires DATABASE_CA_CERT_PATH and verified TLS')
    ssl = { rejectUnauthorized: true, ca: readFileSync(process.env.DATABASE_CA_CERT_PATH, 'utf8') }
    parsed.searchParams.delete('sslmode')
  }
  return postgres(parsed.toString(), { max: 1, onnotice: () => {}, ...(ssl ? { ssl } : {}) })
}

async function columns(sql, table) {
  return (await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} ORDER BY ordinal_position`)
    .map((column) => ({ name: column.column_name, type: column.data_type }))
}

async function orderTables(sql) {
  const edges = await sql`SELECT child.relname AS child, parent.relname AS parent FROM pg_constraint con
    JOIN pg_class child ON child.oid=con.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=con.confrelid WHERE con.contype='f' AND n.nspname='public'`
  const ordered = [], pending = new Set(tables)
  while (pending.size) {
    const ready = [...pending].filter((table) => !edges.some((edge) => edge.child === table && edge.parent !== table && pending.has(edge.parent)))
    if (!ready.length) throw new Error('Foreign-key cycle: reviewed import strategy required')
    for (const table of ready.sort()) { ordered.push(table); pending.delete(table) }
  }
  return ordered
}

export async function inspectSource(url) {
  const sql = connect(url)
  try {
    return await sql.begin('isolation level repeatable read read only', async (tx) => {
      const counts = {}
      for (const table of tables) counts[table] = Number((await tx`SELECT count(*) AS count FROM ${tx('public.' + table)}`)[0].count)
      const [credentials] = await tx`SELECT count(*)::int AS owners, count(password_hash)::int AS classic_hashes,
        count(local_owner_secret_hash)::int AS appliance_hashes FROM users WHERE role='owner' AND active=true`
      const duplicateEmails = await tx`SELECT count(*)::int AS count FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*)>1) d`
      const [staff] = await tx`SELECT count(*)::int AS active_staff_missing_password FROM users WHERE role<>'owner' AND active=true AND password_hash IS NULL`
      return { counts, credentials, activeStaffMissingPassword: staff.active_staff_missing_password, duplicateEmailGroups: duplicateEmails[0].count, excludedTables }
    })
  } finally { await sql.end() }
}

async function copyImages(uploadRoot, destination, restaurantIds) {
  const images = []
  for (const restaurantId of restaurantIds) {
    const directory = resolve(uploadRoot, restaurantId)
    if (relative(resolve(uploadRoot), directory).startsWith('..')) throw new Error('Invalid tenant upload path')
    let entries
    try { entries = await readdir(directory) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    await mkdir(join(destination, 'images', restaurantId), { recursive: true, mode: 0o700 })
    for (const filename of entries.sort()) {
      const source = join(directory, filename)
      const stat = await lstat(source)
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Uploads contain unsupported directory/symlink')
      const buffer = await readFile(source)
      await copyFile(source, join(destination, 'images', restaurantId, filename))
      await chmod(join(destination, 'images', restaurantId, filename), 0o600)
      images.push({ path: `${restaurantId}/${filename}`, bytes: buffer.length, sha256: digest(buffer) })
    }
  }
  return images
}

export async function exportSource(url, destination, uploadRoot) {
  destination = resolve(destination)
  await mkdir(destination, { mode: 0o700 }) // Refuse overwriting any earlier backup.
  await chmod(destination, 0o700)
  const sql = connect(url)
  try {
    const snapshot = await sql.begin('isolation level repeatable read read only', async (tx) => {
      const result = { version: 1, exportedAt: new Date().toISOString(), excludedTables, tables: [] }
      for (const table of await orderTables(tx)) {
        const schema = await columns(tx, table)
        const sortColumn = schema.some(column => column.name === 'id') ? 'id' : schema[0].name
        const rows = await tx`SELECT * FROM ${tx('public.' + table)} ORDER BY ${tx(sortColumn)}`
        result.tables.push({ name: table, columns: schema, rows })
      }
      return result
    })
    const payload = JSON.stringify(snapshot)
    await writeFile(join(destination, 'data.json'), payload, { mode: 0o600, flag: 'wx' })
    const restaurantIds = snapshot.tables.find((table) => table.name === 'restaurants').rows.map((row) => row.id)
    const images = uploadRoot ? await copyImages(uploadRoot, destination, restaurantIds) : []
    const manifest = { version: 1, dataSha256: digest(payload), exportedAt: snapshot.exportedAt,
      counts: Object.fromEntries(snapshot.tables.map((table) => [table.name, table.rows.length])), excludedTables,
      imagesIncluded: !!uploadRoot, images }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' })
    return { destination, counts: manifest.counts, imageCount: images.length, imageBytes: images.reduce((sum, image) => sum + image.bytes, 0), dataSha256: manifest.dataSha256 }
  } finally { await sql.end() }
}

export async function importSnapshot(url, destination, expectedTargetHost, expectedTargetDatabase, allowedExistingRestaurantIds = [], expectedTargetUser = process.env.EXPECTED_TARGET_USER) {
  const parsed = new URL(url)
  if (!expectedTargetHost || parsed.hostname !== expectedTargetHost || !expectedTargetDatabase || decodeURIComponent(parsed.pathname.slice(1)) !== expectedTargetDatabase || !expectedTargetUser || decodeURIComponent(parsed.username) !== expectedTargetUser) {
    throw new Error('Explicit expected target host, database and project-qualified user must match the destination')
  }
  destination = resolve(destination)
  const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'))
  const payload = await readFile(join(destination, 'data.json'), 'utf8')
  if (manifest.version !== 1 || digest(payload) !== manifest.dataSha256) throw new Error('Backup integrity check failed')
  const snapshot = JSON.parse(payload)
  if (snapshot.version !== 1 || snapshot.tables.length !== tables.length || new Set(snapshot.tables.map((table) => table.name)).size !== tables.length || snapshot.tables.some((table) => !tables.includes(table.name))) throw new Error('Invalid or incomplete operational snapshot')
  if (manifest.normalization) {
    if (manifest.normalization.report !== 'normalization-report.json'
      || digest(await readFile(join(destination, 'normalization-report.json'))) !== manifest.normalization.reportSha256) throw new Error('Normalization report integrity check failed')
  }
  for (const image of manifest.images) {
    const path = resolve(destination, 'images', image.path)
    if (!path.startsWith(resolve(destination, 'images') + sep)) throw new Error('Invalid image backup path')
    const contents = await readFile(path)
    if (digest(contents) !== image.sha256 || contents.length !== image.bytes) throw new Error('Image backup integrity check failed')
  }
  const sql = connect(url)
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('tako-web-data-import'))`
      if (allowedExistingRestaurantIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new Error('Existing tenant allowlist must contain explicit UUIDs')
      const existingRestaurants = await tx`SELECT id FROM restaurants`
      if (existingRestaurants.some((restaurant) => !allowedExistingRestaurantIds.includes(restaurant.id))) throw new Error('Import target is not empty; automatic merge/overwrite refused')
      if (!allowedExistingRestaurantIds.length) {
        for (const name of [...tables, ...excludedTables]) {
          if (Number((await tx`SELECT count(*) AS count FROM ${tx('public.' + name)}`)[0].count)) throw new Error('Import target is not empty; automatic merge/overwrite refused')
        }
      }
      // An explicit reviewed QA tenant may coexist, but NEVER overwrite an ID.
      for (const table of snapshot.tables) {
        const ids = table.columns.some(column=>column.name==='id') ? table.rows.map((row) => row.id) : []
        if (ids.length && (await tx`SELECT id FROM ${tx('public.' + table.name)} WHERE id IN ${tx(ids)} LIMIT 1`).length) throw new Error('Source UUID already exists in target; overwrite refused')
      }
      const byName = new Map(snapshot.tables.map((table) => [table.name, table]))
      const counts = {}
      for (const name of await orderTables(tx)) {
        const table = byName.get(name)
        if (JSON.stringify(await columns(tx, name)) !== JSON.stringify(table.columns)) throw new Error('Source and target operational columns differ')
        const names = table.columns.map((column) => column.name)
        let insertedCount=0
        for (let start = 0; start < table.rows.length; start += 100) {
          const rows = table.rows.slice(start, start + 100)
          const inserted=await tx`INSERT INTO ${tx('public.' + name)} ${tx(rows, ...names)} RETURNING *`
          insertedCount+=inserted.length
        }
        counts[name] = insertedCount
        if (counts[name] !== manifest.counts[name]) throw new Error('Imported count differs from snapshot')
      }
      const duplicates = await tx`SELECT count(*)::int AS count FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*)>1) d`
      if (duplicates[0].count) throw new Error('Case-insensitive duplicate user emails: resolve in reviewed staging before import')
      return { counts, excludedTables, imageCount: manifest.images.length, imagesUploaded: false }
    })
  } finally { await sql.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, destination, confirmation] = process.argv.slice(2)
  try {
    let result
    if (mode === 'inspect' && process.env.SOURCE_DATABASE_URL) result = await inspectSource(process.env.SOURCE_DATABASE_URL)
    else if (mode === 'export' && destination && process.env.SOURCE_DATABASE_URL) result = await exportSource(process.env.SOURCE_DATABASE_URL, destination, process.env.SOURCE_UPLOADS_DIR)
    else if (mode === 'import' && destination && confirmation === '--execute' && process.env.TARGET_DATABASE_URL) result = await importSnapshot(process.env.TARGET_DATABASE_URL, destination, process.env.EXPECTED_TARGET_HOST, process.env.EXPECTED_TARGET_DATABASE, process.env.ALLOWED_EXISTING_RESTAURANT_IDS?.split(',').filter(Boolean) ?? [])
    else throw new Error('Usage: inspect | export /private/new-backup | import /private/backup --execute; set scoped database environment variables')
    console.log(JSON.stringify(result)) // Counts and integrity metadata only.
  } catch (error) {
    // PostgreSQL errors can include private row details or connection strings.
    console.error(JSON.stringify({ error: error.code ?? 'TRANSFER_REFUSED', message: error.code ? 'Database operation failed; inspect privately' : error.message }))
    process.exitCode = 1
  }
}
