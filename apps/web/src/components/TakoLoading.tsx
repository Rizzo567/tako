'use client'
export function TakoLoading({label='Caricamento…',variant='inline',className=''}:{label?:string;variant?:'inline'|'compact'|'page'|'screen';className?:string}){
 const prefix=typeof document==='undefined'?'':document.querySelector('script[src*="/takomenu-app/assets/"]')?'/takomenu-app':document.querySelector('script[src*="/takomenu-public/assets/"]')?'/takomenu-public':''
 return <span role="status" aria-live="polite" className={`tako-loading tako-loading--${variant} ${className}`}><picture className="tako-loading__figure"><source media="(prefers-reduced-motion: reduce)" srcSet={`${prefix}/loading/tako-loading-static.svg?v=20261012-trace-slow`}/><img className="tako-loading__mascot" src={`${prefix}/loading/tako-loading.svg?v=20261012-trace-slow`} alt="" aria-hidden="true"/></picture><span className="tako-loading__text">{label}</span></span>
}
