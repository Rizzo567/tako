'use client'
import { TakoLoading } from './TakoLoading'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PublicMenu } from '@tako/types'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { RTL_LANGUAGES } from '@/lib/menu-copy'
import { cachedMenu, invalidateMenus, loadMenu, MenuRequestError, pendingPrefetch, prefetchMenu, prefetchSiblingMenus } from '@/lib/public-menu-cache'
import { applyLiveDelta, liveJitter, readingAnchor, restoreReadingAnchor, watchPublicMenu, type LiveReason, type LiveSignal } from '@/lib/public-menu-live'
import { applyDocumentTheme, DEFAULT_MENU_BACKGROUND } from '@/lib/menu-document-theme'
export function DigitalMenu({restaurantId}:{restaurantId:string}) {
 const initial=(key:string)=>typeof location==='undefined'?'':new URLSearchParams(location.search).get(key)||''
 const [selected,setSelected]=useState(()=>initial('menuId')),[language,setLanguage]=useState(()=>initial('lang')),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 // Menu già visto: subito dalla cache, poi sempre riconfermato dal server. Altrimenti si attende la risposta (o il prefetch in volo).
 useEffect(()=>{let alive=true,fresh=false;setError('');const hit=cachedMenu(restaurantId,selected,language);if(hit)setResult(hit);else pendingPrefetch(restaurantId,selected,language)?.then(data=>{if(alive&&!fresh)setResult(data)},()=>{});loadMenu(restaurantId,selected,language).then(data=>{fresh=true;if(alive)setResult(data)}).catch(e=>{if(alive&&!hit)setError(e instanceof Error?e.message:'Menu non disponibile')});return()=>{alive=false}},[restaurantId,selected,language,retry])
 // Menu in tempo reale: al segnale «menu pubblicato cambiato» si aggiorna in silenzio il menu a schermo mantenendo il punto di lettura.
 // Con il delta pubblicato nel segnale (prezzo, nome, esaurito, nascosto) si applica subito e si riconferma più tardi; senza, si rilegge quasi subito.
 // Il socket si apre insieme al primo caricamento (non dopo): un segnale arrivato prima del menu fa rileggere appena c'è.
 const resultRef=useRef<any>(null),viewRef=useRef({selected,language}),liveRef=useRef(false),anchorRef=useRef<ReturnType<typeof readingAnchor>>(null),dropMenuRef=useRef(()=>{}),missedRef=useRef(false),tokenRef=useRef(''),kickRef=useRef<()=>void>(()=>{})
 resultRef.current=result;viewRef.current={selected,language}
 const ready=!!result
 useEffect(()=>{let timer:any=null,timerAt=0,running=false,again=false,stopped=false,failures=0,epoch=0
  // Un ritardo più breve sostituisce quello in attesa (un cambio strutturale non aspetta la riconferma di un delta).
  const schedule=(delay:number)=>{if(stopped)return;const at=Date.now()+delay;if(timer&&timerAt<=at)return;clearTimeout(timer);timerAt=at;timer=setTimeout(refresh,delay)}
  async function refresh(){timer=null;if(running){again=true;return}if(!resultRef.current){missedRef.current=true;return}running=true
   try{for(;;){again=false;const view=viewRef.current,started=epoch;invalidateMenus(restaurantId);let data:any
    try{data=await loadMenu(restaurantId,view.selected,view.language,{live:true,token:tokenRef.current})}catch(e){if(stopped)return;if(e instanceof MenuRequestError&&e.status===404&&view.selected){dropMenuRef.current();return}if(e instanceof MenuRequestError&&e.status===429){schedule(Math.max(5000,e.retryAfterMs)+liveJitter('poll'));return}
     // Servizio momentaneamente occupato (molti telefoni insieme): al massimo due nuovi tentativi distanziati.
     if(failures<2){failures++;schedule(1000+Math.random()*2000)}return}
    failures=0
    if(stopped)return
    // Un delta applicato durante la lettura è più nuovo di questa risposta: si rilegge da capo.
    if(started!==epoch){again=true;continue}
    const current=viewRef.current
    if(current.selected===view.selected&&current.language===view.language&&JSON.stringify(data)!==JSON.stringify(resultRef.current)){anchorRef.current=readingAnchor();liveRef.current=true;resultRef.current=data;setResult(data)}
    if(!again)return}}finally{running=false}}
  const onSignal=(reason:LiveReason,signal?:LiveSignal)=>{
   const current=resultRef.current
   // Gettone del cambio più recente (solo dai segnali): la rilettura che segue lo porta con sé. Le riprese leggono senza.
   tokenRef.current=reason==='push'&&typeof signal?.k==='string'?signal.k:reason==='reconcile'?tokenRef.current:''
   if(reason==='push'&&current&&Array.isArray(signal?.d)){
    const view=viewRef.current,patched=applyLiveDelta(current,signal!.d!,view.language||current.defaultLanguage||'')
    if(patched){invalidateMenus(restaurantId);if(patched!==current){epoch++;anchorRef.current=readingAnchor();liveRef.current=true;resultRef.current=patched;setResult(patched)}schedule(liveJitter('reconcile'));return}
   }
   schedule(liveJitter(reason))}
  kickRef.current=()=>{if(missedRef.current){missedRef.current=false;schedule(liveJitter('push'))}}
  const stop=watchPublicMenu(restaurantId,onSignal)
  return()=>{stopped=true;stop();clearTimeout(timer);kickRef.current=()=>{}}},[restaurantId])
 // Segnale arrivato mentre il primo menu era in caricamento: quella risposta può essere di prima del cambio.
 useEffect(()=>{if(ready)kickRef.current()},[ready])
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
