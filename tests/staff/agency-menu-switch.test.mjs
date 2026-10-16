import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const root=readFileSync(new URL('../../apps/dashboard/public/staff/src/07-app-root.js',import.meta.url),'utf8');
const agency=readFileSync(new URL('../../apps/dashboard/public/staff/src/20-agency-dashboard.js',import.meta.url),'utf8');
const paths=readFileSync(new URL('../../apps/dashboard/public/staff/src/14-customer-paths.js',import.meta.url),'utf8');
const MW_CUSTOMER_PATH=new Function(paths+';return MW_CUSTOMER_PATH')();
test('switching to the active restaurant refreshes the application identity',async()=>{
 let generation=0,state;
 const switchBody=root.split('const switchSession=async()=>{')[1].split('};window.takoSwitchSession')[0];
 const switchSession=new Function('TakoAPI','loadAll','setSessionGeneration','setState','return async()=>{'+switchBody+'}')({get:async()=>({user:{restaurantId:'same-id'},restaurant:{id:'same-id'}})},async()=>{},fn=>{generation=fn(generation)},next=>{state=next});
 await switchSession();assert.equal(generation,1);assert.equal(state.phase,'app');
 await switchSession();assert.equal(generation,2);assert.ok(root.includes("key={state.session.user.restaurantId+':'+sessionGeneration}"));
});
// Compito 1 (16/10): «Apri menu» apre la pagina pubblica vera e lascia solo un indizio locale (nessun cambio locale lato server).
test('Apri menu opens the real public page and stores the return point for this tab only',()=>{
 const body=agency.split(' const open=location=>{')[1].split('};\n')[0];
 const store={},assigned=[],posted=[];let busy='';
 const window={location:{assign:url=>assigned.push(url)}};
 const open=new Function('busy','window','setBusy','setError','sessionStorage','section','search','filter','MW_CUSTOMER_PATH','TakoAPI','return location=>{'+body+'}')('',window,v=>{busy=v},()=>{},{setItem:(k,v)=>{store[k]=v}},{current:{closest:()=>({scrollTop:420})}},'bim','published',MW_CUSTOMER_PATH,{post:(...a)=>posted.push(a)});
 open({id:'84fe4d77-2d87-5187-aa94-9c01840e99de',name:'Bim Bum Bar'});
 assert.deepEqual(assigned,['/bim-bum-bar']);assert.equal(posted.length,0);assert.equal(busy,'84fe4d77-2d87-5187-aa94-9c01840e99de');
 const hint=JSON.parse(store['tako-staff-return']);
 assert.equal(hint.v,1);assert.equal(hint.restaurantId,'84fe4d77-2d87-5187-aa94-9c01840e99de');assert.equal(hint.search,'bim');assert.equal(hint.filter,'published');assert.equal(hint.scroll,420);
 assert.equal(MW_CUSTOMER_PATH('26050ecd-2e55-4057-a4c5-bff2b449cd47'),'/r/26050ecd-2e55-4057-a4c5-bff2b449cd47/menu');
 assert.ok(!agency.includes("localStorage.setItem('tako-dash-route','menu')"));
});
test('return from the public menu restores filters and position once',()=>{
 const iife=agency.split("/* Rientro da «Torna all'editor»")[1].split('\nfunction ScreenAgencyDashboard(')[0].replace(/^[^\n]*\n/,'');
 const store={'tako-staff-return-restore':'1','tako-staff-return':JSON.stringify({v:1,at:1,restaurantId:'r1',search:'osteria',filter:'draft',scroll:300})};
 const sessionStorage={getItem:k=>store[k]??null,removeItem:k=>{delete store[k]}},window={};
 new Function('sessionStorage','window',iife)(sessionStorage,window);
 assert.deepEqual(window.__agencyFilters,{search:'osteria',filter:'draft'});assert.deepEqual(window.__agencyReturn,{restaurantId:'r1',scroll:300});assert.equal(store['tako-staff-return-restore'],undefined);
 const again={};new Function('sessionStorage','window',iife)(sessionStorage,again);assert.equal(again.__agencyFilters,undefined);
});
