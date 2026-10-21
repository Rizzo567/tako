import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{proxy,twilioWebhook,TWILIO_WEBHOOK_PATH} from '../../deploy/cloudflare/worker.mjs';
// 22/10: il webhook WhatsApp non deve morire quando Twilio chiude (15 s) mentre il router Supabase tiene ferma la richiesta.
const env={TAKO_GATEWAY_SECRET:'fixture-gateway-secret-over-thirty-two-characters',TAKO_BACKEND_READY:'true',TAKO_EDGE_URL:'https://example.supabase.co/functions/v1/takomen-api'};
const form='AccountSid=AC1&From=whatsapp%3A%2B390000000000&Body=ciao&MessageSid=SM'+'0'.repeat(32);
const twilioRequest=signal=>new Request('https://takoitalia.com'+TWILIO_WEBHOOK_PATH,{method:'POST',signal,headers:{'CF-Connecting-IP':'203.0.113.9','Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':'sig','x-tako-gateway-received-at':'1'},body:form});
const twiml='<?xml version="1.0" encoding="UTF-8"?><Response><Message>ok</Message></Response>';
const fakeCtx=()=>{const tasks=[];return{tasks,waitUntil:p=>tasks.push(p)}};

test('Twilio che chiude non interrompe l’inoltro: niente signal del client, fetch tenuta in waitUntil',async()=>{
 const client=new AbortController(),ctx=fakeCtx();let forwarded,release;
 const gate=new Promise(r=>{release=r});
 const pending=twilioWebhook(twilioRequest(client.signal),env,ctx,async req=>{forwarded=req;await gate;return new Response(twiml,{headers:{'Content-Type':'text/xml'}})},()=>1700000000000);
 await new Promise(r=>setTimeout(r,5));
 client.abort();// Twilio rinuncia dopo 15 s
 assert.ok(forwarded,'la richiesta deve essere già partita');
 assert.equal(forwarded.signal.aborted,false,'il segnale di Twilio non deve propagarsi a Supabase');
 assert.equal(ctx.tasks.length,1,'la richiesta a Supabase deve stare in waitUntil');
 assert.equal(await forwarded.text(),form,'corpo firmato intatto');
 assert.equal(forwarded.headers.get('X-Twilio-Signature'),'sig');
 assert.equal(forwarded.headers.get('x-tako-gateway-secret'),env.TAKO_GATEWAY_SECRET);
 assert.equal(forwarded.headers.get('x-tako-gateway-received-at'),'1700000000000','ora di arrivo impostata dal gateway, non dal client');
 assert.equal(forwarded.url,'https://example.supabase.co/functions/v1/takomen-api/api/whatsapp/twilio');
 release();
 const response=await pending;await ctx.tasks[0];
 assert.equal(response.status,200);assert.equal(await response.text(),twiml);
});

test('worker.fetch instrada solo POST /api/whatsapp/twilio sul percorso staccato',async()=>{
 const ctx=fakeCtx(),original=globalThis.fetch;let forwarded;
 globalThis.fetch=async req=>{forwarded=req;return new Response('<Response/>',{headers:{'Content-Type':'text/xml'}})};
 try{
  const client=new AbortController();
  const response=await worker.fetch(twilioRequest(client.signal),env,ctx);
  assert.equal(response.status,200);assert.equal(ctx.tasks.length,1);
  assert.equal(forwarded.signal.aborted,false);client.abort();assert.equal(forwarded.signal.aborted,false);
  assert.match(forwarded.headers.get('x-tako-gateway-received-at'),/^\d{13}$/);
  // Altre route: comportamento invariato, nessun waitUntil, segnale del client propagato.
  const other=fakeCtx(),c2=new AbortController();
  await worker.fetch(new Request('https://takoitalia.com/api/menu-workspace/items',{method:'POST',signal:c2.signal,headers:{'CF-Connecting-IP':'203.0.113.9'},body:'{}'}),env,other);
  assert.equal(other.tasks.length,0);
  assert.equal(forwarded.headers.get('x-tako-gateway-received-at'),null,'header solo sul webhook');
  c2.abort();assert.equal(forwarded.signal.aborted,true,'le altre route continuano a seguire il client');
 }finally{globalThis.fetch=original}
});

test('header received-at falso dal client viene rimosso su ogni route',async()=>{
 let forwarded;
 await proxy(new Request('https://takoitalia.com/api/auth/me',{headers:{'CF-Connecting-IP':'203.0.113.9','x-tako-gateway-received-at':'1'}}),env,async req=>{forwarded=req;return new Response('{}')});
 assert.equal(forwarded.headers.get('x-tako-gateway-received-at'),null);
});

test('GET sul percorso del webhook non usa il percorso staccato',async()=>{
 const ctx=fakeCtx(),original=globalThis.fetch;globalThis.fetch=async()=>new Response('no');
 try{await worker.fetch(new Request('https://takoitalia.com'+TWILIO_WEBHOOK_PATH,{headers:{'CF-Connecting-IP':'203.0.113.9'}}),env,ctx);assert.equal(ctx.tasks.length,0)}finally{globalThis.fetch=original}
});

test('Supabase irraggiungibile: 503 senza dettagli, nessuna eccezione nel waitUntil',async()=>{
 const ctx=fakeCtx();
 const response=await twilioWebhook(twilioRequest(),env,ctx,async()=>{throw Error('secret detail')});
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret'));
 await ctx.tasks[0];
});
