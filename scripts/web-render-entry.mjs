#!/usr/bin/env node
/** One public Render port; API and customer renderer remain internal child processes. */
import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function readConfig(env = process.env) {
  if (env.TAKO_MODE !== 'web') throw new Error('TAKO_MODE must be web');
  let origin;
  try { origin = new URL(env.WEB_ORIGIN); } catch { throw new Error('WEB_ORIGIN requires an HTTPS origin'); }
  const development = env.NODE_ENV === 'development';
  const localHttp = development && origin.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
  if ((!localHttp && origin.protocol !== 'https:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('WEB_ORIGIN requires an HTTPS origin');
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL requires a managed PostgreSQL connection'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || ['localhost','127.0.0.1','[::1]'].includes(database.hostname)) throw new Error('DATABASE_URL requires managed PostgreSQL');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /^(.)\1+$/.test(env.JWT_SECRET) || /placeholder|change.?me|example/i.test(env.JWT_SECRET)) throw new Error('JWT_SECRET requires a strong secret of at least 32 characters');
  if (env.EMBEDDED_DB === '1' || env.TAKO_HTTPS === '1') throw new Error('Embedded database and local TLS are disabled in Render');
  const port = Number(env.PORT || 10000), apiPort = Number(env.API_PORT || 3001), customerPort = Number(env.CUSTOMER_PORT || 3002);
  if (![port,apiPort,customerPort].every(p => Number.isInteger(p) && p >= 1024 && p <= 65535) || new Set([port,apiPort,customerPort]).size !== 3) throw new Error('PORT, API_PORT and CUSTOMER_PORT must be valid distinct ports');
  if (env.UPLOADS_DRIVER !== 'supabase' || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_STORAGE_BUCKET) throw new Error('Render requires configured private Supabase Storage');
  let storage;
  try { storage = new URL(env.SUPABASE_URL); } catch { throw new Error('SUPABASE_URL requires HTTPS'); }
  if (storage.protocol !== 'https:' || storage.username || storage.password) throw new Error('SUPABASE_URL requires HTTPS');
  if (!env.UPLOADS_DIR?.startsWith('/')) throw new Error('UPLOADS_DIR requires an absolute path');
  return { port, origin: origin.origin, host: origin.host, protocol: origin.protocol.slice(0,-1), bindHost: localHttp ? '127.0.0.1' : '0.0.0.0', root: env.TAKO_APP_ROOT || '/app', staffDir: env.STAFF_DIR || resolve(env.TAKO_APP_ROOT || '/app','staff-web'), apiPort, customerPort };
}
export function targetPort(path, config) {
  const pathname = new URL(path, 'http://gateway.invalid').pathname;
  return ['/api','/staff','/socket.io','/uploads'].some(prefix => pathname === prefix || pathname.startsWith(prefix + '/')) ? config.apiPort : config.customerPort;
}
export function proxyHeaders(req, config, upgrade = false) {
  const headers = { ...req.headers };
  // Trust the gateway, never client-supplied proxy chains. Render terminates TLS.
  for (const key of Object.keys(headers)) if (key.startsWith('x-forwarded-') || ['forwarded','proxy-authorization','proxy-authenticate'].includes(key)) delete headers[key];
  if (!upgrade) {
    for (const key of String(headers.connection || '').split(',').map(s => s.trim().toLowerCase())) if (key) delete headers[key];
    delete headers.connection; delete headers['keep-alive']; delete headers['transfer-encoding']; delete headers.upgrade;
  }
  headers.host = config.host;
  headers['x-forwarded-host'] = config.host;
  headers['x-forwarded-proto'] = config.protocol || 'https';
  // Preserve only the rightmost Render-provided client IP, never a user prefix.
  const renderIp = String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim();
  headers['x-forwarded-for'] = config.protocol === 'http' ? req.socket.remoteAddress : (renderIp || req.socket.remoteAddress);
  return headers;
}
function available(port, path) {
  return new Promise(resolveResult => {
    const req = httpRequest({ hostname:'127.0.0.1',port,path,timeout:2000 }, res => { res.resume(); resolveResult(res.statusCode < 500); });
    req.on('timeout',()=>req.destroy()); req.on('error',()=>resolveResult(false)); req.end();
  });
}
export function gateway(config) {
  const server = createServer(async (req,res) => {
    if (req.url === '/health') {
      const healthy = (await Promise.all([available(config.apiPort,'/health'),available(config.customerPort,'/')])).every(Boolean);
      res.writeHead(healthy ? 200 : 503, {'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ status: healthy ? 'ok' : 'starting' }));
    }
    if (req.headers.host !== config.host) { res.writeHead(421); return res.end('Host non autorizzato'); }
    if (req.url === '/') { res.writeHead(302,{location:'/staff/','cache-control':'no-store'}); return res.end(); }
    let port;
    try { port = targetPort(req.url,config); } catch { res.writeHead(400); return res.end(); }
    const upstream = httpRequest({ hostname:'127.0.0.1',port,method:req.method,path:req.url,headers:proxyHeaders(req,config),timeout:120000 }, response => {
      const headers = {...response.headers}; delete headers.connection; delete headers['transfer-encoding'];
      res.writeHead(response.statusCode || 502,headers); response.pipe(res);
    });
    upstream.on('timeout',()=>upstream.destroy());
    upstream.on('error',()=> { if (!res.headersSent) { res.writeHead(502,{'content-type':'application/json','cache-control':'no-store'}); res.end('{"error":"Servizio temporaneamente non disponibile"}'); } else res.destroy(); });
    req.on('aborted',()=>upstream.destroy()); res.on('close',()=>upstream.destroy()); req.pipe(upstream);
  });
  server.on('upgrade',(req,socket,head) => {
    if (req.headers.host !== config.host || !req.url.startsWith('/socket.io/')) { socket.destroy(); return; }
    const upstream = httpRequest({hostname:'127.0.0.1',port:config.apiPort,path:req.url,headers:proxyHeaders(req,config,true)});
    upstream.on('upgrade',(response,peer,peerHead) => {
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
      for(let i=0;i<response.rawHeaders.length;i+=2) socket.write(`${response.rawHeaders[i]}: ${response.rawHeaders[i+1]}\r\n`);
      socket.write('\r\n'); if(peerHead.length) socket.write(peerHead); if(head.length) peer.write(head);
      peer.on('error',()=>socket.destroy()); socket.on('error',()=>peer.destroy());
      socket.on('close',()=>peer.destroy()); peer.on('close',()=>socket.destroy()); socket.on('end',()=>peer.end()); peer.on('end',()=>socket.end()); socket.pipe(peer).pipe(socket);
    });
    upstream.on('response',()=>socket.destroy()); upstream.on('error',()=>socket.destroy()); socket.on('error',()=>upstream.destroy()); upstream.end();
  });
  return server;
}
export async function main(env = process.env) {
  const config = readConfig(env);
  const apiRoot = resolve(config.root,'apps/server');
  const apiCli = resolve(apiRoot,'node_modules/tsx/dist/cli.mjs');
  const customer = resolve(config.root,'apps/web/.next/standalone/apps/web/server.js');
  for(const path of [apiCli,customer,resolve(config.staffDir,'index.html'),resolve(config.staffDir,'app.js')]) if(!existsSync(path)) throw new Error('Runtime build missing: ' + path);
  const children=[]; let stopping=false;
  const server = gateway(config);
  const shutdown = code => {
    if(stopping) return; stopping=true; server.close();
    for(const child of children) child.kill('SIGTERM');
    const timer=setTimeout(()=> { for(const child of children) child.kill('SIGKILL'); process.exit(code); },8000);
    timer.unref();
    Promise.all(children.map(child => (child.exitCode !== null || child.signalCode !== null) ? Promise.resolve() : new Promise(r=>child.once('exit',r)))).then(()=>process.exit(code));
  };
  const runtimeEnv = env;
  const launch=(label,args,env,cwd)=> {
    const child=spawn(process.execPath,args,{cwd,env:{...runtimeEnv,...env},stdio:'inherit'}); children.push(child);
    child.once('error',()=> { console.error(`[web] ${label} failed to start`); shutdown(1); });
    child.once('exit',code=> { if(!stopping) { console.error(`[web] ${label} exited (${code})`); shutdown(1); } });
  };
  launch('API',[apiCli,'src/bootstrap.ts'],{PORT:String(config.apiPort),CLIENT_PORT:String(config.customerPort),TRUST_PROXY:'127.0.0.1,::1',STAFF_DIR:config.staffDir},apiRoot);
  launch('customer',[customer],{PORT:String(config.customerPort),HOSTNAME:'127.0.0.1',NEXT_PUBLIC_API_URL:`http://127.0.0.1:${config.apiPort}`},config.root);
  process.once('SIGTERM',()=>shutdown(0)); process.once('SIGINT',()=>shutdown(0));
  server.on('error',()=>shutdown(1)); server.listen(config.port,config.bindHost,()=>console.log(`[web] gateway listening on ${config.port}`));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=> { console.error('[web] Configuration/startup error:',error.message); process.exit(1); });
