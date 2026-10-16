'use client'
import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {createPortal} from 'react-dom'
import {motion,useReducedMotion} from 'framer-motion'
import {MENU_MOTION,MENU_LOGO_MOTION} from '@/lib/menu-motion'
import {luminance} from '@/lib/menu-palette'
import {TakoLoading} from './TakoLoading'
import styles from './AnimatedMenuLogo.module.css'
// Navigation may replace the renderer or logo URL; the entrance belongs to the
// restaurant visit, never to a menu, language, image reload or component remount.
const enteredRestaurants=new Set<string>()
/** The cover exists from the first render; one fixed-size mark travels to its final header position. */
export function AnimatedMenuLogo({src,alt,style,accent='#242628',introKey=src}:{src:string;alt:string;style?:CSSProperties;accent?:string;introKey?:string}){
 const reduced=useReducedMotion(),header=useRef<HTMLImageElement>(null)
 const [phase,setPhase]=useState<'pending'|'center'|'hold'|'fly'|'header'>(()=>typeof window!=='undefined'&&enteredRestaurants.has(introKey)?'header':'pending')
 const [target,setTarget]=useState({x:0,y:0,width:136,height:136})
 // Copertina dell'intro: chiara sugli accenti scuri e medi, scura solo sugli accenti molto chiari (regola invariata).
 const background=(luminance(accent)??0)>0.45?'#171715':'#faf8f3'
 const measure=()=>{const rect=header.current?.getBoundingClientRect();if(rect)setTarget({x:rect.x+rect.width/2-innerWidth/2,y:rect.y+rect.height/2-innerHeight/2,width:rect.width,height:rect.height})}
 const ready=()=>{measure();setPhase(current=>current==='pending'?(reduced?'header':'center'):current)}
 useEffect(()=>{enteredRestaurants.add(introKey)},[introKey])
 useEffect(()=>{if(reduced)setPhase('header')},[reduced])
 useEffect(()=>{if(header.current?.complete&&header.current.naturalWidth)ready()},[])
 useEffect(()=>{if(phase!=='hold')return;const timer=setTimeout(()=>{measure();setPhase('fly')},MENU_LOGO_MOTION.hold);return()=>clearTimeout(timer)},[phase])
 useEffect(()=>{if(phase!=='fly')return;window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure)},[phase])
 const intro=phase!=='header'&&!reduced&&typeof document!=='undefined'?createPortal(<div className={styles.intro} data-menu-logo-intro data-phase={phase} aria-hidden>
  <motion.div className={styles.backdrop} style={{background}} initial={false} animate={{opacity:phase==='fly'?0:1}} transition={{duration:MENU_MOTION.durationMs.exit/1000,delay:phase==='fly'?(MENU_LOGO_MOTION.header-MENU_MOTION.durationMs.exit)/1000:0}}/>
  {phase==='pending'?<TakoLoading label="Caricamento menu…"/>:<motion.img src={src} alt="" data-menu-travelling-logo className={styles.center} style={{...style,width:target.width,height:target.height,marginLeft:-target.width/2,marginTop:-target.height/2}} initial={{opacity:0,x:0,y:0}} animate={{opacity:1,x:phase==='fly'?target.x:0,y:phase==='fly'?target.y:0}} transition={{opacity:{duration:MENU_MOTION.durationMs.reveal/1000},x:{duration:MENU_LOGO_MOTION.header/1000,ease:MENU_LOGO_MOTION.ease},y:{duration:MENU_LOGO_MOTION.header/1000,ease:MENU_LOGO_MOTION.ease}}} onAnimationComplete={()=>setPhase(current=>current==='center'?'hold':current==='fly'?'header':current)}/>}
 </div>,document.body):null
 return <><img fetchPriority="high" loading="eager" ref={header} src={src} alt={alt} style={{...style,opacity:phase==='header'||reduced?1:0}} decoding="async" data-menu-header-logo className={styles.header} onLoad={ready} onError={()=>setPhase('header')}/>{intro}</>
}
