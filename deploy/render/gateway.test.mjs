import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {readConfig,targetPort,proxyHeaders,gateway} from '../../scripts/web-render-entry.mjs';
const env={TAKO_MODE:'web',WEB_ORIGIN:'https://app.takoitalia.com',DATABASE_URL:'postgresql://test:test@db.project.supabase.co:5432/postgres?sslmode=require',JWT_SECRET:'09d8e4f04bae4939afb46890dc9c9ed267a1237c',UPLOADS_DIR:'/tmp/tako-uploads',UPLOADS_DRIVER:'supabase',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only-not-a-real-key',SUPABASE_STORAGE_BUCKET:'tako-menu-images'};
test('configuration fails before children spawn; no local database or weak secret',()=> {
 assert.equal(readConfig(env).port,10000);
 for(const bad of [{TAKO_MODE:'cloud'},{WEB_ORIGIN:'http://app.takoitalia.com'},{DATABASE_URL:'postgres://test:test@localhost/db'},{JWT_SECRET:'placeholder'},{PORT:'3001'},{EMBEDDED_DB:'1'},{TAKO_HTTPS:'1'},{UPLOADS_DIR:'relative'},{SUPABASE_SERVICE_ROLE_KEY:''},{SUPABASE_URL:'http://local'},{UPLOADS_DRIVER:'local'}]) assert.throws(()=>readConfig({...env,...bad}));
});
test('routing and forwarded boundary preserve same origin',()=> {
 const c=readConfig(env);
 for(const path of ['/staff/','/api/auth/me','/socket.io/?transport=polling','/uploads/a/b']) assert.equal(targetPort(path,c),3001);
 for(const path of ['/r/demo','/_next/static/app.js','/staffing']) assert.equal(targetPort(path,c),3002);
 const headers=proxyHeaders({headers:{host:'attacker','x-forwarded-proto':'http','x-forwarded-host':'attacker',forwarded:'host=evil',cookie:'sid=test',connection:'keep-alive'},socket:{remoteAddress:'127.0.0.1'}},c);
 assert.equal(headers.host,'app.takoitalia.com');assert.equal(headers['x-forwarded-proto'],'https');assert.equal(headers.cookie,'sid=test');assert.equal(headers.forwarded,undefined);
});
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
function get(port,path,host='app.takoitalia.com'){return new Promise((resolve,reject)=>{const r=request({hostname:'127.0.0.1',port,path,headers:{host,cookie:'sid=test'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});r.on('error',reject);r.end();});}
test('live gateway forwards cookies, serves customer path, probes both children, rejects wrong host',async t=> {
 const api=createServer((req,res)=>{res.setHeader('set-cookie','sid=ok; Secure');res.end(JSON.stringify({path:req.url,cookie:req.headers.cookie,proto:req.headers['x-forwarded-proto']}));});
 const customer=createServer((req,res)=>res.end('customer:'+req.url));
 const c={...readConfig(env),apiPort:await listen(api),customerPort:await listen(customer)};
 const publicServer=gateway(c);const port=await listen(publicServer);
 t.after(()=>{publicServer.close();api.close();customer.close();});
 const auth=await get(port,'/api/auth/me');assert.equal(auth.status,200);assert.equal(JSON.parse(auth.body).cookie,'sid=test');assert.equal(JSON.parse(auth.body).proto,'https');assert.ok(auth.headers['set-cookie']);
 assert.equal((await get(port,'/r/demo')).body,'customer:/r/demo');
 assert.equal((await get(port,'/health','internal-health')).status,200);
 assert.equal((await get(port,'/api/auth/me','attacker.example')).status,421);
 assert.equal((await get(port,'/')).headers.location,'/staff/');
});
test('websocket upgrade streams bidirectionally through the same public origin',async t=> {
 const api=createServer();api.on('upgrade',(req,socket,head)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');if(head.length)socket.write(head);socket.on('data',data=>socket.write(data));socket.on('end',()=>socket.end());});
 const c={...readConfig(env),apiPort:await listen(api)};const server=gateway(c);const port=await listen(server);
 t.after(()=>{server.close();api.close();});
 await new Promise((resolve,reject)=>{const r=request({hostname:'127.0.0.1',port,path:'/socket.io/?transport=websocket',headers:{host:c.host,connection:'Upgrade',upgrade:'websocket'}});r.on('upgrade',(_res,socket)=>{socket.on('error',reject);socket.once('data',data=>{assert.equal(data.toString(),'hello');socket.destroy();resolve();});socket.write('hello');});r.on('error',reject);r.end();});
});
