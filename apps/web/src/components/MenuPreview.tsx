'use client'
import { useEffect, useMemo, useState } from 'react'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { projectMenuPreview } from '@/lib/menu-preview-calendar'
// All projection stays local: no write, table session, customer visit or order.
export function MenuPreview({menuId}:{menuId:string}) {
 const [presentation,setPresentation]=useState<any>({})
 const [language,setLanguage]=useState(''),[doc,setDoc]=useState<any>(null),[selected,setSelected]=useState(menuId),[error,setError]=useState(''),[calendar,setCalendar]=useState(false),[date,setDate]=useState(()=>new Date().toISOString().slice(0,16))
 useEffect(()=>{
  let allowed=false,alive=true
  const accept=(document:any,id:string)=>{projectMenuPreview(document,id,'');if(alive){setDoc(document);setSelected(id);setError('')}}
  const receive=(event:MessageEvent)=>{if(!allowed||event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='tako-menu-preview')return;try{accept(event.data.document,event.data.menuId||menuId)}catch(e){setError(e instanceof Error?e.message:'Anteprima non valida')}}
  window.addEventListener('message',receive)
  fetch('/api/menu-workspace',{credentials:'include'}).then(async r=>{if(!r.ok)throw Error('Accedi come titolare o editor per vedere la bozza');const body=await r.json();allowed=true;setPresentation(body.presentation||{});try{accept(body.data,menuId)}catch(e){if(alive)setError(e instanceof Error?e.message:'Menu non ancora salvato')}window.parent.postMessage({type:'tako-menu-preview-ready'},location.origin)}).catch(e=>{if(alive)setError(e.message)})
  return()=>{alive=false;window.removeEventListener('message',receive)}
 },[menuId])
 const projection=useMemo(()=>{if(!doc)return null;try{const instant=calendar?new Date(date+':00Z'):undefined;if(instant&&!Number.isFinite(instant.getTime()))throw Error('Data non valida');return {value:projectMenuPreview(doc,selected,language,instant)}}catch(e){return {error:e instanceof Error?e.message:'Anteprima non valida'}}},[doc,selected,language,calendar,date])
 if(error||projection?.error)return <p role="alert" className="p-6">{error||projection?.error}</p>
 if(!projection?.value)return <p role="status" className="p-6">Caricamento anteprima…</p>
 const value=projection.value
 return <><div className="space-y-3 px-4 pt-3"><label className="flex gap-2"><input type="checkbox" checked={calendar} onChange={e=>setCalendar(e.target.checked)}/>Simula disponibilità a data e ora</label>{calendar&&<><label className="block">Data e ora UTC<input className="ml-2 border p-2" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><p className="text-xs">Gli orari vengono applicati nel fuso indicato su ciascun menu, categoria e piatto. La simulazione non cambia il servizio.</p>{!value.menuVisible&&<p role="status">Menu non disponibile nell’istante scelto.</p>}</>}</div><WorkspaceMenuRenderer menu={value.menu} design={value.design} foodLabels={value.foodLabels} foodCatalogs={presentation.foodCatalogs} restaurantName={presentation.restaurantName} menus={doc.menus.map((m:any)=>({id:m.id,name:m.translations?.[language]?.name||m.name}))} onSelectMenu={setSelected} languages={doc.languages||[doc.defaultLanguage||'it']} language={language||doc.defaultLanguage||'it'} onSelectLanguage={setLanguage} readOnly/></>
}
