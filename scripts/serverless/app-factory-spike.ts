// Actual Tako factory compatibility spike, no DB, sockets, listener or provider writes.
import {createApp, EDGE_SPIKE_CAPABILITIES} from '../../apps/server/src/index.ts';
import {createFetchBridge} from './fetch-bridge.mjs';
for (const [key,value] of Object.entries({TAKO_MODE:'web',NODE_ENV:'development',WEB_ORIGIN:'http://localhost:5137',JWT_SECRET:'fixture-factory-secret-over-thirty-two-characters'})) Deno.env.set(key,value);
const app=await createApp({runtime:'edge-spike'});
try {
 const response=await createFetchBridge(app)(new Request('http://localhost:5137/health'));
 if(response.status!==200||(await response.json()).status!=='ok'||app.server.listening)throw Error('Factory isolation failed');
 const missing=await app.inject('/api/auth/me');if(missing.statusCode!==404)throw Error('Unexpected unsupported endpoint');
 console.log(JSON.stringify({factory:'PASS',capabilities:EDGE_SPIKE_CAPABILITIES}));
} finally {await app.close()}
