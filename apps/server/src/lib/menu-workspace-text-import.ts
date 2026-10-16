import { Buffer } from 'node:buffer'
import type { Workspace } from './menu-workspace-contract.js'
import { importWorkspaceCsv } from './menu-workspace-import.js'

/** Conservative, explicit-price parser. Blank blocks distinguish plain headings from descriptions. */
export function importWorkspaceText(current:Workspace,source:string,menuId?:string){
 if(Buffer.byteLength(source)>2*1024*1024)throw new Error('Il testo supera 2 MB')
 const lines=source.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/)
 if(lines.length>10000)throw new Error('Sono consentite al massimo 10000 righe di testo')
 const priced=/^(.+?)\s+[—–-]\s+(\d+(?:[.,]\d{1,2})?)\s*€?$|^(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*€$/
 const rows:{section:string;name:string;price:string;description:string}[]=[]
 const warnings:string[]=[]
 let section='',blockStart=true,last:typeof rows[number]|undefined
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!.trim()
  if(!line){blockStart=true;last=undefined;continue}
  const heading=line.match(/^#{1,6}\s+(.+)$/)
  if(heading){section=heading[1]!.trim();last=undefined;blockStart=false;continue}
  const item=line.match(priced)
  if(item){
   if(!section){warnings.push(`Riga ${i+1}: piatto senza sezione, non importato. Aggiungere "# Sezione".`);last=undefined;blockStart=false;continue}
   last={section,name:(item[1]??item[3])!.trim(),price:(item[2]??item[4])!,description:''};rows.push(last);blockStart=false
   if(rows.length>5000)throw new Error('Sono consentiti al massimo 5000 piatti')
   continue
  }
  // A free-text heading is accepted only at a block start, immediately before a priced dish.
  if(blockStart&&priced.test(lines[i+1]?.trim()??'')&&!/[€]|\s[—–-]\s/.test(line)){
   section=line;last=undefined;blockStart=false
   warnings.push(`Riga ${i+1}: "${line}" riconosciuta come sezione; verificare nell’anteprima.`)
   continue
  }
  if(last&&!/[€]|\s[—–-]\s\d|\s-?\d+(?:[.,]\d+)?$/.test(line)){
   last.description=last.description?`${last.description}\n${line}`:line;blockStart=false
   if(priced.test(lines[i+1]?.trim()??''))warnings.push(`Riga ${i+1}: testo usato come descrizione di "${last.name}". Se è una sezione, aggiungere "#".`)
   continue
  }
  warnings.push(`Riga ${i+1}: testo ambiguo o prezzo non valido, non importato: "${line.slice(0,160)}".`)
  last=undefined;blockStart=false
 }
 if(!rows.length)throw new Error('Nessun piatto riconosciuto. Usare "# Sezione" e "Nome — 12,50 €".')
 const existing=current.menus.filter(m=>menuId?m.id===menuId:m.name==='Menu importato').flatMap(m=>m.sections.flatMap(s=>s.items.map(item=>`${s.name.toLocaleLowerCase('it')}\0${item.name.toLocaleLowerCase('it')}`)))
 const seen=new Set(existing)
 for(const row of rows){const key=`${row.section.toLocaleLowerCase('it')}\0${row.name.toLocaleLowerCase('it')}`;if(seen.has(key))warnings.push(`Possibile duplicato: "${row.name}" in "${row.section}". Il piatto viene aggiunto senza sostituire quello esistente.`);seen.add(key)}
 const cell=(v:string)=>`"${v.replace(/"/g,'""')}"`
 const csv=['section,name,price,description',...rows.map(r=>[r.section,r.name,r.price,r.description].map(cell).join(','))].join('\n')
 const result=importWorkspaceCsv(current,csv,{section:'section',name:'name',price:'price',description:'description'},menuId)
 return {...result,warnings:[...result.warnings,...warnings,'Allergeni, varianti e altre dichiarazioni non vengono dedotti dal testo: completarli nella revisione.']}
}
