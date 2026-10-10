'use client'
import { useEffect, useState } from 'react'
import type { PublicMenu } from '@tako/types'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
export function DigitalMenu({restaurantId}:{restaurantId:string}) {
 const [selected,setSelected]=useState(''),[language,setLanguage]=useState(''),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{const query=new URLSearchParams(location.search);setSelected(query.get('menuId')||'');setLanguage(query.get('lang')||'');},[])
 useEffect(()=>{let alive=true;setError('');const query=new URLSearchParams();if(selected)query.set('menuId',selected);if(language)query.set('lang',language);fetch(`/api/customer/restaurant/${encodeURIComponent(restaurantId)}/menu?${query}`).then(async r=>{if(!r.ok)throw Error('Menu non disponibile');const data=await r.json();if(alive)setResult(data)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[restaurantId,selected,language,retry])
 const menu:PublicMenu|undefined=result?.data
 const change=(key:string,value:string)=>{const url=new URL(location.href);if(value){url.searchParams.set(key,value)}else{url.searchParams.delete(key)}history.replaceState(null,'',url);if(key==='menuId'){setSelected(value)}else{setLanguage(value)}}
 return <main>{error?<div className="p-6"><p role="alert">{error}</p><button className="mt-3 rounded-xl border p-3" onClick={()=>setRetry(v=>v+1)}>Riprova</button></div>:!menu?<p role="status" className="p-6">Caricamento menu…</p>:<WorkspaceMenuRenderer menu={menu} design={result.design||{}} foodLabels={result.foodTranslations?.[language||result.defaultLanguage]} foodCatalogs={result.foodCatalogs} menus={result.menus||[]} onSelectMenu={id=>change('menuId',id)} languages={result.languages||[result.defaultLanguage||'it']} language={language||result.defaultLanguage||'it'} onSelectLanguage={lang=>change('lang',lang)} restaurantName={result.features?.restaurantName}/>}</main>
}
