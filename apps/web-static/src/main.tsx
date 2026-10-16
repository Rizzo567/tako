import './ui-lock'
import './ui-lock.css'
import { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
const CustomerApp=lazy(()=>import('@/components/CustomerApp').then(m=>({default:m.CustomerApp})))
const DigitalMenu=lazy(()=>import('@/components/DigitalMenu').then(m=>({default:m.DigitalMenu})))
const OnboardingPreview=lazy(()=>import('@/components/OnboardingPreview').then(m=>({default:m.OnboardingPreview})))
const OnboardingClaim=lazy(()=>import('@/components/OnboardingClaim').then(m=>({default:m.OnboardingClaim})))
const MenuPreview=lazy(()=>import('@/components/MenuPreview').then(m=>({default:m.MenuPreview})))
const ReservationForm=lazy(()=>import('@/components/ReservationForm').then(m=>({default:m.ReservationForm})))
import { I18nProvider } from '@/lib/i18n'
const Home=lazy(()=>import('../../web/src/app/page'))
const PrivacyPage=lazy(()=>import('../../web/src/app/privacy/page'))
import { parseStaticRoute } from './routes.mjs'
import { hasStaffReturnHint } from './staff-return-hint'
import { loadMenu } from '@/lib/public-menu-cache'
import '../../web/src/app/globals.css'
import './fonts.css'
import { TakoLoading } from '@/components/TakoLoading'

export function StaticApp(){
 const [pathname,setPathname]=useState(()=>window.location.pathname)
 useEffect(()=>{const update=()=>setPathname(window.location.pathname);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[])
 const route=parseStaticRoute(pathname)
 let screen
 switch(route.kind){
  case 'home':screen=<Home/>;break
  case 'privacy':screen=<PrivacyPage/>;break
  case 'table':screen=<CustomerApp restaurantId={route.restaurantId!} token={route.token!}/>;break
  case 'digital-menu':screen=<DigitalMenu restaurantId={route.restaurantId!}/>;break
  case 'leads-demo':
  case 'trial-menu':screen=<OnboardingPreview token={route.token!} trial/>;break
  case 'onboarding-preview':screen=<OnboardingPreview token={route.token!}/>;break
  case 'onboarding-claim':screen=<OnboardingClaim token={route.token!}/>;break
  case 'menu-preview':screen=<MenuPreview menuId={route.menuId!}/>;break
  case 'reservation':screen=<I18nProvider restaurantId={route.restaurantId!}><ReservationForm restaurantId={route.restaurantId!}/></I18nProvider>;break
  default:screen=<main className="mx-auto max-w-md px-5 py-16"><h1 className="text-2xl font-bold">Pagina non trovata</h1><p className="mt-3">Controlla il link o scansiona il QR del ristorante.</p><a href="/" className="mt-5 inline-block underline">Torna a Tako</a></main>
 }
 return <><Suspense fallback={<TakoLoading variant="screen" label="Caricamento…"/>}><div key={pathname}>{screen}</div></Suspense><Toaster position="top-center" toastOptions={{style:{fontFamily:'var(--font-display)',fontWeight:600,borderRadius:14,boxShadow:'0 8px 28px rgba(42,31,26,0.12)'}}}/></>
}
// La richiesta del menu parte subito, in parallelo al caricamento dei componenti.
{const route=parseStaticRoute(window.location.pathname);if(route.kind==='digital-menu'){const q=new URLSearchParams(window.location.search);loadMenu(route.restaurantId!,q.get('menuId')||'',q.get('lang')||'').catch(()=>{})}}
// «Torna all'editor»: solo con l'indizio della dashboard agenzia; modulo e verifica server partono dopo il menu, mai per gli anonimi.
{const route=parseStaticRoute(window.location.pathname);if(route.kind==='digital-menu'&&hasStaffReturnHint()){const start=()=>{import('./staff-return').then(m=>m.mountStaffReturn()).catch(()=>{})};const idle=()=>'requestIdleCallback' in window?window.requestIdleCallback(start,{timeout:2000}):setTimeout(start,600);if(document.readyState==='complete')idle();else window.addEventListener('load',idle,{once:true})}}
const root=document.getElementById('root');if(!root)throw new Error('Tako root missing');createRoot(root).render(<StaticApp/>);
