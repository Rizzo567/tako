'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceMenuRenderer } from './WorkspaceMenuRenderer'
import { TakoLoading } from './TakoLoading'
import { projectMenuPreview } from '@/lib/menu-preview-calendar'
import { startOnboardingPreviewPolling,reconcileOnboardingPreviewSelection } from '@/lib/onboarding-preview-live'

export function usePrivateOnboardingPage(title:string) {
 useEffect(()=>{
  const oldTitle=document.title,existing=document.querySelector<HTMLMetaElement>('meta[name="robots"]'),oldContent=existing?.content
  const meta=existing||document.createElement('meta');meta.name='robots';meta.content='noindex, nofollow, noarchive';if(!existing)document.head.append(meta)
  const ref=document.createElement('meta');ref.name='referrer';ref.content='no-referrer';document.head.append(ref);document.title=title
  return()=>{document.title=oldTitle;if(existing)existing.content=oldContent||'';else meta.remove();ref.remove()}
 },[title])
}
export async function onboardingRequest(path:string,signal?:AbortSignal,body?:unknown) {
 const response=await fetch(path,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,referrerPolicy:'no-referrer'})
 const result=await response.json().catch(()=>null)
 if(!response.ok)throw Object.assign(Error(typeof result?.error?.message==='string'?result.error.message:typeof result?.error==='string'?result.error:response.status===404||response.status===410?'Questo collegamento non è più disponibile. Chiedi un nuovo link a chi sta preparando il locale.':'Non riesco a caricare i dati. Riprova tra poco.'),{status:response.status})
 if(!result?.data)throw Error('Risposta non valida. Riprova tra poco.')
 return result.data
}
export function OnboardingPreview({token,trial=false}:{token:string,trial?:boolean}) {
 usePrivateOnboardingPage(trial?'PROVA · Takomenu':'Anteprima privata · Takomenu')
 const pollingRef=useRef<{stop:()=>void}|null>(null)
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[selected,setSelected]=useState(''),[language,setLanguage]=useState(''),[refreshError,setRefreshError]=useState(''),[terminal,setTerminal]=useState(false),[updatedAt,setUpdatedAt]=useState<number|null>(null)
 useEffect(()=>{setData(null);setSelected('');setLanguage('');setUpdatedAt(null)},[token])
 useEffect(()=>{setError('');setRefreshError('');setTerminal(false);const polling=startOnboardingPreviewPolling<any>({load:signal=>onboardingRequest(trial?`/api/agency/leads/preview/${encodeURIComponent(token)}`:`/api/onboarding/preview/${encodeURIComponent(token)}`,signal),visible:()=>document.visibilityState!=='hidden',onData:value=>{setData((previous:any)=>previous&&Number.isFinite(value.revision)&&previous.revision===value.revision&&previous.expiresAt===value.expiresAt?previous:value);setSelected(current=>reconcileOnboardingPreviewSelection(value.workspace,current,'').menu);setLanguage(current=>reconcileOnboardingPreviewSelection(value.workspace,'',current).language);setError('');setRefreshError('');setUpdatedAt(Date.now())},onError:(message,expired)=>{if(expired){setData(null);setTerminal(true);setError(message);setRefreshError('')}else{setError(message);setRefreshError('Non riesco ad aggiornare la bozza. Riprovo tra poco.')}}});pollingRef.current=polling;const wake=()=>{if(document.visibilityState!=='hidden')void polling.refresh()};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);return()=>{polling.stop();if(pollingRef.current===polling)pollingRef.current=null;window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)}},[token,attempt,trial])
 useEffect(()=>{if(!data?.expiresAt)return;const remaining=new Date(data.expiresAt).getTime()-Date.now();if(!Number.isFinite(remaining))return;const timer=setTimeout(()=>{pollingRef.current?.stop();setData(null);setTerminal(true);setError('Questo collegamento è scaduto. Chiedi un nuovo link a chi sta preparando il locale.')},Math.max(0,remaining));return()=>clearTimeout(timer)},[data?.expiresAt])
 const projection=useMemo(()=>{if(!data)return null;try{return {value:projectMenuPreview(data.workspace,selected,language)}}catch{return {error:'La bozza non contiene ancora un menu visualizzabile.'}}},[data,selected,language])
 if(error&&(!data||terminal))return <main className="mx-auto max-w-lg p-6 pt-16"><h1 className="text-2xl font-bold">Anteprima privata</h1><p role="alert" className="my-5">{error}</p><button className="min-h-11 rounded-full bg-black px-6 text-white" onClick={()=>setAttempt(v=>v+1)}>Riprova</button></main>
 if(!data)return <TakoLoading variant="screen" label="Caricamento anteprima…"/>
 const issues=[...(Array.isArray(data.warnings)?data.warnings:[]),...(Array.isArray(data.unresolved)?data.unresolved:[])]
 const issueLabel=(issue:any)=>typeof issue==='string'?issue:issue.message||issue.label||issue.question||'Informazione da verificare con l’agenzia'
 return <><aside className="relative z-50 border-b border-black/10 bg-white px-5 py-3 text-sm text-neutral-800"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2"><strong>{data.name} · {trial?'PROVA':'Bozza privata'}</strong><span role="status" aria-live="polite">{refreshError|| (updatedAt?trial?"Demo di presentazione · Nessun ordine attivo":"Si aggiorna automaticamente · Bozza privata":"Anteprima da verificare con l’agenzia")}</span>{refreshError&&<button type="button" className="min-h-11 underline" onClick={()=>setAttempt(v=>v+1)}>Riprova ora</button>}</div>{trial&&<p className="mx-auto mt-2 max-w-5xl text-xs">{data.sourceNote||"Proposta dimostrativa: piatti e prezzi da confermare con il locale."}</p>}{issues.length>0&&<details className="mx-auto mt-2 max-w-5xl"><summary className="cursor-pointer py-2">{issues.length} informazioni da verificare</summary><ul className="list-disc space-y-2 py-3 pl-5">{issues.map((issue:any,index:number)=><li key={index}>{issueLabel(issue)}</li>)}</ul></details>}</aside>{projection?.value?<WorkspaceMenuRenderer menu={projection.value.menu} design={projection.value.design} foodLabels={projection.value.foodLabels} restaurantName={data.name} menus={data.workspace.menus.map((menu:any)=>({id:menu.id,name:menu.translations?.[language]?.name||menu.name,type:menu.type}))} onSelectMenu={setSelected} languages={data.workspace.languages||[language]} language={language} onSelectLanguage={setLanguage} readOnly/>:<main className="p-6"><p>{projection?.error}</p></main>}</>
}
