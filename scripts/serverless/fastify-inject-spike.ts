// Compatibility spike: no database, credentials, listener or remote writes.
import Fastify from 'npm:fastify@5.2.1';
import cookie from 'npm:@fastify/cookie@11.0.2';
import {createFetchBridge} from './fetch-bridge.mjs';
const app = Fastify();
await app.register(cookie);
app.get('/api/spike', async (_request, reply) => {
  reply.setCookie('spike', 'non-secret-test', { httpOnly: true, secure: true, sameSite: 'strict' });
  return { ok: true };
});
const response = await app.inject({ method: 'GET', url: '/api/spike' });
if (response.statusCode !== 200 || !response.json().ok || !String(response.headers['set-cookie']).includes('HttpOnly')) throw Error('Injection/cookie compatibility failed');
const bridge=createFetchBridge(app);
const fetched=await bridge(new Request('https://takoitalia.com/api/spike'));
if(fetched.status!==200 || !(await fetched.json()).ok || !fetched.headers.get('set-cookie')?.includes('HttpOnly')) throw Error('Fetch bridge failed');
await app.close();
console.log('Fastify request injection, fetch bridge and secure cookie: PASS. No production runtime compatibility claim.');
