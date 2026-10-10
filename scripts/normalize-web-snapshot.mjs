import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, cp, chmod } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const sha = (data) => createHash('sha256').update(data).digest('hex')

export function uniqueCollisions(snapshot) {
  const specs = {
    restaurants: [['slug']], users: [['email']], tables: [['restaurant_id', 'number'], ['qr_token']],
    orders: [['idempotency_key']], menu_item_translations: [['item_id', 'lang']],
    loyalty_accounts: [['restaurant_id', 'phone']], recipes: [['menu_item_id', 'inventory_item_id']],
    waiter_calls: [['table_id']],
  }
  const collisions = []
  for (const table of snapshot.tables) {
    const constraints = [['id'], ...(specs[table.name] ?? [])]
    if (table.name === 'users') constraints.push(['email_case_insensitive'])
    for (const fields of constraints) {
      const seen = new Map()
      for (const row of table.rows) {
        if (table.name === 'waiter_calls' && fields[0] === 'table_id' && row.resolved_at !== null) continue
        const values = fields.map((field) => field === 'email_case_insensitive' ? row.email?.toLowerCase() : row[field])
        if (values.some((value) => value === null || value === undefined)) continue
        const key = JSON.stringify(values)
        if (seen.has(key)) collisions.push({ table: table.name, columns: fields, rowIds: [seen.get(key), row.id] })
        else seen.set(key, row.id)
      }
    }
  }
  return collisions
}

export async function normalizeTableLabels(sourceDirectory, destinationDirectory) {
  sourceDirectory = resolve(sourceDirectory); destinationDirectory = resolve(destinationDirectory)
  if (sourceDirectory === destinationDirectory) throw new Error('Original snapshot must remain unchanged')
  const payload = await readFile(join(sourceDirectory, 'data.json'), 'utf8')
  const manifest = JSON.parse(await readFile(join(sourceDirectory, 'manifest.json'), 'utf8'))
  if (sha(payload) !== manifest.dataSha256) throw new Error('Original backup integrity check failed')
  const snapshot = JSON.parse(payload)
  const tables = snapshot.tables.find((table) => table.name === 'tables')
  if (!tables) throw new Error('Missing tables snapshot')
  const collisions = uniqueCollisions(snapshot)
  if (collisions.some((entry) => entry.table !== 'tables' || entry.columns.join(',') !== 'restaurant_id,number')) {
    throw new Error('Other unique constraint collisions require separate review')
  }
  const groups = new Map(), occupied = new Map(), changes = []
  for (const row of tables.rows) {
    const key = JSON.stringify([row.restaurant_id, row.number])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
    if (!occupied.has(row.restaurant_id)) occupied.set(row.restaurant_id, new Set())
    occupied.get(row.restaurant_id).add(row.number)
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    // Preserve the active table in a real room first, then the oldest/lowest ID.
    group.sort((a, b) => Number(!!b.active) - Number(!!a.active)
      || Number(!!b.room_id) - Number(!!a.room_id)
      || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
      || a.id.localeCompare(b.id))
    for (const row of group.slice(1)) {
      const oldNumber = row.number
      let suffix = 2, number
      do { number = `${oldNumber}-${suffix++}` } while (occupied.get(row.restaurant_id).has(number))
      occupied.get(row.restaurant_id).add(number)
      changes.push({ tableId: row.id, restaurantId: row.restaurant_id, from: oldNumber, to: number })
      row.number = number
    }
  }
  if (uniqueCollisions(snapshot).length) throw new Error('Normalization left unique collisions')
  await mkdir(destinationDirectory, { mode: 0o700 })
  await cp(sourceDirectory, destinationDirectory, { recursive: true })
  await chmod(destinationDirectory, 0o700)
  const normalizedPayload = JSON.stringify(snapshot)
  const report = { version: 1, reason: 'Reviewed duplicate table labels: preserve IDs and historical order/bill labels',
    sourceDataSha256: manifest.dataSha256, changes, uniqueConstraintsChecked: true }
  const reportPayload = JSON.stringify(report, null, 2)
  manifest.dataSha256 = sha(normalizedPayload)
  manifest.normalization = { report: 'normalization-report.json', reportSha256: sha(reportPayload), sourceDataSha256: report.sourceDataSha256, renamedTableCount: changes.length }
  await writeFile(join(destinationDirectory, 'data.json'), normalizedPayload, { mode: 0o600 })
  await writeFile(join(destinationDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })
  await writeFile(join(destinationDirectory, 'normalization-report.json'), reportPayload, { mode: 0o600, flag: 'wx' })
  // Verify the original has not changed at any point in staging.
  if (sha(await readFile(join(sourceDirectory, 'data.json'))) !== report.sourceDataSha256) throw new Error('Original snapshot changed during staging')
  return { destination: destinationDirectory, renamedTableCount: changes.length, dataSha256: manifest.dataSha256, otherUniqueCollisions: 0 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: normalize-web-snapshot.mjs /original/backup /new/staged-backup')
    console.log(JSON.stringify(await normalizeTableLabels(process.argv[2], process.argv[3])))
  } catch (error) {
    console.error(JSON.stringify({ error: 'NORMALIZATION_REFUSED', message: error.message }))
    process.exitCode = 1
  }
}
