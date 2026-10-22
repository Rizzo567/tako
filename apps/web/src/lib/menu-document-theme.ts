// Sfondo del documento = sfondo del tema del menu (pagina pubblica e vista di modifica della dashboard, 22/10).
// Stesso default del renderer (WorkspaceMenuRenderer) quando il design non ha uno sfondo.
export const DEFAULT_MENU_BACKGROUND='#f8f5ef'
/** html, body, meta theme-color e color-scheme seguono lo sfondo del tema; restituisce il ripristino. */
export function applyDocumentTheme(color:string){
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
