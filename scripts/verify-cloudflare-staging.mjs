import assert from 'node:assert/strict';
const base=process.argv[2];
assert.ok(base&&new URL(base).protocol==='https:','Pass HTTPS staging URL');
const results=[];
for(const path of ['/staff/','/r/demo/menu','/menu-preview/demo','/api/auth/me','/uploads/test.png']) {
 const r=await fetch(new URL(path,base));const content=await r.text();
 const api=/^\/(api|uploads)\//.test(path);
 assert.equal(r.status,api?503:200);
 assert.ok((r.headers.get('content-type')??'').includes(api?'application/json':'text/html'));
 assert.equal(r.headers.get('set-cookie'),null,'Static/disabled backend must not set session cookies');
 if(!api)assert.ok(content.includes('<html'));
 results.push({path,status:r.status,contentType:r.headers.get('content-type')});
 if(path==='/staff/') {
  const scripts=[...content.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
  for(const asset of scripts){const ar=await fetch(new URL(asset,new URL(path,base)));const text=await ar.text();assert.equal(ar.status,200);assert.ok(!/^(<!doctype|<html)/i.test(text.trim()));assert.ok(!/sb_secret_[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/.test(text));results.push({asset,status:ar.status});}
 }
}
console.log(JSON.stringify({state:'STAGING_FRONTEND_ONLY_BACKEND_DISABLED',results},null,2));
