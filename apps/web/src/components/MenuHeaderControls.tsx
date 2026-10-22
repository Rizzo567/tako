'use client'
import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {motion,useReducedMotion} from 'framer-motion'

import {LANGUAGE_PRESENTATION,MENU_FADE,MENU_MOTION,MENU_SPRING} from '@/lib/menu-motion'
import styles from './MenuHeaderControls.module.css'
function LanguageFlag({code}:{code:string}){
 const vertical:Record<string,string[]>={it:['#009246','#fff','#ce2b37'],fr:['#0055a4','#fff','#ef4135']},horizontal:Record<string,string[]>={de:['#111','#d00','#ffce00'],nl:['#ae1c28','#fff','#21468b'],ru:['#fff','#0039a6','#d52b1e'],pl:['#fff','#dc143c']};
 return <svg className={styles.flagIcon} data-language-flag={code} aria-hidden viewBox="0 0 60 40">{vertical[code]?vertical[code].map((c,i)=><rect key={i} x={i*20} width="20" height="40" fill={c}/>):horizontal[code]?horizontal[code].map((c,i)=><rect key={i} y={i*40/horizontal[code].length} width="60" height={40/horizontal[code].length} fill={c}/>):code==='ja'?<><rect width="60" height="40" fill="white"/><circle cx="30" cy="20" r="11" fill="#bc002d"/></>:<text x="30" y="32" textAnchor="middle" fontSize="38" fontFamily="Apple Color Emoji,Segoe UI Emoji">{LANGUAGE_PRESENTATION[code]?.flag||'🌐'}</text>}</svg>
}
type Props={languages:string[];language:string;onSelectLanguage?:(language:string)=>void;disabled:boolean;design:Record<string,any>;copy?:(text:string)=>string;onLanguageIntent?:(language:string)=>void;locked?:boolean}
export function MenuHeaderControls({languages,language,onSelectLanguage,disabled,design,copy=(text:string)=>text,onLanguageIntent,locked}:Props){
 const [viewportHeight,setViewportHeight]=useState(844),[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
 useEffect(()=>{const resize=()=>{setViewportHeight(window.innerHeight)};resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[])
 const reduced=useReducedMotion(),transition=reduced?{duration:0}:MENU_SPRING
 const lang=LANGUAGE_PRESENTATION[language]||{name:language.toUpperCase(),flag:'🌐'}
 const close=(focus=false)=>{setOpen(false);if(focus)trigger.current?.focus()}
 useEffect(()=>{if(!open)return;const handle=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))close()};document.addEventListener('pointerdown',handle);root.current?.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus();return()=>document.removeEventListener('pointerdown',handle)},[open])
 useEffect(()=>{if(disabled)close()},[disabled])
 const color=design.headerToolColor||design.text
 const variables={'--menu-accent':design.primary,'--menu-surface':design.headerBackground||design.background,'--menu-ink':color} as CSSProperties
 return <div className={styles.controls} style={variables}>
 {languages.length>0&&<div ref={root} className={styles.anchor} style={{width:52}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))close()}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close(true)}else if(open&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')||[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}}}>
 <motion.div data-menu-language-surface data-open={open} className={`${styles.surface} ${styles.flagSurface}`} style={{left:'auto',right:0,x:0}} initial={false} animate={{width:52,height:open?Math.min(languages.length*44,220,viewportHeight*.6):40}} transition={transition}>
 <motion.button ref={trigger} type="button" className={styles.trigger} initial={false} animate={{height:open?0:40,opacity:open?0:1}} transition={reduced?{duration:0}:MENU_FADE} style={{overflow:"hidden"}} aria-hidden={open} tabIndex={open||locked?-1:0} aria-label={copy('Lingua del menu')} aria-description={lang.name+' '+copy('selezionato')} aria-haspopup="menu" aria-expanded={open} disabled={disabled} {...(locked?{'aria-disabled':true}:{})} onClick={()=>{if(!locked)setOpen(v=>!v)}} onKeyDown={e=>{if(locked)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true)}}}><LanguageFlag code={language}/></motion.button>
 <motion.div role="menu" aria-label={copy('Lingue disponibili')} className={`${styles.list} ${styles.flagList}`} inert={!open} initial={false} animate={{opacity:open?1:0,y:reduced?0:open?0:-MENU_MOTION.distancePx.micro}} transition={reduced?{duration:0}:{...MENU_FADE,delay:open?MENU_MOTION.durationMs.press/1000:0}}>{languages.map(l=>{const item=LANGUAGE_PRESENTATION[l]||{name:l,flag:'🌐'};return <button key={l} type="button" role="menuitemradio" lang={l} aria-label={item.name} aria-checked={l===language} className={styles.option} tabIndex={open?0:-1} onPointerEnter={()=>onLanguageIntent?.(l)} onPointerDown={()=>onLanguageIntent?.(l)} onFocus={()=>onLanguageIntent?.(l)} onClick={()=>{onSelectLanguage?.(l);close(true)}}><LanguageFlag code={l}/></button>})}</motion.div>
 </motion.div></div>}
 </div>
}
