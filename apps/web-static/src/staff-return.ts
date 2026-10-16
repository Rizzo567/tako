import {STAFF_RETURN_KEY,STAFF_RETURN_RESTORE_KEY} from './staff-return-hint'
// «Torna all'editor»: compare solo se il server conferma una sessione staff agenzia valida
// (GET /api/agency/me, cookie HttpOnly stessa origine). Montato fuori dal renderer del menu.
// Movimento: token «fast» (180 ms) ed easing «out» di apps/web/src/lib/menu-motion.tokens.json, copiati qui:
// importare il JSON creerebbe un chunk condiviso e cambierebbe tutti i file del menu pubblico.
const FAST_MS=180,EASE_OUT='cubic-bezier(.22,1,.36,1)'
const ID='tako-staff-return'
const css=`#${ID}{position:fixed;z-index:18;left:max(12px,env(safe-area-inset-left,0px));bottom:calc(var(--tako-staff-return-offset,0px) + 12px + env(safe-area-inset-bottom,0px));display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px 0 11px;border-radius:999px;border:1px solid rgba(42,31,26,.14);background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(42,31,26,.14);color:#2a1f1a;font:600 14px/1 var(--font-display,system-ui,sans-serif);text-decoration:none;-webkit-tap-highlight-color:transparent}
#${ID}:active{background:rgba(245,241,238,.96)}#${ID}:focus-visible{outline:2px solid #2a1f1a;outline-offset:2px}#${ID} svg{flex:none}
body.tako-staff-return-space{padding-bottom:calc(var(--tako-staff-return-offset,0px) + 64px)}`
async function confirmed(signal:AbortSignal):Promise<boolean|null>{
 try{
  const r=await fetch('/api/agency/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal})
  if(r.status===401||r.status===403)return false
  if(!r.ok)return null
  const body=await r.json().catch(()=>null)
  return body?.data?.agency===true
 }catch{return null}
}
// Se il menu ha la striscia dei menu fissata in basso, il pulsante sale sopra di essa.
function bottomOffset():number{
 let offset=0
 for(const el of document.querySelectorAll<HTMLElement>('#root nav')){
  if(getComputedStyle(el).position!=='fixed')continue
  const r=el.getBoundingClientRect();if(r.height>0&&r.bottom>=window.innerHeight-2)offset=Math.max(offset,window.innerHeight-r.top)
 }
 return Math.round(offset)
}
export async function mountStaffReturn(){
 if(document.getElementById(ID))return
 const ok=await confirmed(AbortSignal.timeout(8000))
 if(ok===false){try{sessionStorage.removeItem(STAFF_RETURN_KEY)}catch{};return}
 if(!ok)return
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style)
 const link=document.createElement('a');link.id=ID;link.href='/staff/';link.setAttribute('data-tako-staff-return','')
 link.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
 link.append(document.createTextNode('Torna all’editor'))
 link.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;try{sessionStorage.setItem(STAFF_RETURN_RESTORE_KEY,'1')}catch{}})
 document.body.appendChild(link);document.body.classList.add('tako-staff-return-space')
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)link.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:FAST_MS,easing:EASE_OUT})
 let frame=0
 const place=()=>{frame=0;document.documentElement.style.setProperty('--tako-staff-return-offset',bottomOffset()+'px')}
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(place)}
 place();window.addEventListener('resize',schedule,{passive:true})
 const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
}
