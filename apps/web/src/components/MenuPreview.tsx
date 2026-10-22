'use client'
import { TakoLoading } from './TakoLoading'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { projectMenuForEdit, projectMenuPreview } from '@/lib/menu-preview-calendar'
import { acceptParentMessage, outgoing } from './menu-edit/protocol'
import { applyDocumentTheme, DEFAULT_MENU_BACKGROUND } from '@/lib/menu-document-theme'
import type { EditLayerState } from './menu-edit/MenuEditLayer'
const MenuEditLayer=lazy(()=>import('./menu-edit/MenuEditLayer'))
const noop=()=>{}
/** Props del renderer nella vista di modifica (dashboard editor 22/10): stessa pagina dei clienti in lingua originale, con tutto ciò
 *  che i clienti non vedono attenuato. Usata da MenuPreview (?edit=1) e da scripts/verify-menu-editor-identical.mjs. */
export function editRendererProps(doc:any,menuId:string,presentation:any,onSelectMenu:(id:string)=>void){
 const value=projectMenuForEdit(doc,menuId),language=doc.defaultLanguage||'it'
 return {menu:value.menu as any,design:value.design,foodLabels:value.foodLabels,foodCatalogs:presentation?.foodCatalogs,restaurantName:presentation?.restaurantName,menus:value.menus,onSelectMenu,languages:doc.languages||[language],language,onSelectLanguage:noop,readOnly:true,editing:true}
}
// All projection stays local: no write, table session, customer visit or order.
export function MenuPreview({menuId}:{menuId:string}) {
 const [edit]=useState(()=>{try{return typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('edit')==='1'}catch{return false}})
 if(edit)return <MenuEditPreview menuId={menuId}/>
 return <MenuPreviewOnly menuId={menuId}/>
}
function MenuPreviewOnly({menuId}:{menuId:string}) {
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

/** Vista di modifica: il documento arriva dalla SPA (`tako-menu-edit-state`), il layer si carica in modo pigro. */
function MenuEditPreview({menuId}:{menuId:string}) {
 const [presentation,setPresentation]=useState<any>({}),[doc,setDoc]=useState<any>(null),[selected,setSelected]=useState(menuId),[error,setError]=useState('')
 const [state,setState]=useState<EditLayerState>({selection:null,flash:[],disabled:false,editing:false,tick:0}),[exitTick,setExitTick]=useState(0),[root,setRoot]=useState<HTMLDivElement|null>(null)
 useEffect(()=>{
  let allowed=false,alive=true
  const receive=(event:MessageEvent)=>{if(!allowed)return;const message=acceptParentMessage(event,location.origin,window.parent);if(!message||!alive)return
   if(message.type==='tako-menu-edit-exit'){setExitTick(v=>v+1);return}
   try{projectMenuForEdit(message.document,message.menuId);setDoc(message.document);setSelected(message.menuId);setError('');setState(prev=>({selection:message.selection,flash:message.flash,disabled:message.disabled,editing:message.editing,tick:prev.tick+1}))}catch(e){setError(e instanceof Error?e.message:'Menu non valido');window.parent.postMessage(outgoing.error('INVALID_DOCUMENT'),location.origin)}}
  window.addEventListener('message',receive)
  const embedded=window.parent!==window;fetch(embedded?'/api/menu-workspace/presentation':'/api/menu-workspace',{credentials:'include'}).then(async r=>{if(!r.ok)throw Error('Accedi come titolare o editor per modificare il menu');const body=await r.json();if(!alive)return;allowed=true;setPresentation(embedded?body.data:body.presentation||{});if(!embedded){try{projectMenuForEdit(body.data,menuId);setDoc(body.data)}catch(e){setError(e instanceof Error?e.message:'Menu non ancora salvato')}}if(embedded)window.parent.postMessage(outgoing.ready(),location.origin)}).catch(e=>{if(alive)setError(e.message)})
  return()=>{alive=false;window.removeEventListener('message',receive)}
 },[menuId])
 const chooseMenu=(id:string)=>{setSelected(id);if(window.parent!==window)window.parent.postMessage(outgoing.menu(id),location.origin)}
 const props=useMemo(()=>{if(!doc)return null;try{return {value:editRendererProps(doc,selected,presentation,chooseMenu)}}catch(e){return {error:e instanceof Error?e.message:'Menu non valido'}}},[doc,selected,presentation])
 if(error||props?.error)return <p role="alert" className="p-6">{error||props?.error}</p>
 if(!props?.value)return <TakoLoading label="Caricamento menu…" variant="screen"/>
 return <><MenuEditSurface props={props.value} rootRef={setRoot}/><Suspense fallback={null}><MenuEditLayer root={root} doc={doc} setDoc={setDoc} menuId={selected} state={state} exitTick={exitTick}/></Suspense></>
}

/** Superficie della vista di modifica SENZA layer: sfondo del documento come la pagina pubblica + renderer in modo `editing`.
 *  scripts/verify-menu-editor-identical.mjs la confronta pixel per pixel con la pagina pubblica. */
export function MenuEditSurface({props,rootRef}:{props:ReturnType<typeof editRendererProps>;rootRef?:(el:HTMLDivElement|null)=>void}){
 // Stesso sfondo di documento della pagina pubblica (fuori dalla colonna del menu sugli schermi larghi).
 const themeBackground=props.design?.background||DEFAULT_MENU_BACKGROUND
 useEffect(()=>{if(!themeBackground)return;return applyDocumentTheme(themeBackground)},[themeBackground])
 return <div ref={rootRef} data-menu-edit-root><WorkspaceMenuRenderer {...props}/></div>
}
