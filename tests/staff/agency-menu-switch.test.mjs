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
// 16/10 sera: «Apri menu» sulla card agenzia apre la dashboard ristoratore del locale (editor Piatti), non la pagina pubblica.
test('Apri menu switches the active restaurant like the sidebar selector and opens the menu editor',async()=>{
 const body=agency.split(' const open=async location=>{')[1].split('};\n')[0];
 const store={},posted=[],assigned=[];let busy='',switched=0,route='';
 const window={location:{assign:url=>assigned.push(url),reload:()=>{}},takoSwitchSession:async()=>{switched++}};
 const localStorage={setItem:(k,v)=>{store[k]=v}};
 const open=new Function('busy','window','setBusy','setError','localStorage','TakoAPI','mounted','return async location=>{'+body+'}')('',window,v=>{busy=v},()=>{},localStorage,{post:async(...a)=>posted.push(a)},{current:true});
 await open({id:'84fe4d77-2d87-5187-aa94-9c01840e99de',name:'Bim Bum Bar'});
 assert.deepEqual(posted,[['/web-locations/switch',{restaurantId:'84fe4d77-2d87-5187-aa94-9c01840e99de'}]]);
 assert.equal(store['tako-dash-route'],'menu');assert.equal(window.__takoRoute,'menu');assert.equal(switched,1);assert.deepEqual(assigned,[]);
 assert.ok(!body.includes('tako-staff-return'));assert.ok(!body.includes('MW_CUSTOMER_PATH'));assert.ok(!body.includes('location.assign'));
 assert.equal(MW_CUSTOMER_PATH('26050ecd-2e55-4057-a4c5-bff2b449cd47'),'/r/26050ecd-2e55-4057-a4c5-bff2b449cd47/menu');
});
test('return from the public menu restores filters and position once',()=>{
 const iife=agency.split("/* Rientro da «Torna all'editor»")[1].split('\nfunction ScreenAgencyDashboard(')[0].replace(/^[^\n]*\n/,'');
 const store={'tako-staff-return-restore':'1','tako-staff-return':JSON.stringify({v:1,at:1,restaurantId:'r1',search:'osteria',filter:'draft',scroll:300})};
 const sessionStorage={getItem:k=>store[k]??null,removeItem:k=>{delete store[k]}},window={};
 new Function('sessionStorage','window',iife)(sessionStorage,window);
 assert.deepEqual(window.__agencyFilters,{search:'osteria',filter:'draft'});assert.deepEqual(window.__agencyReturn,{restaurantId:'r1',scroll:300});assert.equal(store['tako-staff-return-restore'],undefined);
 const again={};new Function('sessionStorage','window',iife)(sessionStorage,again);assert.equal(again.__agencyFilters,undefined);
});
