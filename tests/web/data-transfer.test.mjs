import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'
import { prepareWebSchema } from '../../scripts/prepare-web-schema.mjs'
import { inspectSource, exportSource, importSnapshot } from '../../scripts/web-data-transfer.mjs'
import { normalizeTableLabels, uniqueCollisions } from '../../scripts/normalize-web-snapshot.mjs'

const require = createRequire(resolve('packages/db/package.json'))
const EmbeddedPostgres = require('embedded-postgres').default

test('real read-only export and atomic empty-target import preserve IDs, hashes, FK and files; omit tokens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tako-transfer-test-'))
  const reservation = createServer()
  await new Promise((done) => reservation.listen(0, '127.0.0.1', done))
  const port = reservation.address().port
  await new Promise((done) => reservation.close(done))
  const pg = new EmbeddedPostgres({ databaseDir: join(directory, 'pg'), port, user: 'transfer_test', password: 'isolated-only', persistent: false, onLog: () => {}, onError: () => {} })
  let source, target
  try {
    await pg.initialise(); await pg.start()
    await pg.createDatabase('transfer_source'); await pg.createDatabase('transfer_target')
    const sourceUrl = `postgresql://transfer_test:isolated-only@127.0.0.1:${port}/transfer_source`
    const targetUrl = `postgresql://transfer_test:isolated-only@127.0.0.1:${port}/transfer_target`
    source = postgres(sourceUrl, { max: 1, onnotice: () => {} }); target = postgres(targetUrl, { max: 1, onnotice: () => {} })
    const schema = prepareWebSchema().sql
    await source.unsafe(schema); await target.unsafe(schema)
    const [restaurant] = await source`INSERT INTO restaurants(name,slug,settings) VALUES('Private Restaurant','private-test',${source.json({ greeting: 'hello', languages: ['it', 'en'] })}) RETURNING id`
    const [owner] = await source`INSERT INTO users(restaurant_id,name,email,role,password_hash,local_owner_secret_hash) VALUES(${restaurant.id},'Private Owner','private@example.test','owner','original-hash','original-appliance-hash') RETURNING id`
    await source`INSERT INTO sessions(user_id,token,expires_at) VALUES(${owner.id},'must-not-migrate',now()+interval '1 day')`
    const [menu] = await source`INSERT INTO menus(restaurant_id,name) VALUES(${restaurant.id},'Menu') RETURNING id`
    const [section] = await source`INSERT INTO menu_sections(menu_id,name) VALUES(${menu.id},'Section') RETURNING id`
    const [item] = await source`INSERT INTO menu_items(restaurant_id,section_id,name,price,image_url) VALUES(${restaurant.id},${section.id},'Private Dish',12.50,${`/uploads/${restaurant.id}/test.jpg`}) RETURNING id`
    const [table] = await source`INSERT INTO tables(restaurant_id,number,qr_token,assigned_waiter_id) VALUES(${restaurant.id},'1','private-qr',${owner.id}) RETURNING id`
    await source.unsafe('ALTER TABLE tables DROP CONSTRAINT tables_restaurant_number_unique; DROP INDEX tables_restaurant_number_active_uq')
    await source`INSERT INTO tables(restaurant_id,number,qr_token,active) VALUES(${restaurant.id},'1','duplicate-qr',false)`
    const [bill] = await source`INSERT INTO bills(restaurant_id,table_id,subtotal,total) VALUES(${restaurant.id},${table.id},12.50,12.50) RETURNING id`
    await source`INSERT INTO orders(restaurant_id,table_id,bill_id,total) VALUES(${restaurant.id},${table.id},${bill.id},12.50)`
    const uploads = join(directory, 'uploads')
    await mkdir(join(uploads, restaurant.id), { recursive: true })
    await writeFile(join(uploads, restaurant.id, 'test.jpg'), Buffer.from('isolated-image'))
    const before = await inspectSource(sourceUrl)
    assert.equal(before.counts.restaurants, 1)
    assert.equal(before.credentials.owners, 1)
    const backup = join(directory, 'backup')
    const exported = await exportSource(sourceUrl, backup, uploads)
    assert.equal(exported.imageCount, 1)
    assert.equal((await stat(join(backup, 'data.json'))).mode & 0o777, 0o600)
    assert.deepEqual(await inspectSource(sourceUrl), before)
    await assert.rejects(importSnapshot(targetUrl, backup, 'wrong-target.test', 'transfer_target'), /expected target/)
    const [qa] = await target`INSERT INTO restaurants(name,slug) VALUES('Explicit QA tenant','qa-only') RETURNING id`
    await assert.rejects(importSnapshot(targetUrl, backup, '127.0.0.1', 'transfer_target', [], 'transfer_test'), /not empty/)
    await assert.rejects(importSnapshot(targetUrl, backup, '127.0.0.1', 'transfer_target', [qa.id], 'transfer_test'), (error) => error.code === '23505')
    assert.equal((await target`SELECT count(*)::int AS count FROM users`)[0].count, 0)
    const staged = join(directory, 'staged')
    const normalization = await normalizeTableLabels(backup, staged)
    assert.equal(normalization.renamedTableCount, 1)
    const imported = await importSnapshot(targetUrl, staged, '127.0.0.1', 'transfer_target', [qa.id], 'transfer_test')
    assert.equal(imported.counts.restaurants, 1)
    assert.equal(imported.imagesUploaded, false)
    const [account] = await target`SELECT id,password_hash,local_owner_secret_hash FROM users`
    assert.equal(account.id, owner.id)
    assert.equal(account.password_hash, 'original-hash')
    assert.equal(account.local_owner_secret_hash, 'original-appliance-hash')
    assert.deepEqual((await target`SELECT settings FROM restaurants WHERE id=${restaurant.id}`)[0].settings, { greeting: 'hello', languages: ['it', 'en'] })
    assert.equal((await target`SELECT id FROM menu_items`)[0].id, item.id)
    assert.equal((await target`SELECT bill_id FROM orders`)[0].bill_id, bill.id)
    assert.equal((await target`SELECT number FROM tables WHERE id=${table.id}`)[0].number, '1')
    assert.deepEqual((await target`SELECT number FROM tables ORDER BY number`).map((row) => row.number), ['1', '1-2'])
    assert.deepEqual(await inspectSource(sourceUrl), before)
    assert.equal((await target`SELECT count(*)::int AS count FROM sessions`)[0].count, 0)
    await assert.rejects(importSnapshot(targetUrl, backup, '127.0.0.1', 'transfer_target', [], 'transfer_test'), /not empty/)
    await assert.rejects(importSnapshot(targetUrl, backup, '127.0.0.1', 'transfer_target', [qa.id, restaurant.id], 'transfer_test'), /UUID already exists/)
    assert.equal((await target`SELECT count(*)::int AS count FROM restaurants`)[0].count, 2)
    await writeFile(join(backup, 'data.json'), '{}')
    await assert.rejects(importSnapshot(targetUrl, backup, '127.0.0.1', 'transfer_target', [], 'transfer_test'), /integrity/)
  } finally {
    if (source) await source.end(); if (target) await target.end()
    await pg.stop(); await rm(directory, { recursive: true, force: true })
  }
})

test('other unique collisions are detected independently of duplicate table labels', () => {
  const collisions = uniqueCollisions({ tables: [{ name: 'users', rows: [{ id: 'a', email: 'Owner@Example.test' }, { id: 'b', email: 'owner@example.test' }] }] })
  assert.equal(collisions.length, 1)
  assert.equal(collisions[0].columns[0], 'email_case_insensitive')
})
