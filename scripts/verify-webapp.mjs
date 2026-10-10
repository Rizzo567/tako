#!/usr/bin/env node
/** Live smoke restricted to clearly marked QA tenants in the dedicated web DB. */
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import postgres from 'postgres';
import { io as connectSocket } from 'socket.io-client';
import { loadLocalEnvironment } from './start-webapp.mjs';

const root = resolve(import.meta.dirname, '..');
const requireServer = createRequire(resolve(root, 'apps/server/package.json'));
const bcrypt = requireServer('bcryptjs');
const sharp = requireServer('sharp');
const credentialsPath = join(homedir(), '.config/tako-webapp/qa-login.json');
let stage = 'configuration';
let sql;
let socket;
let checks = 0;
function assert(value) { if (!value) throw new Error('CHECK_FAILED'); }
function passed(label) { checks++; console.log(`${label}: PASS`); }
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

async function main() {
  assert(process.argv.includes('--run'));
  const env = await loadLocalEnvironment(root);
  const origin = env.WEB_ORIGIN;
  assert(['http://localhost:5137', 'http://127.0.0.1:5137'].includes(origin));
  stage = 'health';
  assert((await fetch(origin + '/health', { signal: AbortSignal.timeout(5000) })).ok);
  passed('health');
  stage = 'QA seed';
  const connectionOptions = { max: 2 };
  if (env.DATABASE_CA_CERT_PATH) connectionOptions.ssl = { ca: await readFile(env.DATABASE_CA_CERT_PATH, 'utf8'), rejectUnauthorized: true };
  sql = postgres(env.DATABASE_URL, connectionOptions);
  let stored;
  try { stored = JSON.parse(await readFile(credentialsPath, 'utf8')); } catch {}
  const password = stored?.password || randomBytes(24).toString('base64url');
  const email = 'qa-web-verifica@tako.invalid';
  const passwordHash = await bcrypt.hash(password, 12);
  async function seed(slug, name, own = false) {
    return sql.begin(async tx => {
      const [restaurant] = await tx`insert into restaurants (name,slug,plan,settings) values (${name},${slug},'pro',${tx.json({ qaTenant: true, customerOrderingEnabled: true, autoConfirm: false, coverChargeEnabled: false, coverCharge: 0 })}) on conflict (slug) do update set name=excluded.name returning id`;
      // Only the explicit QA namespace is ever changed by this script.
      const [menu] = await tx`select id from menus where restaurant_id=${restaurant.id} order by created_at limit 1`;
      const menuRow = menu || (await tx`insert into menus(restaurant_id,name,type,active) values (${restaurant.id},'Menu di verifica','main',true) returning id`)[0];
      const [section] = await tx`select id from menu_sections where menu_id=${menuRow.id} order by position limit 1`;
      const sectionRow = section || (await tx`insert into menu_sections(menu_id,name,active) values (${menuRow.id},'Piatti di prova',true) returning id`)[0];
      const [item] = await tx`select id from menu_items where restaurant_id=${restaurant.id} order by position limit 1`;
      const itemRow = item || (await tx`insert into menu_items(restaurant_id,section_id,name,description,price,available) values (${restaurant.id},${sectionRow.id},'Piatto di verifica','Solo dati di prova per il collaudo web',12,true) returning id`)[0];
      const [room] = await tx`select id from rooms where restaurant_id=${restaurant.id} and name='Sala di verifica' limit 1`;
      const roomRow = room || (await tx`insert into rooms(restaurant_id,name,active) values (${restaurant.id},'Sala di verifica',true) returning id`)[0];
      const [table] = await tx`select id,qr_token from tables where restaurant_id=${restaurant.id} and number='QA1' limit 1`;
      const tableRow = table || (await tx`insert into tables(restaurant_id,number,seats,qr_token) values (${restaurant.id},'QA1',2,${randomBytes(24).toString('base64url')}) returning id,qr_token`)[0];
      await tx`update tables set room_id=${roomRow.id},pos_x=40,pos_y=40 where id=${tableRow.id} and restaurant_id=${restaurant.id}`;
      if (own) {
        await tx`insert into users(restaurant_id,name,email,role,password_hash,email_verified,active) values (${restaurant.id},'Titolare · Verifica web',${email},'owner',${passwordHash},true,true) on conflict(email) do update set password_hash=excluded.password_hash,active=true where users.restaurant_id=excluded.restaurant_id`;
      }
      return { restaurantId: restaurant.id, menuId: menuRow.id, itemId: itemRow.id, tableId: tableRow.id, qrToken: tableRow.qr_token };
    });
  }
  const a = await seed('qa-web-verifica', 'Tako · Verifica web', true);
  const b = await seed('qa-web-isolamento', 'Tako · Verifica isolamento');
  await mkdir(resolve(credentialsPath, '..'), { recursive: true, mode: 0o700 });
  await writeFile(credentialsPath, JSON.stringify({ url: origin, email, password, restaurantId: a.restaurantId, customerUrl: `${origin}/r/${a.restaurantId}/t/${a.qrToken}` }), { mode: 0o600 });
  await chmod(credentialsPath, 0o600);
  passed('QA tenants ready');
  if (process.argv.includes('--prepare-demo')) { console.log('QA room/table demo: PASS'); return; }

  async function request(method, path, body, cookie) {
    const response = await fetch(origin + path, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const json = await response.json().catch(() => null);
    return { status: response.status, body: json, cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  }
  stage = 'owner login';
  const login = await request('POST', '/api/auth/login', { email, password });
  assert(login.status === 200 && login.body.data.restaurant.id === a.restaurantId && login.cookie);
  const ownerCookie = login.cookie;
  passed('owner credentials');
  stage = 'tenant isolation';
  assert((await request('GET', `/api/menus/${b.menuId}`, null, ownerCookie)).status === 404);
  const ownMenus = await request('GET', '/api/menus/', null, ownerCookie);
  assert(ownMenus.status === 200 && ownMenus.body.data.every(menu => menu.restaurantId === a.restaurantId));
  passed('tenant isolation');
  stage = 'customer QR/menu';
  const table = await request('GET', `/api/customer/table/${a.qrToken}`);
  assert(table.status === 200 && table.cookie);
  const customerCookie = table.cookie;
  const menu = await request('GET', `/api/customer/restaurant/${a.restaurantId}/menu`);
  assert(menu.status === 200 && menu.body.data.sections.some(section => section.items.some(item => item.id === a.itemId)));
  passed('customer QR/menu');
  stage = 'socket staff join';
  socket = connectSocket(origin, { transports: ['websocket'], extraHeaders: { Cookie: ownerCookie, Origin: origin }, timeout: 6000, reconnection: false });
  await new Promise((resolveConnection, reject) => { socket.once('connect', resolveConnection); socket.once('connect_error', () => reject(new Error('SOCKET_FAILED'))); });
  socket.emit('join:restaurant', a.restaurantId);
  await delay(700);
  stage = 'customer order/realtime';
  const realtimeOrder = new Promise((resolveEvent, reject) => { const timeout = setTimeout(() => reject(new Error('REALTIME_TIMEOUT')), 10000); socket.once('order:new', data => { clearTimeout(timeout); resolveEvent(data); }); });
  const created = await request('POST', '/api/customer/orders', { restaurantId: a.restaurantId, tableId: a.tableId, tableNumber: 'QA1', type: 'table', items: [{ menuItemId: a.itemId, quantity: 1, notes: 'Ordine QA web — nessun cliente reale' }], idempotencyKey: 'qa-web-' + randomUUID(), notes: 'Collaudo webapp' }, customerCookie);
  assert(created.status === 201);
  const order = created.body.data;
  assert((await realtimeOrder).id === order.id);
  passed('customer order/realtime');
  stage = 'KDS status';
  const active = await request('GET', '/api/orders/active', null, ownerCookie);
  assert(active.status === 200 && active.body.data.some(row => row.id === order.id));
  for (const status of ['confirmed', 'preparing', 'ready', 'served']) {
    assert((await request('PATCH', `/api/orders/${order.id}/status`, { status }, ownerCookie)).status === 200);
  }
  passed('KDS workflow');
  stage = 'cash bookkeeping';
  const bill = await request('POST', '/api/bills/', { tableId: a.tableId, tableNumber: 'QA1', covers: 1 }, ownerCookie);
  assert([200, 201].includes(bill.status) && Number(bill.body.data.total) > 0);
  const billId = bill.body.data.id;
  assert((await request('POST', `/api/bills/${billId}/payments`, { amount: Number(bill.body.data.total), method: 'cash' }, ownerCookie)).status === 201);
  const closed = await request('GET', `/api/bills/${billId}`, null, ownerCookie);
  assert(closed.status === 200 && closed.body.data.status === 'closed');
  passed('cash bookkeeping');
  stage = 'image upload/read';
  const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ED7159' } }).png().toBuffer();
  const form = new FormData(); form.append('file', new Blob([image], { type: 'image/png' }), 'qa-web.png');
  const upload = await request('POST', '/api/uploads/image', form, ownerCookie);
  assert(upload.status === 200 && upload.body.data.url.startsWith('/uploads/'));
  const imageResponse = await fetch(origin + upload.body.data.url, { signal: AbortSignal.timeout(15000) });
  assert(imageResponse.ok && imageResponse.headers.get('content-type').startsWith('image/'));
  assert((await imageResponse.arrayBuffer()).byteLength > 0);
  passed('image upload/read');
  stage = 'logout/revocation';
  assert((await request('POST', '/api/auth/logout', {}, ownerCookie)).status === 200);
  assert((await request('GET', '/api/auth/me', null, ownerCookie)).status === 401);
  passed('logout/revocation');
  console.log(`Operational smoke: PASS (${checks} checks)`);
}
main().catch(error => { console.error(`Operational smoke: FAIL (${stage}; ${error.code || 'CHECK_FAILED'})`); process.exitCode = 1; }).finally(async () => { socket?.disconnect(); if (sql) await sql.end(); });
