import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync('apps/dashboard/public/staff/src/13-menu-workspace.js','utf8');
test('owner WhatsApp panel polls every 3 s only while pending, visible and open, then shows Collegato with time',()=>{
 assert.ok(s.includes("const timer=setInterval(poll,3000)"));
 assert.ok(s.includes("if(!alive||inFlight||window.document.hidden)return"));
 assert.ok(s.includes("return()=>{alive=false;clearInterval(timer);window.document.removeEventListener('visibilitychange',visible)}},[waitingPhone]);"));
 assert.ok(s.includes("if(r.status==='linked'){setLinkedAt(new Date());setState(r);}"));
 assert.ok(s.includes("prefers-reduced-motion: reduce)').matches)return;const t=window.TakoMenuMotion"));});
