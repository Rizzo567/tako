'use client'
import { TakoLoading } from './TakoLoading'
import { useEffect, useMemo, useState } from 'react'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { projectMenuPreview } from '@/lib/menu-preview-calendar'
// All projection stays local: no write, table session, customer visit or order.
export function MenuPreview({menuId}:{menuId:string}) {
 const [presentation,setPresentation]=useState<any>({})
 const [language,setLanguage]=useState(''),[doc,setDoc]=useState<any>(null),[selected,setSelected]=useState(menuId),[error,setError]=useState('')
 useEffect(()=>{
  let allowed=false,alive=true
  const accept=(document:any,id:string)=>{projectMenuPreview(document,id,'');if(alive){setDoc(document);setSelected(id);setError('')}}
  const receive=(event:MessageEvent)=>{if(!allowed||event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='tako-menu-preview')return;try{accept(event.data.document,event.data.menuId||menuId);if(typeof event.data.language==='string'&&event.data.document.languages?.includes(event.data.language))setLanguage(event.data.language)}catch(e){setError(e instanceof Error?e.message:'Anteprima non valida')}}
  window.addEventListener('message',receive)
  const embedded=window.parent!==window;fetch(embedded?'/api/menu-workspace/presentation':'/api/menu-workspace',{credentials:'include'}).then(async r=>{if(!r.ok)throw Error('Accedi come titolare o editor per vedere la bozza');const body=await r.json();if(!alive)return;allowed=true;setPresentation(embedded?body.data:body.presentation||{});if(!embedded)try{accept(body.data,menuId)}catch(e){setError(e instanceof Error?e.message:'Menu non ancora salvato')}window.parent.postMessage({type:'tako-menu-preview-ready'},location.origin)}).catch(e=>{if(alive)setError(e.message)})
  return()=>{alive=false;window.removeEventListener('message',receive)}
 },[menuId])
 const projection=useMemo(()=>{if(!doc)return null;try{return {value:projectMenuPreview(doc,selected,language)}}catch(e){return {error:e instanceof Error?e.message:'Anteprima non valida'}}},[doc,selected,language])
 if(error||projection?.error)return <p role="alert" className="p-6">{error||projection?.error}</p>
 if(!projection?.value)return <TakoLoading label="Caricamento anteprima…" variant="screen"/>
 const value=projection.value
 return <WorkspaceMenuRenderer menu={value.menu} design={value.design} foodLabels={value.foodLabels} foodCatalogs={presentation.foodCatalogs} restaurantName={presentation.restaurantName} menus={doc.menus.filter((m:any)=>m.active!==false||m.id===selected).map((m:any)=>({id:m.id,type:m.type,name:m.translations?.[language]?.name||m.name}))} onSelectMenu={setSelected} languages={doc.languages||[doc.defaultLanguage||'it']} language={language||doc.defaultLanguage||'it'} onSelectLanguage={setLanguage} readOnly/>
}
