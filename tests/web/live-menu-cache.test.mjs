import test from 'node:test';import assert from 'node:assert/strict';import {liveMenu,liveCacheKeys} from '../../deploy/cloudflare/worker.mjs'
// Rilettura live (17/10): con lo stesso gettone k i telefoni dello stesso data center fanno una lettura all'origine
// (poche in più se arrivano insieme, prima che il lucchetto sia scritto).
const fakeCache=()=>{const m=new Map();return{m,async match(r){const x=m.get(r.url);return x?x.clone():undefined},async put(r,res){await new Promise(z=>setTimeout(z,2));m.set(r.url,res.clone())},async delete(r){return m.delete(r.url)}}}
const R='26050ecd-2e55-4057-a4c5-bff2b449cd47',url=(q)=>`https://takoitalia.com/api/customer/restaurant/${R}/menu?${q}`
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
test('same token: one origin read, the others wait for its copy (no Set-Cookie, no-store to the phone)',async()=>{
 const cache=fakeCache();let loads=0
 const load=async()=>{loads++;await sleep(80);return new Response(JSON.stringify({data:{id:'m'}}),{status:200,headers:{'Content-Type':'application/json','Set-Cookie':'tako_menu_visit=x','Cache-Control':'no-store'}})}
 const req=()=>liveMenu(new Request(url('prefetch=1&live=0123456789abcdef')),null,load,cache,sleep);const first=req();await sleep(20);const rs=await Promise.all([first,...Array.from({length:11},req)])
 assert.equal(loads,1,'loads');for(const r of rs){assert.equal(r.status,200);assert.equal((await r.json()).data.id,'m');assert.equal(r.headers.get('Cache-Control'),'no-store')}
 assert.equal(rs.filter(r=>r.headers.get('X-Takomenu-Live')==='MISS').length,loads,'miss');assert.ok(rs.filter(r=>r.headers.get('X-Takomenu-Live')==='WAIT').length===11,'followers waited');assert.ok(rs.filter(r=>r.headers.get('X-Takomenu-Live')!=='MISS').every(r=>!r.headers.get('Set-Cookie')))
 // Gettone nuovo (cambio successivo): nuova lettura, mai la copia vecchia.
 const before=loads;await liveMenu(new Request(url('prefetch=1&live=fedcba9876543210')),null,load,cache,sleep);assert.equal(loads,before+1)
})
test('errors are never shared; invalid or missing token, other menus/languages and HEAD go to the normal path',async()=>{
 const cache=fakeCache();let loads=0;const fail=async()=>{loads++;return new Response('{}',{status:429,headers:{'Retry-After':'30'}})}
 const a=await liveMenu(new Request(url('live=0123456789abcdef')),null,fail,cache,sleep);assert.equal(a.status,429)
 const b=await liveMenu(new Request(url('live=0123456789abcdef')),null,fail,cache,sleep);assert.equal(b.status,429);assert.equal(loads,2,'no cached 429, lock released')
 assert.equal(liveCacheKeys(new Request(url('live=../../x'))),null);assert.equal(liveCacheKeys(new Request(url('lang=en'))),null);assert.equal(liveCacheKeys(new Request(url('live=0123456789abcdef'),{method:'HEAD'})),null)
 const en=liveCacheKeys(new Request(url('lang=en&live=0123456789abcdef'))),it=liveCacheKeys(new Request(url('live=0123456789abcdef')));assert.notEqual(en.key.url,it.key.url)
 assert.equal(liveCacheKeys(new Request('https://takoitalia.com/api/customer/restaurant/x/other?live=0123456789abcdef')),null)
})
