import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {workspaceSchema,type Workspace} from '../../apps/server/src/lib/menu-workspace-contract.js'
import {publicWorkspace} from '../../apps/server/src/lib/menu-workspace-schedule.js'
import {fileURLToPath} from 'node:url'
import {renderWorkspacePdf} from '../../apps/server/src/lib/menu-workspace-pdf.js'
import {completeness} from './import.js'

/** Printed archive ignores serving hours, but preserves deliberately hidden content. */
export function archiveWorkspace(source:Workspace,menuId:string):Workspace {
 const w=structuredClone(source),menu=w.menus.find(m=>m.id===menuId);
 if(!menu)throw Error('Archive menu missing');
 w.menus=[menu];menu.active=true;delete menu.schedule;
 for(const section of menu.sections){delete section.schedule;for(const item of section.items)delete item.schedule}
 return workspaceSchema.parse(w)
}
export function archiveItemNames(w:Workspace,language:string):string[] {
 const view=publicWorkspace(w.pdf.includeUnavailable?{...w,menus:w.menus.map(m=>({...m,sections:m.sections.map(s=>({...s,items:s.items.map(i=>({...i,available:true}))}))}))}:w);
 const lang=w.pdf.translationActive===false?w.defaultLanguage:language;
 return view.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>w.pdf.translationNamesPolicy==='auto'&&(i.description||i.translations[lang]?.description)?i.name:i.translations[lang]?.name??i.name)));
}
export async function verifyArchivePdf(bytes:Buffer,names:string[]) {
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,isEvalSupported:false});
 try {
  const pdf=await task.promise;let text='';
  for(let page=1;page<=pdf.numPages;page++){const content=await(await pdf.getPage(page)).getTextContent();text+=content.items.map(i=>'str'in i?i.str:'').join(' ')+' ';}
  const normalize=(v:string)=>v.normalize('NFKC').replace(/\s+/gu,'');
  const actual=normalize(text);
  for(const name of names)for(const word of name.split(/\s+/u).filter(Boolean))if(!actual.includes(normalize(word)))throw Error('Archive PDF missing expected item text');
  return {pages:pdf.numPages,visibleItems:names.length,textVerified:true};
 } finally {await task.destroy()}
}

/** Run only on a fully translated, asset-remapped export; never reads MenuSmart. */
async function main(){
 const {loadLocalEnvironment}=await import('../start-webapp.mjs')
 Object.assign(process.env,await loadLocalEnvironment())
 // These exports accompany the local preview; a public QR requires verified hosting.
 delete process.env.WEB_ORIGIN
 const [input,out]=process.argv.slice(2)
 if(!input||!out)throw Error('Usage: export-pdfs.ts <imported.json> <private-output-folder>')
 const data=JSON.parse(await readFile(resolve(input),'utf8'))
 await mkdir(resolve(out),{recursive:true,mode:0o700})
 const manifest:any[]=[]
 for(const restaurant of data.restaurants){
  const workspace=workspaceSchema.parse(restaurant.workspace)
  if(completeness(workspace).length)throw Error(`Incomplete twelve-language menu: ${restaurant.name}`)
  for(const language of workspace.languages){
   if(language!==workspace.defaultLanguage)for(const menu of workspace.menus){
    for(const entity of [menu,...menu.sections,...menu.sections.flatMap(s=>s.items)]){
     const t=entity.translations?.[language]
     if(!t?.name?.trim()||(entity.description?.trim()&&!t.description?.trim()))throw Error(`Incomplete translation: ${restaurant.name}/${language}/${entity.id}`)
    }
   }
  }
  const folder=join(resolve(out),restaurant.restaurantId)
  await mkdir(folder,{recursive:true,mode:0o700})
  for(const menu of workspace.menus)for(const language of workspace.languages){
   const file=join(folder,`${menu.id}-${language}.pdf`)
   const archive=archiveWorkspace(workspace,menu.id)
   const bytes=await renderWorkspacePdf(archive,[menu.id],language,`${restaurant.name} — ${menu.name}`,restaurant.restaurantId)
   if(bytes.length<1000||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid generated PDF')
   const verification=await verifyArchivePdf(bytes,archiveItemNames(archive,language))
   await writeFile(file+'.tmp',bytes,{mode:0o600});await rename(file+'.tmp',file)
   manifest.push({restaurantId:restaurant.restaurantId,name:restaurant.name,menuId:menu.id,language,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...verification})
   await writeFile(join(resolve(out),'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600})
  }
  console.log(JSON.stringify({restaurant:restaurant.name,pdfs:manifest.filter(x=>x.restaurantId===restaurant.restaurantId).length,total:manifest.length}))
 }
 console.log(JSON.stringify({status:'COMPLETE',pdfs:manifest.length,restaurants:data.restaurants.length}))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1})
