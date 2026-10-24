// Menu a prezzo fisso + PDF multipli nella dashboard (21/10/2026): logica pura, forma delle chiamate API, permessi del titolare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transform} from 'esbuild';

const J=v=>JSON.parse(JSON.stringify(v));
const eq=(a,b,m)=>assert.deepEqual(J(a),J(b),m);
const load=async(file,ctx)=>{runInNewContext((await transform(readFileSync('apps/dashboard/public/staff/src/'+file,'utf8'),{loader:'jsx'})).code,ctx);return ctx;};
const fixedCtx=await load('13-menu-fixed-price.js',{window:{},Intl});
const F=fixedCtx.window.TakoMenuFixed;
const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const menu=()=>({id:U(1),name:'Pranzo',sections:[
 {id:U(10),name:'Primi',items:[{id:U(100),name:'Pasta al pomodoro',price:9,description:'Pomodoro fresco',imageUrl:'https://x/p.jpg',allergens:['glutine'],hidden:false,available:true},{id:U(101),name:'Risotto ai funghi',price:12,description:'Porcini',imageUrl:null,allergens:[],hidden:true,available:true},{id:U(102),name:'Lasagna',price:11,description:null,imageUrl:null,allergens:['latte'],hidden:false,available:false}]},
 {id:U(11),name:'Secondi',items:[{id:U(110),name:'Pollo',price:14}]},{id:U(12),name:'Contorni',items:[]}]});

test('carta → fisso → carta conserva i prezzi dei piatti e le opzioni',()=>{
 const m=menu(),prices=()=>m.sections.flatMap(s=>s.items.map(i=>i.price));const before=prices();
 assert.equal(F.setPricing(m,'fisso'),true);assert.equal(m.pricing,'fisso');eq(m.formulas,[]);eq(prices(),before);
 F.addFormula(m,U(900),'Completo');F.updateFormula(m,U(900),{price:'12,50',note:'bevanda inclusa'});
 assert.equal(F.setPricing(m,'carta'),true);assert.equal(m.pricing,'carta');eq(prices(),before);assert.equal(m.formulas.length,1,'le opzioni restano salvate');
 F.setPricing(m,'fisso');eq(m.formulas[0],{id:U(900),name:'Completo',price:12.5,note:'bevanda inclusa',translations:{}});
 assert.equal(F.setPricing(m,'boh'),false);assert.equal(m.pricing,'fisso');
});

test('opzioni: aggiungi, modifica, riordina, togli; prezzi non validi ignorati; massimo 12',()=>{
 const m=menu();F.setPricing(m,'fisso');['Completo','Solo primo','Solo secondo'].forEach((n,i)=>F.addFormula(m,U(900+i),n));
 assert.equal(F.updateFormula(m,U(901),{price:'abc'}),false);assert.equal(m.formulas[1].price,0);
 assert.equal(F.updateFormula(m,U(901),{price:'9'}),true);F.updateFormula(m,U(901),{note:'   '});assert.equal(m.formulas[1].note,null);
 assert.equal(F.moveFormula(m,U(902),-1),true);eq(m.formulas.map(f=>f.name),['Completo','Solo secondo','Solo primo']);
 assert.equal(F.moveFormula(m,U(900),-1),false);
 assert.equal(F.removeFormula(m,U(900)),true);eq(m.formulas.map(f=>f.id),[U(902),U(901)]);
 for(let i=0;i<20;i++)F.addFormula(m,U(950+i));assert.equal(m.formulas.length,12);
 F.setIncluded(m,'¼ di vino + caffè');assert.equal(m.included,'¼ di vino + caffè');F.setIncluded(m,' ');assert.equal(m.included,null);
});

test('sectionIds: scelta in ordine dei Sottomenu, vuoto = chiave assente (tutto il menu)',()=>{
 const m=menu();F.setPricing(m,'fisso');F.addFormula(m,U(900),'Solo secondo');
 F.toggleSection(m,U(900),U(12));F.toggleSection(m,U(900),U(11));eq(m.formulas[0].sectionIds,[U(11),U(12)]);
 F.toggleSection(m,U(900),U(11));F.toggleSection(m,U(900),U(12));assert.equal('sectionIds' in m.formulas[0],false);
 assert.equal(F.toggleSection(m,U(900),U(999)),false,'Sottomenu inesistente');
});

test('«Tutto il menu»: selezionato quando nessun Sottomenu è scelto; sceglierlo toglie sectionIds (dato invariato: chiave assente)',()=>{
 const m=menu();F.setPricing(m,'fisso');F.addFormula(m,U(900),'Completo');
 assert.equal(F.coversAll(m.formulas[0]),true,'opzione nuova = tutto il menu');
 F.toggleSection(m,U(900),U(10));F.toggleSection(m,U(900),U(11));assert.equal(F.coversAll(m.formulas[0]),false);eq(m.formulas[0].sectionIds,[U(10),U(11)]);
 assert.equal(F.setAllSections(m,U(900)),true);assert.equal('sectionIds' in m.formulas[0],false);assert.equal(F.coversAll(m.formulas[0]),true);
 assert.equal(F.setAllSections(m,U(999)),false,'opzione inesistente');
 assert.equal(F.coversAll({sectionIds:[]}),true,'elenco vuoto = tutto il menu');
});

test('sostituisci i piatti: stesso nome conserva i dati, i nuovi nascono a prezzo 0, chi manca si nasconde (mai eliminato)',()=>{
 const m=menu();F.setPricing(m,'fisso');
 const names=F.parseList('- risotto ai FUNGHI\n\n• Pasta al pomodoro\n1. Gnocchi al pesto\nPasta al pomodoro\n');
 eq(names,['risotto ai FUNGHI','Pasta al pomodoro','Gnocchi al pesto']);
 const plan=F.planReplace(m.sections[0],names);
 eq(plan.keep.map(k=>[k.item.id,k.wasHidden]),[[U(101),true],[U(100),false]]);eq(plan.add,['Gnocchi al pesto']);eq(plan.hide.map(i=>i.id),[U(102)]);
 let n=0;F.applyReplace(m,U(10),names,name=>({id:U(500+(n++)),name,price:7,description:null,hidden:false,available:true}));
 const items=m.sections[0].items;eq(items.map(i=>i.name),['Risotto ai funghi','Pasta al pomodoro','Gnocchi al pesto','Lasagna']);
 assert.equal(items[0].hidden,false);assert.equal(items[0].price,12,'prezzo salvato intatto');assert.equal(items[0].description,'Porcini');
 assert.equal(items[1].imageUrl,'https://x/p.jpg');eq(items[1].allergens,['glutine']);
 assert.equal(items[2].price,0,'piatto nuovo in menu fisso a prezzo 0');
 assert.equal(items[3].hidden,true);assert.equal(items[3].price,11);eq(items[3].allergens,['latte']);
 assert.equal(m.sections[1].items.length,1,'gli altri Sottomenu non cambiano');
 // domani il piatto nascosto torna col nome, con i suoi dati
 F.applyReplace(m,U(10),['Lasagna'],()=>assert.fail('non deve creare'));assert.equal(m.sections[0].items[0].id,U(102));assert.equal(m.sections[0].items[0].hidden,false);assert.equal(m.sections[0].items[0].available,true);
 assert.equal(m.sections[0].items.length,4,'nessun piatto eliminato');
});

test('API documenti PDF: forma esatta delle chiamate del CONTRATTO §7',async()=>{
 const calls=[];const res=(body,ok=true,status=200)=>({ok,status,json:async()=>body,blob:async()=>({size:1200,type:'application/pdf'})});
 const ctx=await load('14-menu-pdf-documents.js',{window:{},location:{origin:'https://dash.example'},fetch:async(url,opt={})=>{calls.push([opt.method||'GET',url,opt.body?JSON.parse(opt.body):undefined,opt.credentials]);return url.endsWith('/pdf')?res(null):res({data:{documents:[{id:U(1),name:'Pranzo',menuIds:[U(2)],shareToken:null}],default:{name:'Menu',menuIds:[U(2)]}}});}});
 const api=ctx.window.TakoPdfDocumentsApi;
 const list=await api.list();assert.equal(list.documents[0].name,'Pranzo');assert.equal(list.default.name,'Menu');
 await api.save([{id:U(1),name:' Pranzo ',menuIds:[U(2),U(3)],config:null,shareToken:'x'.repeat(40)},{id:null,name:'Cena',menuIds:[U(3)],config:{columns:2}}]);
 await api.createLink(U(1));await api.revokeLink(U(1));const blob=await api.download(U(1));assert.equal(blob.type,'application/pdf');
 eq(calls.map(c=>c[0]+' '+c[1]),['GET /api/menu-workspace/pdf-documents','PUT /api/menu-workspace/pdf-documents',`POST /api/menu-workspace/pdf-documents/${U(1)}/link`,`DELETE /api/menu-workspace/pdf-documents/${U(1)}/link`,`GET /api/menu-workspace/pdf-documents/${U(1)}/pdf`]);
 eq(calls[1][2],{documents:[{id:U(1),name:'Pranzo',menuIds:[U(2),U(3)]},{name:'Cena',menuIds:[U(3)],config:{columns:2}}]},'nuovi senza id, niente token dal client');
 assert.ok(calls.every(c=>c[3]==='include'));
 assert.equal(api.publicUrl('abc'),'https://dash.example/api/public/menu-pdf/abc');
});

test('API documenti PDF: errore del server mostrato con il suo messaggio',async()=>{
 const ctx=await load('14-menu-pdf-documents.js',{window:{},location:{origin:'x'},fetch:async()=>({ok:false,status:403,json:async()=>({error:{message:'Permesso negato'}})})});
 await assert.rejects(ctx.window.TakoPdfDocumentsApi.list(),/Permesso negato/);
});

test('titolare (owner): l’editor dà contenuti, stile e PDF; i comandi nuovi sono agganciati senza condizioni di ruolo extra',async()=>{
 const src=readFileSync('apps/dashboard/public/staff/src/13-menu-workspace.js','utf8');
 const ctx={window:{__takoRole:'owner'},FormData:class{},fetch:async()=>({ok:true,json:async()=>({data:{menus:[]},revision:3,publishedRevision:3})})};
 runInNewContext((await transform(src,{loader:'jsx'})).code,ctx);
 const doc=await ctx.window.TakoMenuWorkspaceContract.load();eq([...doc.capabilities],['content','style','pdf']);
 ctx.window.__takoRole='cameriere';eq([...(await ctx.window.TakoMenuWorkspaceContract.load()).capabilities],[]);
 assert.match(src,/fixed&&window\.MenuFixedPricePanel/);assert.match(src,/!fixed&&<MenuWorkspaceQuickPrice/);assert.match(src,/!\(fixed&&f\.key==='price'\)/);
 assert.match(src,/window\.MenuReplaceItems&&<window\.MenuReplaceItems/);assert.match(src,/tab==='qr'&&!trialMenu&&can\('pdf'\)&&window\.MenuPdfDocuments/);
 assert.match(src,/if\(pricing==='fisso'\)window\.TakoMenuFixed\?\.setPricing\(created,'fisso'\)/);
 const html=readFileSync('apps/dashboard/public/staff/index.html','utf8');
 assert.ok(html.indexOf('13-menu-fixed-price.js')<html.indexOf('13-menu-workspace.js')&&html.includes('14-menu-pdf-documents.js')&&html.includes('menu-fixed-pdf.css'));
});
