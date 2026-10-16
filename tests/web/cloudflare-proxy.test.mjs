import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{proxy,backendURL,readOnlyMenu,catalogRequest} from '../../deploy/cloudflare/worker.mjs';
const env={TAKO_GATEWAY_SECRET:'fixture-gateway-secret-over-thirty-two-characters',TAKO_BACKEND_READY:'true',TAKO_EDGE_URL:'https://example.supabase.co/functions/v1/takomen-api'};
test('disabled or unsafe backend fails closed', async()=>{
 for(const e of [{}, {...env,TAKO_BACKEND_READY:'false'}, {...env,TAKO_EDGE_URL:'http://example.supabase.co/functions/v1/api'}, {...env,TAKO_EDGE_URL:'https://example.com/functions/v1/api'}]) {
  assert.equal(backendURL(e),null);
  assert.equal((await proxy(new Request('https://takoitalia.com/api/auth'),e,()=>{throw Error('must not fetch')})).status,503);
 }
});
test('same-origin credentials, query, mutation and binary preserved',async()=>{
 let forwarded;
 const response=await proxy(new Request('https://takoitalia.com/api/pdf?menu=1',{method:'POST',headers:{'CF-Connecting-IP':'203.0.113.2',Cookie:'staff=secret','Origin':'https://takoitalia.com','Content-Type':'application/octet-stream','X-CSRF-Token':'csrf','X-Forwarded-Host':'evil'},body:new Uint8Array([0,255])}),env,async req=>{
  forwarded=req;
  assert.deepEqual([...new Uint8Array(await req.arrayBuffer())],[0,255]);
  return new Response(new Uint8Array([1,254]),{headers:{'Content-Type':'application/pdf'}});
 });
 assert.equal(forwarded.url,'https://example.supabase.co/functions/v1/takomen-api/api/pdf?menu=1');
 assert.equal(forwarded.headers.get('Cookie'),'staff=secret');
 assert.equal(forwarded.headers.get('Origin'),'https://takoitalia.com');
 assert.equal(forwarded.headers.get('X-CSRF-Token'),'csrf');
 assert.equal(forwarded.headers.get('X-Forwarded-Host'),'takoitalia.com');
 assert.equal(forwarded.redirect,'manual');
 assert.equal(forwarded.headers.get('x-tako-gateway-secret'),env.TAKO_GATEWAY_SECRET);
 assert.equal(forwarded.headers.get('x-tako-client-ip'),'203.0.113.2');
 assert.equal(response.headers.get('Content-Type'),'application/pdf');
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,254]);
});
test('cookie scope and redirects target frontend',async()=>{
 const response=await proxy(new Request('https://takoitalia.com/api/auth',{headers:{'CF-Connecting-IP':'203.0.113.2'}}),env,async()=>new Response(null,{status:302,headers:{'Set-Cookie':'staff=abc; Domain=example.supabase.co; Path=/; HttpOnly; Secure; SameSite=Lax','Location':'https://example.supabase.co/functions/v1/takomen-api/staff/'}}));
 assert.equal(response.headers.get('Set-Cookie'),'staff=abc; Path=/; HttpOnly; Secure; SameSite=Lax');
 assert.equal(response.headers.get('Location'),'https://takoitalia.com/staff/');
});
test('API/upload/socket never fall through SPA asset routing',async()=>{
 for(const path of ['/api','/api/auth','/uploads/test.png','/socket.io/']){
  const response=await worker.fetch(new Request('https://takoitalia.com'+path),{ASSETS:{fetch:()=>{throw Error('SPA fallback forbidden')}}});
  assert.ok([503,404].includes(response.status));
 }
 const response=await worker.fetch(new Request('https://takoitalia.com/staff/'),{ASSETS:{fetch:()=>new Response('staff')}});
 assert.equal(await response.text(),'staff');
});
test('network failure hides upstream details',async()=>{
 const response=await proxy(new Request('https://takoitalia.com/api/menu',{headers:{'CF-Connecting-IP':'203.0.113.2'}}),env,async()=>{throw Error('sensitive upstream token')});
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('token'));
});

test('active backend rejects missing gateway secret or Cloudflare IP before fetch',async()=>{for(const cfg of [env,{...env,TAKO_GATEWAY_SECRET:''}])assert.equal((await proxy(new Request('https://takoitalia.com/api/auth'),cfg,()=>{throw Error('should not fetch')})).status,503);});

test('activated customer API fails closed rather than returning an old static snapshot',async()=>{
 const response=await worker.fetch(new Request('https://takoitalia.com/api/customer/restaurant/84fe4d77-2d87-5187-aa94-9c01840e99de/menu'),{...env,ASSETS:{fetch:()=>{throw Error('Snapshot fallback forbidden after activation')}}});
 assert.equal(response.status,503);
});

test('app assets use a namespace without replacing landing asset routes',async()=>{
 let requested;
 const response=await worker.fetch(new Request('https://takoitalia.com/takomenu-app/assets/app.js'),{ASSETS:{fetch:req=>{requested=req.url;return new Response('bundle')}}});
 assert.equal(requested,'https://takoitalia.com/assets/app.js');
 assert.equal(await response.text(),'bundle');
});

test('live published menus preserve approved read-only policy and use current response data',async()=>{
 for(const price of [6,7]){
  const response=await readOnlyMenu(Response.json({data:[{name:'Current published item',price}],features:{customerOrderingEnabled:true,reservationsEnabled:true,other:true}},{headers:{ETag:'obsolete','Cache-Control':'public, max-age=60'}}),'GET');
  const body=await response.json();assert.equal(body.data[0].price,price);
  assert.deepEqual(body.features,{customerOrderingEnabled:false,reservationsEnabled:false,other:true});
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('ETag'),null);
 }
});
test('public live menu rejects writes; failures remain failures without snapshot fallback',async()=>{
 const path='https://takoitalia.com/api/customer/restaurant/84fe4d77-2d87-5187-aa94-9c01840e99de/menu';
 const response=await worker.fetch(new Request(path,{method:'POST'}),{...env,ASSETS:{fetch:()=>{throw Error('No fallback')}}});assert.equal(response.status,405);
 for(const status of [401,404,503])assert.equal((await readOnlyMenu(Response.json({error:'fixture'},{status}),'GET')).status,status);
});
test('public read-only catalog bypasses viewing schedules without changing order or private requests',()=>{
 const path='https://takoitalia.com/api/customer/restaurant/84fe4d77-2d87-5187-aa94-9c01840e99de/menu?lang=it&catalogOnly=0';
 const original=new Request(path,{headers:{Cookie:'fixture','CF-Connecting-IP':'203.0.113.2'}}),request=catalogRequest(original);
 assert.equal(new URL(request.url).searchParams.get('catalogOnly'),'1');assert.equal(new URL(request.url).searchParams.get('lang'),'it');assert.equal(request.headers.get('Cookie'),'fixture');
 for(const value of [new Request('https://takoitalia.com/api/orders',{method:'POST'}),new Request(path,{method:'POST'}),new Request('https://takoitalia.com/api/menu-workspace')])assert.equal(catalogRequest(value),value);
});

 test('fast reads route separately and immutable image cache never caches private JSON',async()=>{
 const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;const hits=new Map(),calls=[],pending=[];
 globalThis.caches={default:{match:async k=>hits.get(k.url)?.clone(),put:async(k,r)=>{hits.set(k.url,r)}}};
 globalThis.fetch=async req=>{calls.push(req.url);return req.url.includes('/uploads/')?new Response('image',{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=31536000, immutable'}}):Response.json({ok:true});};
 const cfg={...env,TAKO_READ_EDGE_URL:'https://example.supabase.co/functions/v1/tako-read-candidate'},headers={'CF-Connecting-IP':'203.0.113.2'},ctx={waitUntil:p=>pending.push(p)};
 try{
 await worker.fetch(new Request('https://takoitalia.com/api/auth/bootstrap',{headers}),cfg,ctx);assert.match(calls.at(-1),/tako-read-candidate/);assert.equal(hits.size,0);
 await worker.fetch(new Request('https://takoitalia.com/api/menu-workspace',{method:'POST',headers}),cfg,ctx);assert.match(calls.at(-1),/takomen-api/);
 const url='https://takoitalia.com/uploads/84fe4d77-2d87-5187-aa94-9c01840e99de/abcdefghijklmnop.png';
 await worker.fetch(new Request(url,{headers}),cfg,ctx);await Promise.all(pending);const count=calls.length;
 const head=await worker.fetch(new Request(url,{method:'HEAD',headers}),cfg,ctx);assert.equal(await head.text(),'');assert.equal(calls.length,count);assert.equal(hits.size,1);
 }finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
 });
