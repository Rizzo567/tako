import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {transform} from 'esbuild';import {createRequire} from 'node:module';const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const source=readFileSync('apps/web/src/components/WorkspaceMenuRenderer.tsx','utf8');
async function lib(file){const ctx={module:{exports:{}},require:createRequire(new URL('../../'+file,import.meta.url))};runInNewContext((await transform(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'})).code,ctx);return ctx.module.exports;}
async function component(){const stripped=source.replace(/^import .*$/gm,'').replace('export function WorkspaceMenuRenderer','function WorkspaceMenuRenderer');const ctx={...await lib('apps/web/src/lib/menu-copy.ts'),...await lib('apps/web/src/lib/menu-coming-soon.ts'),...await lib('apps/web/src/lib/menu-name-copy.ts'),...await lib('apps/web/src/lib/menu-price.ts'),...await lib('apps/web/src/lib/menu-sales-copy.ts'),...await lib('apps/web/src/lib/menu-fixed-price.ts'),...await lib('apps/web/src/lib/menu-day-order.ts'),...await lib('apps/web/src/lib/menu-motion.ts'),headerStyles:new Proxy({}, {get:(_,key)=>String(key)}),MenuHeaderControls:()=>null,AnimatedMenuLogo:props=>React.createElement('img',{src:props.src,alt:props.alt}),TakoLoading:()=>React.createElement('div',{role:'status'}),...await lib('apps/web/src/lib/menu-category-pages.ts'),...await lib('apps/web/src/lib/menu-palette.ts'),...React,...require('framer-motion'),React,useState:React.useState,useEffect:React.useEffect,useMemo:React.useMemo,useRef:React.useRef,Search:()=>null,Globe:()=>null,X:()=>null,formatEuro:v=>`${v} €`,Dish:props=>React.createElement('img',{'data-dish':props.name}),module:{exports:{}}};runInNewContext((await transform(stripped+'\nmodule.exports=WorkspaceMenuRenderer',{loader:'tsx',jsx:'transform'})).code,ctx);return ctx.module.exports;}

// Menu «a prezzo fisso» (21/10, CONTRATTO §6): resa con il renderer condiviso vero.
const F={completo:'f-completo',primo:'f-primo'};const S={primi:'s-primi',secondi:'s-secondi',contorni:'s-contorni'}
const dish=(id,name,price=0)=>({id,name,price,available:true,allergens:[],tags:[],additives:[],variants:[]})
const sections=[{id:S.primi,name:'Primi',parentSectionId:null,items:[dish('p1','Linguine',8),dish('p2','Gnocchi')]},{id:S.secondi,name:'Secondi',parentSectionId:null,items:[dish('s1','Nodino',11)]},{id:S.contorni,name:'Contorni',parentSectionId:null,items:[dish('c1','Patate')]}]
const fixed={id:'m',name:'Menu Cena',pricing:'fisso',included:'¼ di vino oppure ½ litro d’acqua + caffè',formulas:[{id:F.completo,name:'Completo',price:16.9,note:'Un primo + un secondo con contorno',sectionIds:[S.primi,S.secondi,S.contorni]},{id:F.primo,name:'Primo',price:9,note:'Un primo',sectionIds:[S.primi]}],sections}
const render=async(menu,extra={})=>renderToStaticMarkup(React.createElement(await component(),{menu,design:{showPrices:true},...extra}))
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&#x27;|&#39;/g,"'").replace(/\s+/g,' ')

test('con sectionIds: un blocco per opzione come il vecchio sottomenu COMPLETO (titolo maiuscolo, riga NOME … prezzo, nota + Compreso), poi le sezioni comprese senza prezzi',async()=>{
 const {fixedMenuView}=await lib('apps/web/src/lib/menu-fixed-price.ts')
 const view=JSON.parse(JSON.stringify(fixedMenuView(fixed,'it')))
 assert.deepEqual(view.sections.map(s=>[s.name,s.parentSectionId?'child':'root']),[['COMPLETO','root'],['Primi','child'],['Secondi','child'],['Contorni','child'],['PRIMO','root'],['Primi','child']])
 assert.equal(new Set(view.sections.map(s=>s.id)).size,view.sections.length,'id unici delle viste ripetute')
 assert.deepEqual(view.sections[0].items.map(i=>[i.name,i.price,i.description,i.displayMode]),[['Completo',16.9,'Un primo + un secondo con contorno. ¼ di vino oppure ½ litro d’acqua + caffè.','centered']])
 assert.equal(fixed.sections.length,3,'il documento non cambia')
 const html=await render(fixed),t=text(html)
 assert.equal(html.includes('data-fixed-price-box'),false,'niente riquadro in cima quando ci sono i blocchi')
 assert.match(t,/Completo 16.9 €/);assert.match(t,/Un primo \+ un secondo con contorno\. ¼ di vino oppure ½ litro d’acqua \+ caffè\./)
 for(const name of ['Linguine','Gnocchi','Nodino','Patate'])assert.ok(t.includes(name),name)
 assert.equal(/8 €|11 €/.test(t),false,'piatti senza prezzo')
 assert.equal((html.match(/data-price-divider/g)||[]).length,1,'solo la riga opzione ha i puntini')
})
test('la riga opzione non si apre né si ordina, i piatti sì',async()=>{
 const html=await render(fixed,{onOpen:()=>{}})
 assert.equal((html.match(/Apri [^"]+ per ordinare/g)||[]).some(s=>s.includes('Completo')),false)
 assert.ok(html.includes('Apri Linguine per ordinare'))
})
test('senza sectionIds: riquadro opzioni in cima con Compreso e tutti i sottomenu; nessuna opzione: niente riquadro',async()=>{
 const plain={...fixed,formulas:fixed.formulas.map(({sectionIds,...f})=>f)}
 const html=await render(plain),t=text(html)
 assert.ok(html.includes('data-fixed-price-box'));assert.equal((html.match(/data-formula-row/g)||[]).length,2)
 assert.match(t,/Compreso: ¼ di vino/);assert.ok(t.includes('Linguine'));assert.equal(/8 €|11 €/.test(t),false)
 const none=await render({...fixed,formulas:[],included:''})
 assert.equal(none.includes('data-fixed-price-box'),false);assert.equal(none.includes('data-formula-row'),false)
})
test('alla carta invariato: stesso markup con o senza campi del menu fisso, prezzi visibili',async()=>{
 const carta={id:'m',name:'Cena',sections}
 const a=await render(carta),b=await render({...carta,pricing:'carta',formulas:fixed.formulas,included:'x'})
 assert.equal(a,b);assert.match(text(a),/8 €/);assert.equal(a.includes('data-fixed-price-box'),false)
})
test('tradotto: titolo e nota dell’opzione arrivano già tradotti, «Compreso» nella lingua del menu',async()=>{
 const en={...fixed,included:'¼ wine or ½ l water + coffee',formulas:[{...fixed.formulas[0],name:'Full',note:'A first + a main'}]}
 const {fixedMenuView}=await lib('apps/web/src/lib/menu-fixed-price.ts')
 assert.equal(fixedMenuView(en,'en').sections[0].name,'FULL')
 assert.match(text(await render(en,{language:'en'})),/A first \+ a main\. ¼ wine or ½ l water \+ coffee\./)
 const box=await render({...en,formulas:[{id:'x',name:'Full',price:9}]},{language:'de'})
 assert.match(text(box),/Inklusive: ¼ wine/)
})
