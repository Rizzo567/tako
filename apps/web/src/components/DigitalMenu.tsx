'use client'
import { TakoLoading } from './TakoLoading'
import { useEffect, useState } from 'react'
import type { PublicMenu } from '@tako/types'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { RTL_LANGUAGES } from '@/lib/menu-copy'
import { cachedMenu, loadMenu, pendingPrefetch, prefetchMenu, prefetchSiblingMenus } from '@/lib/public-menu-cache'
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
 useEffect(()=>{if(result?.data?.id&&Array.isArray(result.menus))prefetchSiblingMenus(restaurantId,result.menus,result.data.id,language)},[result,restaurantId,language])
 // La lingua del telefono è la scelta più probabile: pronta in anticipo. Le altre partono al primo tocco sulla bandiera.
 useEffect(()=>{if(!result?.data?.id)return;const device=(typeof navigator==='undefined'?'':navigator.language||'').split('-')[0].toLowerCase(),current=language||result.defaultLanguage;if(device&&device!==current&&(result.languages||[]).includes(device))prefetchMenu(restaurantId,result.data.id,device,true)},[result?.data?.id,restaurantId])
 const menu:PublicMenu|undefined=result?.data
 // Lingua e direzione del documento seguono i contenuti mostrati; titolo della scheda con il nome del locale.
 useEffect(()=>{if(!result)return;const lang=language||result.defaultLanguage||'it',root=document.documentElement;root.lang=lang;root.dir=RTL_LANGUAGES.has(lang)?'rtl':'ltr';const name=result.features?.restaurantName;if(name)document.title=`${name} · Menu · Takomenu`},[result])
 // Lo sfondo del documento è quello del tema: il rimbalzo elastico (iOS) in alto e in basso non mostra il crema di default.
 const themeBackground=result?(result.design?.background||DEFAULT_MENU_BACKGROUND):''
 useEffect(()=>{if(!themeBackground)return;return applyDocumentTheme(themeBackground)},[themeBackground])
 const change=(key:string,value:string)=>{const url=new URL(location.href);if(value){url.searchParams.set(key,value)}else{url.searchParams.delete(key)}history.replaceState(null,'',url);if(key==='menuId'){setSelected(value)}else{setLanguage(value)}}
 return <main>{error?<div className="p-6"><p role="alert">{error}</p><button className="mt-3 rounded-xl border p-3" onClick={()=>setRetry(v=>v+1)}>Riprova</button></div>:!menu?<TakoLoading label="Caricamento menu…" variant="screen"/>:<WorkspaceMenuRenderer menu={menu} design={result.design||{}} foodLabels={result.foodTranslations?.[language||result.defaultLanguage]} foodCatalogs={result.foodCatalogs} menus={result.menus||[]} onSelectMenu={id=>change('menuId',id)} languages={result.languages||[result.defaultLanguage||'it']} language={language||result.defaultLanguage||'it'} onSelectLanguage={lang=>{if(!selected&&result?.data?.id)change('menuId',result.data.id);change('lang',lang)}} onLanguageIntent={lang=>{if(result?.data?.id)prefetchMenu(restaurantId,result.data.id,lang)}} restaurantName={result.features?.restaurantName}/>}</main>
}
