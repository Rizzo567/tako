import test from 'node:test';
import assert from 'node:assert/strict';
import {createFetchBridge} from '../../scripts/serverless/fetch-bridge.mjs';
test('bridge preserves secure session cookies and CSRF, strips forged identity/proxy headers',async()=>{
 let observed;
 const bridge=createFetchBridge({inject:async args=>{observed=args;return {statusCode:200,headers:{'set-cookie':['session=a; Secure; HttpOnly; SameSite=Strict','table=b; Secure; HttpOnly'],'content-type':'application/json'},rawPayload:Buffer.from('{"ok":true}')}}});
 const response=await bridge(new Request('https://takoitalia.com/api/orders?state=ready',{method:'POST',headers:{origin:'https://takoitalia.com',cookie:'session=existing','content-type':'application/json','x-forwarded-for':'attacker','x-restaurant-id':'forged'},body:'{"item":1}'}));
 assert.ok(Buffer.isBuffer(observed.payload));assert.equal(observed.payload.toString(),'{"item":1}');assert.equal(observed.url,'/api/orders?state=ready');assert.equal(observed.headers.origin,'https://takoitalia.com');assert.equal(observed.headers.cookie,'session=existing');assert.equal(observed.headers['x-forwarded-for'],undefined);assert.equal(observed.headers['x-restaurant-id'],undefined);assert.equal(response.headers.getSetCookie().length,2);assert.deepEqual(await response.json(),{ok:true});
});
test('body limits apply even without content-length and before calling routes',async()=>{
 let called=false;const bridge=createFetchBridge({inject:async()=>{called=true;throw Error('should not run')}},{maxBodyBytes:2});
 assert.equal((await bridge(new Request('https://takoitalia.com/api/uploads',{method:'POST',body:'abc'}))).status,413);assert.equal(called,false);
});
test('HEAD has no body; runtime failures do not expose internal messages',async()=>{
 const app={inject:async()=>({statusCode:200,headers:{connection:'close'},rawPayload:Buffer.from('secret body')})};
 const response=await createFetchBridge(app)(new Request('https://takoitalia.com/api/menu',{method:'HEAD'}));assert.equal(await response.text(),'');assert.equal(response.headers.has('connection'),false);
 const failed=await createFetchBridge({inject:async()=>{throw Error('database password/path')}})(new Request('https://takoitalia.com/api/menu'));assert.equal(failed.status,500);assert.equal((await failed.text()).includes('password'),false);
});

test('protected Edge bridge uses authenticated client IP and strips function prefix',async()=>{let observed;const gateway={secret:'fixture-secret-over-thirty-two-characters',origin:'https://takoitalia.com'};const app={inject:async args=>{observed=args;return {statusCode:200,headers:{},rawPayload:Buffer.from('{}')}}};const bridge=createFetchBridge(app,{gateway,pathPrefix:'/functions/v1/tako-api'});const url='https://example.supabase.co/functions/v1/tako-api/api/auth/me';assert.equal((await bridge(new Request(url))).status,403);assert.equal(observed,undefined);assert.equal((await bridge(new Request(url,{headers:{'x-tako-gateway-secret':gateway.secret,'x-tako-gateway-origin':gateway.origin,'x-tako-client-ip':'203.0.113.2'}}))).status,200);assert.equal(observed.remoteAddress,'203.0.113.2');assert.equal(observed.url,'/api/auth/me');assert.equal(observed.headers['x-tako-gateway-secret'],undefined);});

test('heavy admission rejects before body consumption, shares PDF/upload slots and releases after failure',async()=>{
 let finish;let called=0;
 const bridge=createFetchBridge({inject:async()=>{called++;await new Promise(resolve=>finish=resolve);throw Error('internal')}});
 const first=bridge(new Request('https://takoitalia.com/api/menu-workspace/pdf',{method:'POST',body:'{}'}));
 while(!finish)await new Promise(resolve=>setTimeout(resolve,1));
 const secondRequest=new Request('https://takoitalia.com/api/uploads/image',{method:'POST',body:'content'});
 const second=await bridge(secondRequest);assert.equal(second.status,503);assert.equal(secondRequest.bodyUsed,false);assert.equal(called,1);
 finish();assert.equal((await first).status,500);
 const third=bridge(new Request('https://takoitalia.com/api/menu-workspace/pdf',{method:'POST',body:'{}'}));
 while(called!==2)await new Promise(resolve=>setTimeout(resolve,1));finish();assert.equal((await third).status,500);
});
