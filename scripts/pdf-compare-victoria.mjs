#!/usr/bin/env node
// Confronto grafico PDF Victoria (21/10/2026, CONTRATTO §7 in docs/webapp/menu-prezzo-fisso-2026-10-21).
// Uso: node scripts/pdf-compare-victoria.mjs <workspace.json> <outdir> [--reference <pdf|url>] [--dpi 60]
// Genera col sistema NUOVO (documenti PDF, renderWorkspacePdf con ordine del documento) i 3 PDF di Victoria:
//   «Alla carta» = Alla carta + Drinks/Bevande, «Menu pranzo», «Menu cena»
// li converte in PNG pagina per pagina e mette accanto i PNG del PDF attuale (victoria-menu.pdf, solo lettura).
// <workspace.json>: un workspace (o una riga {draft,published}: si usa published, poi draft). Nessuna scrittura su DB.
// Conversione: pdftoppm (poppler) se presente, altrimenti pdfjs-dist del repo dentro Chrome headless (puppeteer-core).
import {build} from 'esbuild'
import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {dirname,resolve,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2),flag=(name,fallback)=>{const at=args.indexOf(name);if(at<0)return fallback;const value=args[at+1];args.splice(at,2);return value}
const reference=flag('--reference','https://takoitalia.com/takomenu-public/victoria-menu.pdf'),dpi=Number(flag('--dpi','60'))
const [workspacePath,outArg]=args
if(!workspacePath||!outArg){console.error('Uso: node scripts/pdf-compare-victoria.mjs <workspace.json> <outdir> [--reference <pdf|url>] [--dpi 60]');process.exit(2)}
const outdir=resolve(outArg)

// 1) Il renderer è TypeScript: bundle al volo con esbuild, dipendenze esterne risolte da apps/server.
const cache=join(root,'apps/server/node_modules/.cache/pdf-compare');await mkdir(cache,{recursive:true})
const entry=join(cache,'entry.ts'),bundle=join(cache,'entry.mjs')
await writeFile(entry,`export {renderWorkspacePdf} from ${JSON.stringify(join(root,'apps/server/src/lib/menu-workspace-pdf.ts'))}
export {workspaceSchema} from ${JSON.stringify(join(root,'apps/server/src/lib/menu-workspace-contract.ts'))}
export {documentWorkspace,documentMenuIds,documentFilename} from ${JSON.stringify(join(root,'apps/server/src/lib/menu-pdf-documents.ts'))}
`)
await build({entryPoints:[entry],outfile:bundle,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error',
 // Font del PDF: il renderer li cerca accanto a src/lib (../../assets/fonts); nel bundle si punta alla cartella vera.
 define:{},banner:{js:`import {createRequire as __cr} from 'node:module';const require=__cr(${JSON.stringify(join(root,'apps/server/package.json'))});`},
 plugins:[{name:'fonts-url',setup(b){b.onLoad({filter:/menu-workspace-pdf\.ts$/},async a=>({contents:(await readFile(a.path,'utf8')).replace("new URL('../../assets/fonts/',import.meta.url)",JSON.stringify(pathToFileURL(join(root,'apps/server/assets/fonts/')).href)),loader:'ts'}))}}]})
const lib=await import(pathToFileURL(bundle).href+'?t='+Date.now())

// 2) Workspace e documenti di Victoria (Menu riconosciuti per nome).
const raw=JSON.parse(await readFile(resolve(workspacePath),'utf8')),source=raw.published??raw.draft??raw.workspace??raw
const workspace=lib.workspaceSchema.parse(source)
const find=(...names)=>workspace.menus.find(m=>names.some(n=>m.name.trim().toLowerCase()===n))??workspace.menus.find(m=>names.some(n=>m.name.toLowerCase().includes(n)))
const carta=find('alla carta','carta'),drinks=find('drinks','bevande'),pranzo=find('menu pranzo','pranzo'),cena=find('menu cena','cena')
const documents=[{name:'Alla carta',menus:[carta,drinks]},{name:'Menu pranzo',menus:[pranzo]},{name:'Menu cena',menus:[cena]}].map(d=>({id:crypto.randomUUID(),name:d.name,menuIds:d.menus.filter(Boolean).map(m=>m.id)}))
for(const d of documents)if(!d.menuIds.length)console.warn(`! Nessun Menu trovato per «${d.name}» (nomi presenti: ${workspace.menus.map(m=>m.name).join(', ')})`)

await mkdir(outdir,{recursive:true})
for(const name of await readdir(outdir))if(/\.(png|pdf)$/.test(name))await rm(join(outdir,name))
const pdfs=[]
for(const doc of documents){if(!doc.menuIds.length)continue
 const w=lib.documentWorkspace(workspace,doc),menuIds=lib.documentMenuIds(w,doc)
 const bytes=await lib.renderWorkspacePdf(w,menuIds,w.defaultLanguage,'Victoria','528e263c-634e-4695-9632-6c5cc6a3302f',undefined,{timezone:'Europe/Rome',menuOrder:'given',ignoreSchedules:true})
 const file=join(outdir,'nuovo-'+lib.documentFilename(doc.name));await writeFile(file,bytes);pdfs.push({label:'nuovo-'+lib.documentFilename(doc.name).replace(/\.pdf$/,''),file})
 console.log(`✓ ${doc.name}: ${menuIds.length} Menu → ${file} (${bytes.length} byte)`)}

// 3) PDF attuale di Victoria (solo lettura).
const refFile=join(outdir,'attuale-victoria-menu.pdf')
if(/^https?:/.test(reference)){const response=await fetch(reference);if(!response.ok)throw new Error(`Download PDF attuale fallito: HTTP ${response.status}`);await writeFile(refFile,Buffer.from(await response.arrayBuffer()))}
else await writeFile(refFile,await readFile(resolve(reference)))
pdfs.push({label:'attuale-victoria-menu',file:refFile})

// 4) PNG pagina per pagina.
const pdftoppm=['/opt/homebrew/bin/pdftoppm','/usr/local/bin/pdftoppm','/usr/bin/pdftoppm'].find(existsSync)
async function toPngs({label,file}){
 if(pdftoppm){execFileSync(pdftoppm,['-r',String(dpi),'-png',file,join(outdir,label)]);return}
 const puppeteer=(await import('puppeteer-core')).default,pdfjs=dirname(createRequire(join(root,'package.json')).resolve('pdfjs-dist/package.json'))
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']})
 try{const page=await browser.newPage();await page.goto(pathToFileURL(join(pdfjs,'legacy/build/pdf.mjs')).href)
  const data=(await readFile(file)).toString('base64')
  const images=await page.evaluate(async(data,worker,scale)=>{const pdfjs=await import(location.href);pdfjs.GlobalWorkerOptions.workerSrc=worker;const doc=await pdfjs.getDocument({data:Uint8Array.from(atob(data),c=>c.charCodeAt(0))}).promise;const out=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),v=p.getViewport({scale}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;out.push(c.toDataURL('image/png').split(',')[1])}return out},data,pathToFileURL(join(pdfjs,'legacy/build/pdf.worker.mjs')).href,dpi/72)
  for(const [n,b64] of images.entries())await writeFile(join(outdir,`${label}-${String(n+1).padStart(2,'0')}.png`),Buffer.from(b64,'base64'))
 }finally{await browser.close()}
}
for(const pdf of pdfs)await toPngs(pdf)

// 5) Indice HTML affiancato (apri nel browser): una riga per documento, pagine in fila.
const pngs=(await readdir(outdir)).filter(n=>n.endsWith('.png')).sort()
const rows=pdfs.map(p=>`<h2>${p.label}</h2><div class="row">${pngs.filter(n=>n.startsWith(p.label+'-')).map(n=>`<img src="${n}" alt="${n}">`).join('')}</div>`).join('\n')
await writeFile(join(outdir,'index.html'),`<!doctype html><meta charset="utf-8"><title>Confronto PDF Victoria</title><style>body{font:14px system-ui;margin:16px;background:#f4f4f4}.row{display:flex;gap:8px;overflow-x:auto}img{height:420px;border:1px solid #ccc;background:#fff}</style><h1>Confronto PDF Victoria — nuovo sistema vs PDF attuale</h1>${rows}`)
console.log(`✓ ${pngs.length} PNG (${pdftoppm?'pdftoppm':'pdfjs-dist in Chrome'}) + index.html in ${outdir}`)
