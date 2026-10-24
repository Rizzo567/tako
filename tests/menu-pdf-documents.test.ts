// PDF multipli (CONTRATTO §7) e PDF del menu a prezzo fisso (§6), 21/10/2026.
// Le route girano sul codice vero (requireAuth, webBoundary, route Fastify) con un finto database in memoria.
import {createRequire} from 'node:module'
import {describe,it,expect,vi,beforeEach} from 'vitest'
const state=vi.hoisted(()=>({rows:new Map<unknown,any[]>(),workspace:null as any,settings:{} as any,active:true,renders:0}))
const chunksText=(query:any)=>{try{return JSON.stringify(query?.queryChunks??'')}catch{return ''}}
const params=(query:any)=>(query?.queryChunks??[]).filter((c:any)=>typeof c==='string')
vi.mock('../packages/db/src/index.ts',async importOriginal=>{
 const real:any=await importOriginal()
 const chain=()=>{let table:unknown;const q:any={from(t:unknown){table=t;return q},where(){return q},orderBy(){return q},limit(){return q},innerJoin(){return q},then(res:any,rej:any){const rows=table===real.restaurants?[{id:'11111111-1111-4111-8111-111111111111',name:'Victoria',active:state.active,settings:structuredClone(state.settings)}]:state.rows.get(table)??[];return Promise.resolve(rows).then(res,rej)}};return q}
 const execute=async(query:any)=>{const text=chunksText(query)
  if(text.includes('FROM menu_workspaces'))return state.workspace?[structuredClone(state.workspace)]:[]
  if(text.includes('UPDATE restaurants SET settings')){const json=params(query).find((p:string)=>p.startsWith('['));state.settings={...state.settings,pdfDocuments:JSON.parse(json)};return []}
  if(text.includes("@>")){const needle=JSON.parse(params(query).find((p:string)=>p.startsWith('['))!)[0].shareToken;return (state.settings.pdfDocuments??[]).some((d:any)=>d.shareToken===needle)?[{id:'11111111-1111-4111-8111-111111111111',name:'Victoria',active:state.active,settings:structuredClone(state.settings)}]:[]}
  if(text.includes('SELECT settings FROM restaurants'))return [{settings:structuredClone(state.settings)}]
  return []}
 return {...real,db:{select(){return chain()},execute,update(){return {set(){return {where:async()=>[]}}}},transaction:async(fn:any)=>fn({execute})}}
})
vi.mock('../apps/server/src/index.js',()=>({io:{}}))
vi.mock('../apps/server/src/lib/menu-workspace-pdf.js',async importOriginal=>{const real:any=await importOriginal();return {...real,renderWorkspacePdf:async(...args:any[])=>{state.renders++;return real.renderWorkspacePdf(...args)}}})
import {sessions} from '../packages/db/src/index.ts'
import {webBoundary} from '../apps/server/src/lib/web-runtime.js'
import {menuWorkspaceRoutes,publicMenuPdfRoutes} from '../apps/server/src/routes/menu-workspace.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {renderWorkspacePdf,FIXED_PRICE_INCLUDED} from '../apps/server/src/lib/menu-workspace-pdf.js'
import {readPdfDocuments,mergePdfDocuments,defaultPdfDocument,documentWorkspace,documentEtag,etagMatches,newShareToken,SHARE_TOKEN,pdfDocumentsInputSchema} from '../apps/server/src/lib/menu-pdf-documents.js'
import {victoriaFixedWorkspace,VICTORIA_IDS as I} from './fixtures/victoria-fixed-workspace.mjs'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const origin='https://takoitalia.example',tenant='11111111-1111-4111-8111-111111111111'
process.env.WEB_ORIGIN=origin
process.env.TAKO_MENU_PDF_DOCUMENTS='1'
const unpdf=await import(new URL('../apps/server/node_modules/unpdf/dist/index.mjs',import.meta.url).href)
async function pdfText(bytes:Uint8Array){const pdf=await unpdf.getDocumentProxy(new Uint8Array(bytes));const {text}=await unpdf.extractText(pdf,{mergePages:false});return (text as string[]).map(t=>t.replace(/\s+/g,' '))}
const published=()=>workspaceSchema.parse(victoriaFixedWorkspace())
function seed(role='owner'){
 state.renders=0;state.active=true;state.settings={timezone:'Europe/Rome'};state.workspace={draft:published(),published:published(),revision:9,published_revision:7}
 state.rows=new Map<unknown,any[]>([[sessions,[{session:{token:'short-token',expiresAt:new Date('2099-01-01T00:00:00Z'),kind:'staff'},user:{id:'22222222-2222-4222-8222-222222222222',name:'Gio',email:'g@example.com',role,restaurantId:tenant,active:true}}]]])
}
async function app(){const a=Fastify();a.addHook('onRequest',webBoundary(origin));await a.register(menuWorkspaceRoutes as any,{prefix:'/api/menu-workspace'});await a.register(publicMenuPdfRoutes as any,{prefix:'/api/public'});await a.ready();return a}
const auth={authorization:'Bearer short-token',origin:'https://takoitalia.example'}
beforeEach(()=>seed())

describe('PDF del menu a prezzo fisso',()=>{
 it('con sectionIds: un blocco per opzione «NOME · prezzo» + nota + Compreso, sezioni ripetute, piatti mai con prezzo',async()=>{
  const w=published(),[page]=await pdfText(await renderWorkspacePdf(w,[I.cena],'it','Victoria',tenant))
  expect(page).toContain('Completo · 16,90 €');expect(page).toContain('Solo primo · 9,00 €');expect(page).toContain('Solo secondo · 10,00 €')
  expect(page).toContain('primo + secondo con contorno');expect(page.match(/Compreso: ¼ di vino oppure ½ l d'acqua \+ caffè/g)).toHaveLength(3)
  expect(page.indexOf('Completo')).toBeLessThan(page.indexOf('Solo primo'));expect(page.indexOf('Solo primo')).toBeLessThan(page.indexOf('Solo secondo'))
  expect(page.match(/Gnocchi alla sorrentina/g)).toHaveLength(2) // Completo + Solo primo: si ripete la VISTA
  expect(page.match(/Tagliata rucola e grana/g)).toHaveLength(2)
  expect(page.match(/Tiramisù della casa/g)).toHaveLength(1) // non compreso da nessuna opzione: una volta, in fondo
  expect(page.lastIndexOf('Dolci')).toBeGreaterThan(page.lastIndexOf('Solo secondo'))
  for(const price of ['11,00','20,00','4,00','5,00'])expect(page).not.toContain(price+' €')
 })
 it('senza sectionIds: riquadro opzioni in cima e tutti i Sottomenu, nessun riquadro se non ci sono opzioni',async()=>{
  const raw=victoriaFixedWorkspace();for(const f of raw.menus[3]!.formulas!)delete (f as any).sectionIds
  const [page]=await pdfText(await renderWorkspacePdf(workspaceSchema.parse(raw),[I.cena],'it','Victoria',tenant))
  expect(page.indexOf('Completo · 16,90 €')).toBeLessThan(page.indexOf('Primi'));expect(page.match(/Compreso:/g)).toHaveLength(1);expect(page.match(/Gnocchi alla sorrentina/g)).toHaveLength(1);expect(page).not.toContain('11,00 €')
  raw.menus[3]!.formulas=[];raw.menus[3]!.included=null
  const [empty]=await pdfText(await renderWorkspacePdf(workspaceSchema.parse(raw),[I.cena],'it','Victoria',tenant));expect(empty).not.toContain('Compreso');expect(empty).toContain('Gnocchi alla sorrentina');expect(empty).not.toContain('11,00 €')
 })
 it('alla carta invariato: prezzi stampati, opzioni conservate ma non mostrate',async()=>{
  const raw=victoriaFixedWorkspace();raw.menus[3]!.pricing='carta'
  const [page]=await pdfText(await renderWorkspacePdf(workspaceSchema.parse(raw),[I.cena],'it','Victoria',tenant));expect(page).toContain('11,00 €');expect(page).not.toContain('Solo primo');expect(page).not.toContain('Compreso')
 })
 it('«Compreso» identico alla pagina pubblica',async()=>{const {MENU_INCLUDED}=await import('../apps/web/src/lib/menu-fixed-price.js').catch(()=>({MENU_INCLUDED:null as any}));if(MENU_INCLUDED)expect(FIXED_PRICE_INCLUDED).toEqual(MENU_INCLUDED);expect(FIXED_PRICE_INCLUDED.it).toBe('Compreso')})
})

describe('documenti PDF: regole pure',()=>{
 it('merge mantiene i token per id, i nuovi nascono senza link; righe rovinate scartate; max 12',()=>{
  const token=newShareToken();expect(token).toMatch(SHARE_TOKEN);expect(token.length).toBeGreaterThanOrEqual(32)
  const existing=readPdfDocuments({pdfDocuments:[{id:I.pranzo,name:'Menu pranzo',menuIds:[I.pranzo],shareToken:token,updatedAt:new Date(0).toISOString()},{id:'rotto'},null]})
  expect(existing).toHaveLength(1)
  const next=mergePdfDocuments(existing,pdfDocumentsInputSchema.parse({documents:[{id:I.pranzo,name:'Menu pranzo',menuIds:[I.pranzo]},{name:'Menu cena',menuIds:[I.cena]}]}))
  expect(next[0]!.shareToken).toBe(token);expect(next[0]!.updatedAt).toBe(new Date(0).toISOString());expect(next[1]!.shareToken).toBeNull();expect(next[1]!.id).toMatch(/^[0-9a-f-]{36}$/)
  expect(pdfDocumentsInputSchema.safeParse({documents:Array.from({length:13},(_,n)=>({name:'D'+n,menuIds:[I.carta]}))}).success).toBe(false)
  expect(pdfDocumentsInputSchema.safeParse({documents:[{name:'D',menuIds:[I.carta,I.carta]}]}).success).toBe(false)
 })
 it('predefinito = tutti i Menu attivi; grafica del documento sopra quella del locale; ETag cambia con revisione e config',async()=>{
  const w=published();w.menus[1]!.active=false
  expect(defaultPdfDocument(w).menuIds).toEqual([I.carta,I.pranzo,I.cena])
  const merged=documentWorkspace(w,{config:{columns:2,headingColor:'#112233'}});expect(merged.pdf.columns).toBe(2);expect(merged.pdf.headingColor).toBe('#112233');expect(merged.pdf.showQr).toBe(false);expect(w.pdf.columns).toBe(1)
  const doc={id:I.cena,name:'Menu cena',menuIds:[I.cena]},base={doc,pdf:w.pdf,language:'it',restaurantName:'Victoria',businessDay:'2026-10-21'}
  const a=await documentEtag({...base,publishedRevision:7}),b=await documentEtag({...base,publishedRevision:8}),c=await documentEtag({...base,publishedRevision:7,doc:{...doc,config:{columns:2}}})
  expect(a).not.toBe(b);expect(a).not.toBe(c);expect(a).toBe(await documentEtag({...base,publishedRevision:7}));expect(etagMatches(`W/${a}, "x"`,a)).toBe(true);expect(etagMatches(undefined,a)).toBe(false)
 })
 it('ordine dei Menu: quello del documento',async()=>{
  const w=published(),[page]=await pdfText(await renderWorkspacePdf(w,[I.drinks,I.carta],'it','Victoria',tenant,undefined,{menuOrder:'given'}))
  expect(page.indexOf('Birra media alla spina')).toBeLessThan(page.indexOf('Bruschetta Victoria'))
  const [classic]=await pdfText(await renderWorkspacePdf(w,[I.drinks,I.carta],'it','Victoria',tenant));expect(classic.indexOf('Bruschetta Victoria')).toBeLessThan(classic.indexOf('Birra media alla spina'))
 })
})

describe('documenti PDF: route',()=>{
 it('flag spento (default in produzione) → tutte le route dei PDF multipli 404; il download classico /pdf non è toccato',async()=>{
  process.env.TAKO_MENU_PDF_DOCUMENTS='0';try{const a=await app()
   for(const [method,url] of [['GET','/api/menu-workspace/pdf-documents'],['PUT','/api/menu-workspace/pdf-documents'],['GET','/api/public/menu-pdf/abc']] as const){const r=await a.inject({method,url,headers:auth,payload:method==='PUT'?{documents:[]}:undefined});expect(r.statusCode,url).toBe(404)}
  }finally{process.env.TAKO_MENU_PDF_DOCUMENTS='1'}
 })
 it('nessun documento → predefinito; PUT salva, GET genera dal PUBBLICATO nell\'ordine e con la grafica del documento',async()=>{
  const a=await app()
  let r=await a.inject({method:'GET',url:'/api/menu-workspace/pdf-documents',headers:auth});expect(r.statusCode).toBe(200);expect(r.json().documents).toEqual([]);expect(r.json().default.menuIds).toEqual([I.carta,I.drinks,I.pranzo,I.cena]);expect(r.json().data.default.name).toBeTruthy()
  r=await a.inject({method:'PUT',url:'/api/menu-workspace/pdf-documents',headers:auth,payload:{documents:[{name:'Alla carta',menuIds:[I.carta,I.drinks]},{name:'Menu pranzo',menuIds:[I.pranzo]},{name:'Menu cena',menuIds:[I.cena],config:{columns:2}}]}})
  expect(r.statusCode).toBe(200);const docs=r.json().documents;expect(docs.map((d:any)=>d.name)).toEqual(['Alla carta','Menu pranzo','Menu cena']);expect(state.settings.pdfDocuments).toHaveLength(3);expect(state.settings.timezone).toBe('Europe/Rome')
  // la bozza cambia ma il PDF segue il PUBBLICATO
  state.workspace.draft.menus[3].formulas[0].price=99
  r=await a.inject({method:'GET',url:`/api/menu-workspace/pdf-documents/${docs[2].id}/pdf`,headers:auth});expect(r.statusCode).toBe(200);expect(r.headers['content-type']).toContain('application/pdf');expect(r.headers.etag).toMatch(/^"r7-/);expect(r.headers['content-disposition']).toContain('menu-cena.pdf')
  const [page]=await pdfText(r.rawPayload);expect(page).toContain('Completo · 16,90 €');expect(page).not.toContain('99,00')
  r=await a.inject({method:'PUT',url:'/api/menu-workspace/pdf-documents',headers:auth,payload:{documents:[{name:'X',menuIds:['99999999-9999-4999-8999-999999999999']}]}});expect(r.statusCode).toBe(404)
  r=await a.inject({method:'GET',url:'/api/menu-workspace/pdf-documents/99999999-9999-4999-8999-999999999999/pdf',headers:auth});expect(r.statusCode).toBe(404)
  await a.close()
 })
 it('link fisso: accesso pubblico, 304 per stessa revisione, nuova revisione → nuovo ETag, rigenera e revoca → 404',async()=>{
  const a=await app()
  const put=await a.inject({method:'PUT',url:'/api/menu-workspace/pdf-documents',headers:auth,payload:{documents:[{name:'Menu pranzo',menuIds:[I.pranzo]}]}});const id=put.json().documents[0].id
  let r=await a.inject({method:'POST',url:`/api/menu-workspace/pdf-documents/${id}/link`,headers:{...auth,origin}});expect(r.statusCode).toBe(200);const first=r.json().shareToken;expect(first).toMatch(SHARE_TOKEN);expect(r.json().shareUrl).toBe(`${origin}/api/public/menu-pdf/${first}`)
  r=await a.inject({method:'GET',url:`/api/public/menu-pdf/${first}`});expect(r.statusCode).toBe(200);expect(r.headers['content-type']).toContain('application/pdf');expect(r.headers['cache-control']).toBe('no-cache');const etag=r.headers.etag as string;expect(etag).toMatch(/^"r7-/)
  const [page]=await pdfText(r.rawPayload);expect(page).toContain('Completo · 12,00 €');expect(page).not.toContain('7,00 €')
  const before=state.renders;r=await a.inject({method:'GET',url:`/api/public/menu-pdf/${first}`,headers:{'if-none-match':etag}});expect(r.statusCode).toBe(304);expect(state.renders).toBe(before)
  state.workspace.published_revision=8;state.workspace.published.menus[2].formulas[0].price=13
  r=await a.inject({method:'GET',url:`/api/public/menu-pdf/${first}`,headers:{'if-none-match':etag}});expect(r.statusCode).toBe(200);expect(r.headers.etag).toMatch(/^"r8-/);expect((await pdfText(r.rawPayload))[0]).toContain('Completo · 13,00 €')
  r=await a.inject({method:'POST',url:`/api/menu-workspace/pdf-documents/${id}/link`,headers:{...auth,origin}});const second=r.json().shareToken;expect(second).not.toBe(first)
  expect((await a.inject({method:'GET',url:`/api/public/menu-pdf/${first}`})).statusCode).toBe(404)
  expect((await a.inject({method:'GET',url:`/api/public/menu-pdf/${second}`})).statusCode).toBe(200)
  // PUT successivo conserva il token
  await a.inject({method:'PUT',url:'/api/menu-workspace/pdf-documents',headers:auth,payload:{documents:[{id,name:'Pranzo',menuIds:[I.pranzo]}]}});expect(state.settings.pdfDocuments[0].shareToken).toBe(second)
  r=await a.inject({method:'DELETE',url:`/api/menu-workspace/pdf-documents/${id}/link`,headers:{...auth,origin}});expect(r.statusCode).toBe(200);expect(r.json().shareToken).toBeNull()
  expect((await a.inject({method:'GET',url:`/api/public/menu-pdf/${second}`})).statusCode).toBe(404)
  expect((await a.inject({method:'GET',url:'/api/public/menu-pdf/corto'})).statusCode).toBe(404)
  await a.close()
 })
 it('locale disattivato o mai pubblicato → 404 sul link',async()=>{
  const a=await app();const id=(await a.inject({method:'PUT',url:'/api/menu-workspace/pdf-documents',headers:auth,payload:{documents:[{name:'Cena',menuIds:[I.cena]}]}})).json().documents[0].id
  const token=(await a.inject({method:'POST',url:`/api/menu-workspace/pdf-documents/${id}/link`,headers:{...auth,origin}})).json().shareToken
  state.active=false;expect((await a.inject({method:'GET',url:`/api/public/menu-pdf/${token}`})).statusCode).toBe(404)
  state.active=true;state.workspace.published=null;expect((await a.inject({method:'GET',url:`/api/public/menu-pdf/${token}`})).statusCode).toBe(404)
  await a.close()
 })
 it('permessi: titolare (owner), manager e menu_editor sì; cameriere no',async()=>{
  for(const role of ['owner','manager','menu_editor','waiter']){seed(role);const a=await app()
   const r=await a.inject({method:'GET',url:'/api/menu-workspace/pdf-documents',headers:auth});expect(r.statusCode,role).toBe(role==='waiter'?403:200)
   const p=await a.inject({method:'PUT',url:'/api/menu-workspace/pdf-documents',headers:auth,payload:{documents:[{name:'Cena',menuIds:[I.cena]}]}});expect(p.statusCode,role).toBe(role==='waiter'?403:200)
   await a.close()}
  const a=await app();expect((await a.inject({method:'GET',url:'/api/menu-workspace/pdf-documents'})).statusCode).toBe(401);await a.close()
 })
})
