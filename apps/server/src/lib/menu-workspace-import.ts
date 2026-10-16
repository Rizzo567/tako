import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { workspaceSchema,type Workspace } from './menu-workspace-contract.js'
export type CsvMapping={menu?:string;section:string;name:string;description?:string;price:string;allergens?:string;tags?:string}
/** RFC4180 quoted fields, embedded newlines, CRLF, escaped quotes. Never evaluate formulas. */
export function parseMenuCsv(source:string):string[][]{
 if(Buffer.byteLength(source)>2*1024*1024)throw new Error('Il file supera 2 MB')
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false
 const push=()=>{row.push(field);field='';closed=false}
 for(let n=0;n<source.length;n++){const c=source[n]!
 if(quoted){if(c==='"'){if(source[n+1]==='"'){field+='"';n++}else{quoted=false;closed=true}}else field+=c;continue}
 if(c==='"'){if(field||closed)throw new Error('Virgolette CSV non valide');quoted=true}
 else if(c===','){push()}
 else if(c==='\r'||c==='\n'){if(c==='\r'&&source[n+1]==='\n')n++;push();if(row.some(v=>v.trim()))rows.push(row);row=[]}
 else{if(closed&&c.trim())throw new Error('Caratteri dopo una cella CSV chiusa');if(!closed)field+=c}
 }
 if(quoted)throw new Error('Cella CSV senza virgolette di chiusura');push();if(row.some(v=>v.trim()))rows.push(row)
 if(rows.length>5001)throw new Error('Sono consentite al massimo 5000 righe')
 return rows
}
export function importWorkspaceCsv(current:Workspace,source:string,mapping:CsvMapping,menuId?:string){
 const rows=parseMenuCsv(source);const headers=rows.shift()?.map((v,n)=>n===0?v.replace(/^\uFEFF/,'').trim():v.trim())??[]
 if(!rows.length)throw new Error('Il CSV non contiene piatti');if(new Set(headers).size!==headers.length)throw new Error('Intestazioni duplicate')
 for(const column of Object.values(mapping))if(column&&!headers.includes(column))throw new Error(`Colonna mancante: ${column}`)
 const w=structuredClone(current)
 if(menuId&&!w.menus.some(m=>m.id===menuId))throw new Error('Menu non trovato')
 const get=(row:string[],key:keyof CsvMapping)=>mapping[key]?row[headers.indexOf(mapping[key]!)]?.trim()??'':''
 const labels=(value:string)=>value.split(/[;|]/).map(v=>v.trim()).filter(Boolean)
 let count=0
 for(const [index,row] of rows.entries()){
 if(row.length!==headers.length)throw new Error(`Numero colonne non valido alla riga ${index+2}`)
 const name=get(row,'name'),sectionName=get(row,'section'),rawPrice=get(row,'price').replace(/\s|€/g,'').replace(',','.')
 if(!name||!sectionName||!/^\d+(\.\d{1,2})?$/.test(rawPrice))throw new Error(`Nome, categoria o prezzo non valido alla riga ${index+2}`)
 const menuName=get(row,'menu')||'Menu importato'
 let menu=menuId?w.menus.find(m=>m.id===menuId):w.menus.find(m=>m.name===menuName)
 if(!menu){menu=workspaceSchema.parse({menus:[{id:randomUUID(),name:menuName}]}).menus[0]!;w.menus.push(menu)}
 let section=menu.sections.find(s=>s.name===sectionName&&!s.parentSectionId)
 if(!section){section=workspaceSchema.parse({menus:[{id:randomUUID(),name:'tmp',sections:[{id:randomUUID(),name:sectionName}]}]}).menus[0]!.sections[0]!;menu.sections.push(section)}
 const item=workspaceSchema.parse({menus:[{id:randomUUID(),name:'tmp',sections:[{id:randomUUID(),name:'tmp',items:[{id:randomUUID(),name,description:get(row,'description')||null,price:Number(rawPrice),allergens:labels(get(row,'allergens')),tags:labels(get(row,'tags'))}]}]}]}).menus[0]!.sections[0]!.items[0]!
 section.items.push(item);count++
 }
 return {workspace:workspaceSchema.parse(w),importedCount:count,warnings:['Importazione in bozza: verificare nomi, prezzi, varianti e dichiarazioni alimentari prima della pubblicazione. I piatti esistenti non vengono sostituiti.']}
}
export function importWorkspaceJson(source:string){if(Buffer.byteLength(source)>2*1024*1024)throw new Error('Il file supera 2 MB');const workspace=workspaceSchema.parse(JSON.parse(source));return {workspace,importedCount:workspace.menus.reduce((n,m)=>n+m.sections.reduce((c,s)=>c+s.items.length,0),0),warnings:['Il JSON sostituisce la bozza completa dopo conferma. UUID e riferimenti devono appartenere al locale; lo storico ordini rimane invariato.']}}
