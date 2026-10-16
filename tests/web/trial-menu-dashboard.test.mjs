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
