import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {localEnvironment,loadLocalEnvironment,checkPorts} from '../../scripts/start-webapp.mjs';
import {readConfig,proxyHeaders,targetPort} from '../../scripts/web-render-entry.mjs';
const fake={DATABASE_URL:'postgresql://test:test@db.project.supabase.co:5432/postgres?sslmode=require',JWT_SECRET:'912566ec256426442bc256aa856284422ca185ff',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only-not-a-real-key',SUPABASE_STORAGE_BUCKET:'tako-menu-images'};
test('local launcher overrides unsafe flags and isolates all three ports',()=> {
 const env=localEnvironment({...fake,NODE_ENV:'production',PORT:'4317',EMBEDDED_DB:'1',TAKO_HTTPS:'1',SERVER_HOST:'0.0.0.0'},'/tmp/project',{});const c=readConfig(env);
 assert.equal(c.origin,'http://localhost:5137');assert.equal(c.bindHost,'127.0.0.1');assert.deepEqual([c.port,c.apiPort,c.customerPort],[5137,5131,5132]);
 assert.equal(env.SERVER_HOST,'127.0.0.1');assert.equal(env.TAKO_DISABLE_REGISTRATION,'1');assert.equal(env.TAKO_MULTI_TENANT,'1');assert.equal(env.EMBEDDED_DB,'0');assert.equal(env.NEXT_PUBLIC_API_URL,'http://127.0.0.1:5131');
 assert.equal(targetPort('/api/auth/me',c),5131);assert.equal(targetPort('/r/demo',c),5132);
 const h=proxyHeaders({headers:{host:c.host,'x-forwarded-for':'attacker','x-forwarded-proto':'https'},socket:{remoteAddress:'127.0.0.1'}},c);assert.equal(h['x-forwarded-proto'],'http');assert.equal(h['x-forwarded-for'],'127.0.0.1');
});
test('production HTTP, public HTTP, invalid ports and missing backend credentials fail closed',()=> {
 const env=localEnvironment(fake,'/tmp/project',{});
 for(const override of [{NODE_ENV:'production'},{WEB_ORIGIN:'http://192.168.1.1:5137'},{WEB_ORIGIN:'http://app.takoitalia.com'},{API_PORT:'5137'},{CUSTOMER_PORT:'NaN'},{DATABASE_URL:''},{SUPABASE_SERVICE_ROLE_KEY:''}]) assert.throws(()=>readConfig({...env,...override}));
 assert.equal(readConfig({...env,WEB_ORIGIN:'http://127.0.0.1:5137'}).bindHost,'127.0.0.1');
});
test('root .env.web parser loads quoted secrets without displaying them and rejects missing file',async t=> {
 const root=await mkdtemp(join(tmpdir(),'tako-local-env-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await assert.rejects(()=>loadLocalEnvironment(root),/Missing .env.web/);
 await writeFile(join(root,'.env.web'),Object.entries(fake).map(([k,v])=>`${k}="${v}"`).join('\n'));
 const env=await loadLocalEnvironment(root);assert.equal(env.DATABASE_URL,fake.DATABASE_URL);assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,fake.SUPABASE_SERVICE_ROLE_KEY);
});
test('occupied port is reported without terminating its existing listener',async t=> {
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');t.after(()=>listener.close());const port=listener.address().port;
 await assert.rejects(()=>checkPorts([port]),/occupied/);assert.equal(listener.listening,true);
});
