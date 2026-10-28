import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
const workspace=readFileSync('apps/dashboard/public/staff/src/13-menu-workspace.js','utf8');
const agency=readFileSync('apps/dashboard/public/staff/src/20-agency-dashboard.js','utf8');
const trialUrl=origin=>runInNewContext(workspace.match(/const MW_TRIAL_URL=(.*);\n/)[1],{URL,location:{origin}});
test('PROVA share link is only the private same-origin /trial-menu/<token> link',()=>{const f=trialUrl('https://takoitalia.com'),t='a'.repeat(64);
 assert.equal(f('https://takoitalia.com/trial-menu/'+t),'https://takoitalia.com/trial-menu/'+t);
 assert.equal(f('https://takoitalia.com/leads-demo/'+t),'https://takoitalia.com/trial-menu/'+t);
 for(const bad of ['http://takoitalia.com/trial-menu/'+t,'https://evil.example/trial-menu/'+t,'https://takoitalia.com/trial-menu/abc','https://takoitalia.com/trial-menu/'+t+'?x=1','https://takoitalia.com/l-osterietta-1','',null,undefined,'javascript:alert(1)'])assert.equal(f(bad),null,String(bad));});
test('PROVA workspace never publishes, hides public QR and shows the private note instead of the red error',()=>{
 assert.match(workspace,/const reviewPublish=async\(\)=>\{if\(trialMenu\)\{setError\('Menu di prova privato/);
 assert.match(workspace,/const confirmPublish=async\(\)=>\{if\(trialMenu\|\|/);
 assert.ok(workspace.includes("Menu di prova privato · visibile solo dal link di prova"));
 assert.ok(workspace.includes("if(trialMenu){if(!trialMenu.url)return;"),'QR of a PROVA never calls the public /qr route');
 assert.ok(workspace.includes("setError(e=>e==='Menu pubblicato non trovato'?'':e)"));
 assert.ok(readFileSync('apps/dashboard/public/staff/src/14-menu-print.js','utf8').includes('{!window.__takoTrialMenu&&<section className="mw-pdf-sharing">'));});
test('agency list filters: Prova = isTrial, 30gg = lead status trial from the existing leads API, shown only when loaded',()=>{
 assert.ok(agency.includes("filter==='trial'?location.isTrial===true:filter==='trial30'?leadStatus?.[location.id]==='trial'"));
 assert.ok(agency.includes('<option value="trial">Prova</option>{(leadStatus||filter===\'trial30\')&&<option value="trial30">30gg</option>}'));
 assert.ok(agency.includes("TakoAPI.get('/agency/leads')"));});
test('Condividi «Apri menu» opens in the same tab with a share hint and the return reopens Condividi once',()=>{
 assert.ok(workspace.includes('<a className="mw-pill" data-share="menu" href={customerShareUrl()} onClick={MW_OPEN_CUSTOMER_MENU}>Apri menu</a>'));
 const iife=workspace.split("/* Rientro da «Torna all'editor» partito da Condividi")[1].split('\n')[1];
 const store={'tako-staff-return-restore':'1','tako-staff-return':JSON.stringify({v:1,at:1,kind:'share',restaurantId:'r1'})},local={};
 const sessionStorage={getItem:k=>store[k]??null,removeItem:k=>{delete store[k]}},localStorage={setItem:(k,v)=>{local[k]=v}},window={};
 new Function('sessionStorage','localStorage','window',iife)(sessionStorage,localStorage,window);
 assert.deepEqual(window.__mwShareReturn,{restaurantId:'r1'});assert.equal(local['tako-dash-route'],'menu');assert.equal(store['tako-staff-return-restore'],undefined);
 const agencyHint={'tako-staff-return-restore':'1','tako-staff-return':JSON.stringify({v:1,at:1,restaurantId:'r1',search:'',filter:'all',scroll:0})},w2={};
 new Function('sessionStorage','localStorage','window',iife)({getItem:k=>agencyHint[k]??null,removeItem:k=>{delete agencyHint[k]}},localStorage,w2);
 assert.equal(w2.__mwShareReturn,undefined);assert.equal(agencyHint['tako-staff-return-restore'],'1','agency return is left to the agency list');});
test('public return pill: share hint needs the same restaurant confirmed by /api/auth/me (or agency); trial menu supported',()=>{
 const ret=readFileSync('apps/web-static/src/staff-return.ts','utf8'),main=readFileSync('apps/web-static/src/main.tsx','utf8');
 assert.ok(ret.includes("if(!rid||(pageRestaurantId&&pageRestaurantId!==rid))return false"));
 assert.ok(ret.includes("const me=await getJson('/api/auth/me',signal)")&&ret.includes("me.data?.restaurantId===rid"));
 assert.ok(main.includes("(route.kind==='digital-menu'||route.kind==='trial-menu')&&hasStaffReturnHint()"));});
