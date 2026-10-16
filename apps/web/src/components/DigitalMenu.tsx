'use client'
import { TakoLoading } from './TakoLoading'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PublicMenu } from '@tako/types'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { RTL_LANGUAGES } from '@/lib/menu-copy'
import { cachedMenu, invalidateMenus, loadMenu, MenuRequestError, pendingPrefetch, prefetchMenu, prefetchSiblingMenus } from '@/lib/public-menu-cache'
import { liveJitter, readingAnchor, restoreReadingAnchor, watchPublicMenu } from '@/lib/public-menu-live'
// Stesso default del renderer (WorkspaceMenuRenderer) quando il design non ha uno sfondo.
const DEFAULT_MENU_BACKGROUND='#f8f5ef'
/** html, body, meta theme-color e color-scheme seguono lo sfondo del tema; restituisce il ripristino. */
function applyDocumentTheme(color:string){
 if(typeof document==='undefined'||(typeof CSS!=='undefined'&&!CSS.supports('color',color)))return
 const html=document.documentElement,body=document.body
 let meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');const created=!meta
 if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
 const previous={html:html.style.backgroundColor,body:body.style.backgroundColor,scheme:html.style.colorScheme,meta:meta.content}
 const probe=document.createElement('span');probe.style.color=color;body.appendChild(probe);const rgb=(getComputedStyle(probe).color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);probe.remove()
 const dark=rgb.length===3&&(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255<.5
 html.style.backgroundColor=color;body.style.backgroundColor=color;html.style.colorScheme=dark?'dark':'light';meta.content=color
 return ()=>{html.style.backgroundColor=previous.html;body.style.backgroundColor=previous.body;html.style.colorScheme=previous.scheme;if(created)meta?.remove();else if(meta)meta.content=previous.meta}
}
export function DigitalMenu({restaurantId}:{restaurantId:string}) {
 const initial=(key:string)=>typeof location==='undefined'?'':new URLSearchParams(location.search).get(key)||''
 const [selected,setSelected]=useState(()=>initial('menuId')),[language,setLanguage]=useState(()=>initial('lang')),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 // Menu già visto: subito dalla cache, poi sempre riconfermato dal server. Altrimenti si attende la risposta (o il prefetch in volo).
 useEffect(()=>{let alive=true,fresh=false;setError('');const hit=cachedMenu(restaurantId,selected,language);if(hit)setResult(hit);else pendingPrefetch(restaurantId,selected,language)?.then(data=>{if(alive&&!fresh)setResult(data)},()=>{});loadMenu(restaurantId,selected,language).then(data=>{fresh=true;if(alive)setResult(data)}).catch(e=>{if(alive&&!hit)setError(e instanceof Error?e.message:'Menu non disponibile')});return()=>{alive=false}},[restaurantId,selected,language,retry])
 // Menu in tempo reale: al segnale «menu pubblicato cambiato» si rilegge in silenzio il menu e la lingua a schermo
 // e si sostituisce al suo posto, mantenendo il punto di lettura. Nessun avviso, nessuna evidenziazione.
 const resultRef=useRef<any>(null),viewRef=useRef({selected,language}),liveRef=useRef(false),anchorRef=useRef<ReturnType<typeof readingAnchor>>(null),dropMenuRef=useRef(()=>{})
 resultRef.current=result;viewRef.current={selected,language}
 const ready=!!result
 useEffect(()=>{if(!ready)return;let timer:any=null,running=false,again=false,stopped=false,failures=0
  const schedule=(delay:number)=>{if(!timer&&!stopped)timer=setTimeout(refresh,delay)}
  async function refresh(){timer=null;if(running){again=true;return}running=true
   try{for(;;){again=false;const view=viewRef.current;invalidateMenus(restaurantId);let data:any
    try{data=await loadMenu(restaurantId,view.selected,view.language,{live:true})}catch(e){if(stopped)return;if(e instanceof MenuRequestError&&e.status===404&&view.selected){dropMenuRef.current();return}if(e instanceof MenuRequestError&&e.status===429){schedule(Math.max(5000,e.retryAfterMs)+liveJitter('poll'));return}
     // Servizio momentaneamente occupato (molti telefoni insieme): al massimo due nuovi tentativi distanziati.
     if(failures<2){failures++;schedule(1000+Math.random()*2000)}return}
    failures=0
    if(stopped)return
    const current=viewRef.current
    if(current.selected===view.selected&&current.language===view.language&&JSON.stringify(data)!==JSON.stringify(resultRef.current)){anchorRef.current=readingAnchor();liveRef.current=true;setResult(data)}
    if(!again)return}}finally{running=false}}
  const stop=watchPublicMenu(restaurantId,reason=>schedule(liveJitter(reason)))
  return()=>{stopped=true;stop();clearTimeout(timer)}},[restaurantId,ready])
 useLayoutEffect(()=>{const anchor=anchorRef.current;if(anchor){anchorRef.current=null;restoreReadingAnchor(anchor)}},[result])
 // Dopo una rilettura live non si precaricano gli altri menu: con tanti telefoni sullo stesso IP moltiplicherebbe le richieste.
 useEffect(()=>{if(liveRef.current){liveRef.current=false;return}if(result?.data?.id&&Array.isArray(result.menus))prefetchSiblingMenus(restaurantId,result.menus,result.data.id,language)},[result,restaurantId,language])
 // La lingua del telefono è la scelta più probabile: pronta in anticipo. Le altre partono al primo tocco sulla bandiera.
 useEffect(()=>{if(!result?.data?.id)return;const device=(typeof navigator==='undefined'?'':navigator.language||'').split('-')[0].toLowerCase(),current=language||result.defaultLanguage;if(device&&device!==current&&(result.languages||[]).includes(device))prefetchMenu(restaurantId,result.data.id,device,true)},[result?.data?.id,restaurantId])
 const menu:PublicMenu|undefined=result?.data
 // Lingua e direzione del documento seguono i contenuti mostrati; titolo della scheda con il nome del locale.
 useEffect(()=>{if(!result)return;const lang=language||result.defaultLanguage||'it',root=document.documentElement;root.lang=lang;root.dir=RTL_LANGUAGES.has(lang)?'rtl':'ltr';const name=result.features?.restaurantName;if(name)document.title=`${name} · Menu · Takomenu`},[result])
 // Lo sfondo del documento è quello del tema: il rimbalzo elastico (iOS) in alto e in basso non mostra il crema di default.
 const themeBackground=result?(result.design?.background||DEFAULT_MENU_BACKGROUND):''
 useEffect(()=>{if(!themeBackground)return;return applyDocumentTheme(themeBackground)},[themeBackground])
 const change=(key:string,value:string)=>{const url=new URL(location.href);if(value){url.searchParams.set(key,value)}else{url.searchParams.delete(key)}history.replaceState(null,'',url);if(key==='menuId'){setSelected(value)}else{setLanguage(value)}}
 // Il menu a schermo è stato tolto: si passa al primo menu disponibile.
 dropMenuRef.current=()=>change('menuId','')
 return <main>{error?<div className="p-6"><p role="alert">{error}</p><button className="mt-3 rounded-xl border p-3" onClick={()=>setRetry(v=>v+1)}>Riprova</button></div>:!menu?<TakoLoading label="Caricamento menu…" variant="screen"/>:<WorkspaceMenuRenderer menu={menu} design={result.design||{}} foodLabels={result.foodTranslations?.[language||result.defaultLanguage]} foodCatalogs={result.foodCatalogs} menus={result.menus||[]} onSelectMenu={id=>change('menuId',id)} languages={result.languages||[result.defaultLanguage||'it']} language={language||result.defaultLanguage||'it'} onSelectLanguage={lang=>{if(!selected&&result?.data?.id)change('menuId',result.data.id);change('lang',lang)}} onLanguageIntent={lang=>{if(result?.data?.id)prefetchMenu(restaurantId,result.data.id,lang)}} restaurantName={result.features?.restaurantName}/>}</main>
}
