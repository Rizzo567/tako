/** Menu reorder gesture. Standalone DOM module, no runtime dependencies. */
export type ReorderDrop = { id: string; kind: 'menu'|'submenu'|'section'|'dish'; fromGroup: string; toGroup: string; toIndex: number }
export type GestureOptions = {
  root: HTMLElement
  itemSelector: string
  canDrop?: (item: {id:string;kind:string}, toGroup: string) => boolean
  onDrop: (drop: ReorderDrop) => void
  onModeChange?: (editing: boolean) => void
  onTap?: (id: string) => void
  longPressMs?: number
  reducedMotion?: boolean
  /** Integrazione Takomenu (22/10): al rilascio rimette il DOM com'era PRIMA di onDrop; il chiamante (React) ridisegna nel nuovo ordine.
   *  Senza, React troverebbe nodi spostati da fuori e andrebbe in errore (removeChild) quando un piatto cambia Sezione. */
  restoreDomOnDrop?: boolean
}

type Kind = ReorderDrop['kind']
type Box = { left:number; top:number; width:number; height:number; right:number; bottom:number }
type Spring = { x:number; y:number; vx:number; vy:number }
type Saved = { styles:Map<string,[string,string]>; attrs:Map<string,string|null> }
type Item = { el:HTMLElement; id:string; kind:Kind; group:string; box:Box; spring:Spring; phase:number; angle:number; saved:Saved; base:string; parent:HTMLElement|null }
type Group = { el:HTMLElement; id:string; axis:'x'|'y'|'grid'; kind:Kind|null; box:Box }
type Scroller = { el:HTMLElement; box:Box; x:number; y:number; maxX:number; maxY:number; allowX:boolean; allowY:boolean }
type Pending = { item:Item; id:number; x:number; y:number; timer:number; pointerType:string }
type Drag = { item:Item; id:number|null; keyboard:boolean; pointerType:string; fromGroup:string; fromIndex:number; parent:Node; next:Node|null; originalGroup:string; group:string; index:number; anchorX:number; anchorY:number; x:number; y:number; lastX:number; lastY:number; ghost:HTMLElement; scale:number; scaleV:number; w:number; h:number }
type Landing = { started:number; id:string; ghost:HTMLElement; x:number; y:number; vx:number; vy:number; scale:number; scaleV:number; w:number; h:number }

const TAU = Math.PI * 2
const EPS = .025
const KINDS = new Set(['menu','submenu','section','dish'])
let serial = 0
function box(r:DOMRect):Box { return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom} }
function phase(id:string):number { let h=2166136261; for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return (h>>>0)/4294967296*TAU }
/** Exact critically damped spring, stable across variable refresh rates. */
function spring(x:number,v:number,target:number,dt:number,omega:number):[number,number] {
  const d=x-target, a=v+omega*d, e=Math.exp(-omega*dt)
  return [target+(d+a*dt)*e,(v-omega*a*dt)*e]
}

export function createMenuGesture(opts:GestureOptions): { exitEditMode():void; refresh():void; destroy():void } {
  const root=opts.root, doc=root.ownerDocument, win=doc.defaultView
  if(!win)throw new Error('The gesture root must belong to a document with a window.')
  const view=win
  const token='menu-gesture-'+(++serial)
  const media=view.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced=opts.reducedMotion??media.matches, editing=false, dead=false
  let items:Item[]=[], groups:Group[]=[], scrollers:Scroller[]=[]
  let pending:Pending|null=null, drag:Drag|null=null, landing:Landing|null=null
  let raf=0, previousTime=0, clickUntil=0, exitAt=0, exitAngles=new Map<string,number>()
  let announceTimer=0, lastAnnouncement=''
  const listeners:Array<()=>void>=[]
  const rootSaved:Saved={styles:new Map(),attrs:new Map()}
  const style=doc.createElement('style')
  style.textContent=`[data-menu-gesture-owner="${token}"]{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition-property:none!important;animation:none!important}[data-menu-gesture-owner="${token}"]:focus-visible{outline:2px solid #252525;outline-offset:4px}[data-menu-gesture-owner="${token}"][data-menu-gesture-edit]{cursor:grab!important}[data-menu-gesture-owner="${token}"][data-menu-gesture-static]{outline:2px solid #555;outline-offset:3px}[data-menu-gesture-ghost="${token}"]{pointer-events:none!important;z-index:2147483000!important;contain:layout style;user-select:none!important}`
  ;(doc.head||root).append(style)
  const live=doc.createElement('div'), instructions=doc.createElement('div')
  const hidden='position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;pointer-events:none'
  live.style.cssText=hidden;live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true')
  instructions.style.cssText=hidden;instructions.id=token+'-keys'
  instructions.textContent='Spazio per prendere. Frecce per spostare. Spazio o Invio per posare. Escape per annullare.'
  root.append(live,instructions)

  function listen(target:EventTarget,type:string,handler:EventListener,options?:AddEventListenerOptions|boolean) {
    target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options))
  }
  function attr(el:HTMLElement,saved:Saved,name:string,value:string|null) {
    if(!saved.attrs.has(name))saved.attrs.set(name,el.getAttribute(name))
    if(value===null)el.removeAttribute(name);else el.setAttribute(name,value)
  }
  function css(el:HTMLElement,saved:Saved,name:string,value:string) {
    if(!saved.styles.has(name))saved.styles.set(name,[el.style.getPropertyValue(name),el.style.getPropertyPriority(name)])
    if(value)el.style.setProperty(name,value);else el.style.removeProperty(name)
  }
  function restore(el:HTMLElement,saved:Saved) {
    for(const [k,[v,p]] of saved.styles){if(v)el.style.setProperty(k,v,p);else el.style.removeProperty(k)}
    for(const [k,v] of saved.attrs){if(v===null)el.removeAttribute(k);else el.setAttribute(k,v)}
    if(!el.getAttribute('style')?.trim())el.removeAttribute('style')
  }
  function announce(message:string) {
    if(dead||message===lastAnnouncement)return
    lastAnnouncement=message;view.clearTimeout(announceTimer)
    live.textContent='';announceTimer=view.setTimeout(()=>{if(!dead)live.textContent=message},30)
  }
  function element(target:EventTarget|null):HTMLElement|null {
    if(!(target instanceof view.Element))return null
    const el=target.closest(opts.itemSelector)
    return el instanceof view.HTMLElement&&root.contains(el)?el:null
  }
  function itemFor(target:EventTarget|null):Item|undefined { const el=element(target);return items.find(i=>i.el===el) }
  function isControl(target:EventTarget|null,item:Item):boolean {
    if(!(target instanceof view.Element)||target===item.el)return false
    const control=target.closest('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[contenteditable="true"],a[href],button:not(:disabled),[data-gesture-ignore]') // Takomenu 22/10: i controlli disattivati (riga del piatto in anteprima) non bloccano il gesto
    return !!control&&control!==item.el
  }
  function direct(g:Group):Item[] { return items.filter(i=>i.group===g.id&&g.el.contains(i.el)).sort((a,b)=>a.el===b.el?0:a.el.compareDocumentPosition(b.el)&4?-1:1) }
  function groupBy(id:string):Group|undefined { return groups.find(g=>g.id===id) }
  function usable(g:Group,d:Drag):boolean {
    if(d.item.el.contains(g.el))return false
    if(g.kind!==null&&g.kind!==d.item.kind)return false
    return !opts.canDrop||opts.canDrop({id:d.item.id,kind:d.item.kind},g.id)
  }
  function renderItem(i:Item,time:number) {
    let a=0,dy=0
    if(editing&&drag?.item!==i&&!reduced){const amplitude=Math.min(1.8,1.9/Math.max(1,Math.hypot(i.box.width,i.box.height)/2)*180/Math.PI);a=Math.sin(time/255*TAU+i.phase)*amplitude;dy=Math.sin(time/255*TAU+i.phase+.8)*.4}
    else if(!editing&&!reduced&&exitAt){const p=Math.min(1,(time-exitAt)/90);a=(exitAngles.get(i.id)||0)*(1-p)*(1-p)}
    i.angle=a
    const moving=Math.abs(i.spring.x)+Math.abs(i.spring.y)+Math.abs(a)+Math.abs(dy)>.001
    css(i.el,i.saved,'transform',moving?`translate3d(${i.spring.x}px,${i.spring.y+dy}px,0) rotate(${a}deg) ${i.base}`:i.base)
  }
  function requestFrame(){if(!dead&&!raf){previousTime=0;raf=view.requestAnimationFrame(frame)}}

  /** Only event handlers/refresh measure geometry. The animation loop never reads layout. */
  function measure(withScrollers=true) {
    for(const i of items)i.el.style.setProperty('transform',i.base||'none')
    const rects=items.map(i=>box(i.el.getBoundingClientRect()))
    for(let n=0;n<items.length;n++)items[n].box=rects[n]
    for(const g of groups)g.box=box(g.el.getBoundingClientRect())
    for(const i of items)renderItem(i,view.performance.now())
    if(withScrollers)cacheScrollers()
  }
  function cacheScrollers() {
    const nodes:HTMLElement[]=[], add=(el:HTMLElement)=>{if(!nodes.includes(el))nodes.push(el)}
    let start=drag?groupBy(drag.group)?.el:root
    while(start){add(start);start=start.parentElement||undefined}
    const page=doc.scrollingElement as HTMLElement|null;if(page)add(page)
    scrollers=nodes.map(el=>{
      const pageNode=el===page,computed=view.getComputedStyle(el)
      return {el,box:pageNode?{left:0,top:0,width:view.innerWidth,height:view.innerHeight,right:view.innerWidth,bottom:view.innerHeight}:box(el.getBoundingClientRect()),x:el.scrollLeft,y:el.scrollTop,maxX:Math.max(0,el.scrollWidth-el.clientWidth),maxY:Math.max(0,el.scrollHeight-el.clientHeight),allowX:pageNode||/(auto|scroll|overlay)/.test(computed.overflowX),allowY:pageNode||/(auto|scroll|overlay)/.test(computed.overflowY)}
    })
  }
  function flip(change:()=>void) {
    const before=new Map(items.map(i=>[i.el,i.box]))
    change();measure(false)
    for(const i of items){
      const b=before.get(i.el);if(!b||i===drag?.item)continue
      let dx=b.left-i.box.left,dy=b.top-i.box.top
      if(i.parent){const p=items.find(r=>r.el===i.parent),pb=before.get(i.parent);if(p&&pb){dx-=pb.left-p.box.left;dy-=pb.top-p.box.top}}
      if(reduced){i.spring={x:0,y:0,vx:0,vy:0}}
      else {i.spring.x+=dx;i.spring.y+=dy}
      renderItem(i,view.performance.now())
    }
    requestFrame()
  }
  function clearPending() {
    if(!pending)return
    view.clearTimeout(pending.timer);pending=null
  }
  function mode(value:boolean) {
    if(editing===value)return
    editing=value
    if(value){exitAt=0;exitAngles.clear()}
    else {exitAt=view.performance.now();exitAngles=new Map(items.map(i=>[i.id,i.angle]))}
    for(const i of items){
      attr(i.el,i.saved,'data-menu-gesture-edit',value?'':null)
      attr(i.el,i.saved,'data-menu-gesture-static',value&&reduced?'':null)
      css(i.el,i.saved,'touch-action',value?'none':i.saved.styles.get('touch-action')?.[0]||'')
    }
    opts.onModeChange?.(value)
    announce(value?'Riordino attivo. Premi Fine per terminare.':'Riordino terminato.')
    requestFrame()
  }
  function clone(item:Item):HTMLElement {
    const ghost=item.el.cloneNode(true) as HTMLElement
    const sources=[item.el,...Array.from(item.el.querySelectorAll<HTMLElement>('*'))]
    const targets=[ghost,...Array.from(ghost.querySelectorAll<HTMLElement>('*'))]
    for(let n=0;n<sources.length;n++){
      const computed=view.getComputedStyle(sources[n]),node=targets[n]
      for(let j=0;j<computed.length;j++){const k=computed[j];node.style.setProperty(k,computed.getPropertyValue(k))}
      node.removeAttribute('id');node.removeAttribute('data-menu-gesture-owner');node.removeAttribute('data-menu-gesture-edit');node.removeAttribute('data-menu-gesture-static')
      node.removeAttribute('data-edit-id');node.removeAttribute('data-edit-kind');node.removeAttribute('data-edit-group');node.removeAttribute('data-edit-group-id');node.removeAttribute('tabindex');node.removeAttribute('autofocus');node.style.transition='none';node.style.animation='none'
    }
    ghost.setAttribute('data-menu-gesture-ghost',token);ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','')
    Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',margin:'0',width:item.box.width+'px',height:item.box.height+'px',minWidth:'0',maxWidth:'none',boxSizing:'border-box',transformOrigin:'50% 50%',visibility:'visible',willChange:'transform',pointerEvents:'none',boxShadow:'0 14px 30px rgba(0,0,0,.16)'})
    ;(doc.body||root).append(ghost);return ghost
  }
  function hide(i:Item){css(i.el,i.saved,'opacity','0')}
  function reveal(i:Item){css(i.el,i.saved,'opacity',i.saved.styles.get('opacity')?.[0]||'')}
  function endLanding() {
    if(!landing)return
    const i=items.find(i=>i.id===landing!.id);if(i)reveal(i)
    landing.ghost.remove();landing=null
  }
  function begin(i:Item,pointerId:number|null,x:number,y:number,pointerType:string,keyboard=false) {
    clearPending();endLanding();measure()
    const g=groupBy(i.group);if(!g)return
    const index=direct(g).indexOf(i)
    if(index<0||!i.el.parentNode)return
    mode(true)
    const ghost=clone(i)
    drag={item:i,id:pointerId,keyboard,pointerType,fromGroup:i.group,fromIndex:index,parent:i.el.parentNode,next:i.el.nextSibling,originalGroup:i.el.getAttribute('data-edit-group')||i.group,group:i.group,index,anchorX:x-i.box.left,anchorY:y-i.box.top,x,y,lastX:x,lastY:y,ghost,scale:reduced?1.1:1,scaleV:0,w:i.box.width,h:i.box.height}
    hide(i);css(root,rootSaved,'user-select','none');css(root,rootSaved,'-webkit-user-select','none')
    if(pointerId!==null)try{root.setPointerCapture(pointerId)}catch{/* pointer may have ended */}
    if(reduced||keyboard)ghost.style.outline='2px solid #444'
    announce(`${i.el.getAttribute('aria-label')||i.el.textContent?.trim().slice(0,70)||i.id} preso. Posizione ${index+1}.`)
    cacheScrollers();renderGhost();requestFrame()
  }
  function renderGhost() {
    if(!drag)return
    const d=drag
    d.ghost.style.transform=`translate3d(${d.x-d.anchorX}px,${d.y-d.anchorY}px,0) scale(${d.scale})`
  }
  function insert(g:Group,index:number) {
    const d=drag;if(!d||!usable(g,d))return
    const others=direct(g).filter(i=>i!==d.item),nextIndex=Math.max(0,Math.min(others.length,index))
    if(g.id===d.group&&nextIndex===d.index)return
    let anchor:Node|null=others[nextIndex]?.el||null
    while(anchor&&anchor.parentNode!==g.el)anchor=anchor.parentNode
    flip(()=>{g.el.insertBefore(d.item.el,anchor);d.item.group=g.id;d.item.el.setAttribute('data-edit-group',g.id);d.group=g.id;d.index=nextIndex})
    if(d.keyboard)d.item.el.focus({preventScroll:true})
    cacheScrollers()
    announce(`Posizione ${nextIndex+1} di ${others.length+1}. ${g.el.getAttribute('aria-label')||g.id}.`)
  }
  function indexAt(g:Group,x:number,y:number):number {
    const list=direct(g).filter(i=>i!==drag?.item)
    if(g.axis==='x'){const n=list.findIndex(i=>x<i.box.left+i.box.width/2);return n<0?list.length:n}
    if(g.axis==='y'){const n=list.findIndex(i=>y<i.box.top+i.box.height/2);return n<0?list.length:n}
    if(!list.length)return 0
    const rows:Item[][]=[]
    for(const i of list){let row=rows.find(r=>Math.abs(r[0].box.top-i.box.top)<Math.min(r[0].box.height,i.box.height)*.5);if(!row){row=[];rows.push(row)}row.push(i)}
    rows.sort((a,b)=>a[0].box.top-b[0].box.top)
    let row=rows.reduce((best,r)=>Math.abs(y-(r[0].box.top+r[0].box.height/2))<Math.abs(y-(best[0].box.top+best[0].box.height/2))?r:best,rows[0])
    row=[...row].sort((a,b)=>a.box.left-b.box.left)
    const before=row.find(i=>x<i.box.left+i.box.width/2)
    return before?list.indexOf(before):list.indexOf(row[row.length-1])+1
  }
  function target(force=false) {
    const d=drag;if(!d||d.keyboard)return
    const x=d.x-d.anchorX+d.w/2,y=d.y-d.anchorY+d.h/2
    const candidates=groups.filter(g=>usable(g,d)&&x>=g.box.left-24&&x<=g.box.right+24&&y>=g.box.top-24&&y<=g.box.bottom+24)
    candidates.sort((a,b)=>a.el.contains(b.el)?1:b.el.contains(a.el)?-1:(a.box.width*a.box.height)-(b.box.width*b.box.height))
    const g=candidates[0];if(!g)return
    if(!force&&g.id===d.group&&Math.hypot(d.x-d.lastX,d.y-d.lastY)<4)return
    d.lastX=d.x;d.lastY=d.y;insert(g,indexAt(g,x,y))
  }
  function finish(cancel:boolean) {
    const d=drag;if(!d)return
    if(!cancel&&(d.fromGroup!==d.group||d.fromIndex!==d.index)){const g=groupBy(d.group);if(!g||!usable(g,d))cancel=true}
    const drop:ReorderDrop={id:d.item.id,kind:d.item.kind,fromGroup:d.fromGroup,toGroup:d.group,toIndex:d.index}
    const changed=!cancel&&(d.fromGroup!==d.group||d.fromIndex!==d.index)
    if(cancel&&root.contains(d.item.el)&&d.parent.isConnected){
      flip(()=>{d.parent.insertBefore(d.item.el,d.next?.parentNode===d.parent?d.next:null);d.item.group=d.originalGroup;d.item.el.setAttribute('data-edit-group',d.originalGroup)})
    }
    drag=null
    if(d.id!==null)try{root.releasePointerCapture(d.id)}catch{/* already released */}
    css(root,rootSaved,'user-select',rootSaved.styles.get('user-select')?.[0]||'');css(root,rootSaved,'-webkit-user-select',rootSaved.styles.get('-webkit-user-select')?.[0]||'')
    landing={started:view.performance.now(),id:d.item.id,ghost:d.ghost,x:d.x-d.anchorX,y:d.y-d.anchorY,vx:0,vy:0,scale:d.scale,scaleV:d.scaleV,w:d.w,h:d.h}
    clickUntil=view.performance.now()+450
    announce(cancel?'Spostamento annullato.':changed?`Spostato in posizione ${d.index+1}.`:'Posizione invariata.')
    if(reduced)endLanding();else requestFrame()
    if(changed&&opts.restoreDomOnDrop&&d.parent.isConnected){d.parent.insertBefore(d.item.el,d.next?.parentNode===d.parent?d.next:null);d.item.group=d.originalGroup;d.item.el.setAttribute('data-edit-group',d.originalGroup)}
    if(changed)opts.onDrop(drop)
  }
  function keyboardMove(key:string) {
    const d=drag;if(!d)return
    const g=groupBy(d.group);if(!g)return
    const list=direct(g),n=list.indexOf(d.item)
    let step=0
    if(g.axis==='x')step=key==='ArrowRight'?1:key==='ArrowLeft'?-1:0
    else if(g.axis==='y')step=key==='ArrowDown'?1:key==='ArrowUp'?-1:0
    else if(key==='ArrowRight'||key==='ArrowLeft')step=key==='ArrowRight'?1:-1
    else {
      const centerX=d.item.box.left+d.item.box.width/2, centerY=d.item.box.top+d.item.box.height/2,dir=key==='ArrowDown'?1:-1
      const choices=list.filter(i=>i!==d.item&&(i.box.top+i.box.height/2-centerY)*dir>d.item.box.height*.45)
      choices.sort((a,b)=>{const score=(i:Item)=>Math.abs(i.box.top+i.box.height/2-centerY)+Math.abs(i.box.left+i.box.width/2-centerX)*.6;return score(a)-score(b)})
      if(choices[0]){insert(g,list.indexOf(choices[0]));return}
    }
    if(!step)return
    if(n+step>=0&&n+step<list.length){insert(g,n+step);return}
    // At the end of a section, the next arrow transfers a dish to the next section.
    if(d.item.kind==='dish'&&g.axis==='y'){
      const compatible=groups.filter(x=>usable(x,d)).sort((a,b)=>a.el.compareDocumentPosition(b.el)&4?-1:1)
      const next=compatible[compatible.indexOf(g)+step]
      if(next)insert(next,step>0?0:direct(next).length)
    }
  }
  function onDown(event:PointerEvent) {
    if(dead||event.button!==0||!event.isPrimary||drag)return
    const i=itemFor(event.target)
    if(!i){clearPending();if(editing)exitEditMode();return}
    if(isControl(event.target,i))return
    clearPending()
    if(editing){event.preventDefault();begin(i,event.pointerId,event.clientX,event.clientY,event.pointerType);return}
    const p:Pending={item:i,id:event.pointerId,x:event.clientX,y:event.clientY,timer:0,pointerType:event.pointerType}
    pending=p
    p.timer=view.setTimeout(()=>{if(pending===p&&root.contains(i.el))begin(i,p.id,p.x,p.y,p.pointerType)},Math.max(0,opts.longPressMs??1000))
  }
  function onMove(event:PointerEvent) {
    if(pending&&event.pointerId===pending.id&&Math.hypot(event.clientX-pending.x,event.clientY-pending.y)>8)clearPending()
    if(!drag||event.pointerId!==drag.id)return
    if(event.cancelable)event.preventDefault()
    drag.x=event.clientX;drag.y=event.clientY;renderGhost();target();requestFrame()
  }
  function onUp(event:PointerEvent) {
    if(pending&&event.pointerId===pending.id){const p=pending;clearPending();if(root.contains(p.item.el)){clickUntil=view.performance.now()+350;opts.onTap?.(p.item.id)}return}
    if(drag&&event.pointerId===drag.id)finish(false)
  }
  function onCancel(event:PointerEvent) { if(pending?.id===event.pointerId)clearPending();if(drag?.id===event.pointerId)finish(true) }
  function onKeys(event:KeyboardEvent) {
    if(event.key==='Escape'){
      if(drag){event.preventDefault();finish(true)}else if(pending){clearPending()}else if(editing){event.preventDefault();exitEditMode()}
      return
    }
    const i=itemFor(event.target);if(!i||isControl(event.target,i))return
    if(event.repeat&&[' ','Enter'].includes(event.key))return
    if(!drag&&(event.key===' '||event.code==='Space')){event.preventDefault();begin(i,null,i.box.left+i.box.width/2,i.box.top+i.box.height/2,'keyboard',true);return}
    if(drag?.keyboard){
      if([' ','Enter'].includes(event.key)){event.preventDefault();finish(false)}
      else if(event.key.startsWith('Arrow')){event.preventDefault();keyboardMove(event.key)}
    } else if(!drag&&event.key==='Enter'){event.preventDefault();opts.onTap?.(i.id)}
  }
  function onScroll() { clearPending();if(dead)return;measure();if(drag)target(true) }
  function speed(p:number,min:number,max:number) { const edge=52;return p<min+edge?-Math.min(1,Math.max(0,(min+edge-p)/edge))*750:p>max-edge?Math.min(1,Math.max(0,(p-(max-edge))/edge))*750:0 }
  function autoScroll(dt:number) {
    if(!drag||drag.keyboard)return
    let movedX=false,movedY=false
    for(const s of scrollers){
      if(drag.x<s.box.left-30||drag.x>s.box.right+30||drag.y<s.box.top-30||drag.y>s.box.bottom+30)continue
      const sx=!movedX&&s.allowX&&s.maxX?speed(drag.x,s.box.left,s.box.right):0,sy=!movedY&&s.allowY&&s.maxY?speed(drag.y,s.box.top,s.box.bottom):0
      const x=Math.min(s.maxX,Math.max(0,s.x+sx*dt)),y=Math.min(s.maxY,Math.max(0,s.y+sy*dt))
      if(x!==s.x){s.x=x;s.el.scrollLeft=x;movedX=true}
      if(y!==s.y){s.y=y;s.el.scrollTop=y;movedY=true}
    }
  }
  function frame(time:number) {
    raf=0;if(dead)return
    const dt=previousTime?Math.min(.05,(time-previousTime)/1000):1/60;previousTime=time
    let busy=false
    for(const i of items){
      if(!reduced){[i.spring.x,i.spring.vx]=spring(i.spring.x,i.spring.vx,0,dt,19);[i.spring.y,i.spring.vy]=spring(i.spring.y,i.spring.vy,0,dt,19)}
      else i.spring={x:0,y:0,vx:0,vy:0}
      if(Math.abs(i.spring.x)+Math.abs(i.spring.y)+Math.abs(i.spring.vx)+Math.abs(i.spring.vy)>EPS)busy=true
      else i.spring={x:0,y:0,vx:0,vy:0}
      renderItem(i,time)
    }
    if(drag){[drag.scale,drag.scaleV]=reduced?[1.1,0]:spring(drag.scale,drag.scaleV,1.1,dt,28);renderGhost();autoScroll(dt);busy=true}
    if(landing){
      const l=landing,i=items.find(i=>i.id===l.id)
      if(!i||!root.contains(i.el)){endLanding()}
      else {
        const tx=i.box.left+(i.box.width-l.w)/2,ty=i.box.top+(i.box.height-l.h)/2
        ;[l.x,l.vx]=spring(l.x,l.vx,tx,dt,19);[l.y,l.vy]=spring(l.y,l.vy,ty,dt,19);[l.scale,l.scaleV]=spring(l.scale,l.scaleV,1,dt,19)
        const amplitude=Math.min(1.8,1.9/Math.max(1,Math.hypot(l.w,l.h)/2)*180/Math.PI),angle=editing&&!reduced&&time-l.started>50?Math.sin(time/255*TAU+i.phase)*amplitude:0
        l.ghost.style.transform=`translate3d(${l.x}px,${l.y}px,0) rotate(${angle}deg) scale(${l.scale})`
        if(reduced||(Math.abs(l.x-tx)+Math.abs(l.y-ty)<.5&&Math.abs(l.vx)+Math.abs(l.vy)<10&&Math.abs(l.scale-1)<.002))endLanding();else busy=true
      }
    }
    if(exitAt&&time-exitAt>=90){exitAt=0;exitAngles.clear()}
    if((editing&&!reduced)||busy||exitAt)raf=view.requestAnimationFrame(frame);else previousTime=0
  }
  function refresh() {
    if(dead)return
    const nodes=Array.from(root.querySelectorAll<HTMLElement>(opts.itemSelector)).filter(el=>KINDS.has(el.dataset.editKind||'')&&el.dataset.editId&&el.dataset.editGroup&&!el.closest('[data-menu-gesture-ghost]'))
    const previous=new Map(items.map(i=>[i.el,i]))
    for(const i of items)if(!nodes.includes(i.el))restore(i.el,i.saved)
    if(drag&&!nodes.includes(drag.item.el)){drag.ghost.remove();drag=null;css(root,rootSaved,'user-select',rootSaved.styles.get('user-select')?.[0]||'');css(root,rootSaved,'-webkit-user-select',rootSaved.styles.get('-webkit-user-select')?.[0]||'')}
    clearPending()
    items=nodes.map(el=>{
      let i=previous.get(el)
      if(!i){
        const copied=items.find(old=>old.id===el.dataset.editId)
        if(copied&&el.getAttribute('data-menu-gesture-owner')===token)restore(el,copied.saved)
        const saved:Saved={styles:new Map(),attrs:new Map()},computed=view.getComputedStyle(el)
        i={el,id:el.dataset.editId!,kind:el.dataset.editKind as Kind,group:el.dataset.editGroup!,box:box(el.getBoundingClientRect()),spring:{x:0,y:0,vx:0,vy:0},phase:phase(el.dataset.editId!),angle:0,saved,base:computed.transform==='none'?'':computed.transform,parent:null}
        // Register values before any module writes.
        for(const name of ['transform','visibility','opacity','touch-action','will-change'])saved.styles.set(name,[el.style.getPropertyValue(name),el.style.getPropertyPriority(name)])
        attr(el,saved,'data-menu-gesture-owner',token)
        if(!el.hasAttribute('tabindex'))attr(el,saved,'tabindex','0')
        if(!el.hasAttribute('role'))attr(el,saved,'role','button')
        attr(el,saved,'aria-roledescription','Elemento riordinabile')
        attr(el,saved,'aria-describedby',[el.getAttribute('aria-describedby'),instructions.id].filter(Boolean).join(' '))
      }
      i.id=el.dataset.editId!;i.kind=el.dataset.editKind as Kind;i.group=el.dataset.editGroup!
      const ancestor=el.parentElement?.closest(opts.itemSelector);i.parent=ancestor instanceof view.HTMLElement&&root.contains(ancestor)?ancestor:null
      attr(el,i.saved,'data-menu-gesture-edit',editing?'':null);attr(el,i.saved,'data-menu-gesture-static',editing&&reduced?'':null)
      css(el,i.saved,'touch-action',editing?'none':i.saved.styles.get('touch-action')?.[0]||'')
      return i
    })
    groups=Array.from(root.querySelectorAll<HTMLElement>('[data-edit-group-id]')).map(el=>{
      const id=el.dataset.editGroupId!,axis=el.dataset.editAxis==='x'?'x':el.dataset.editAxis==='grid'?'grid':'y'
      const member=items.find(i=>i.group===id),parent=el.closest(opts.itemSelector)
      const inferred=member?.kind||(parent?.getAttribute('data-edit-kind')==='section'?'dish':axis==='x'?'menu':axis==='grid'?'submenu':null)
      return{el,id,axis,kind:inferred as Kind|null,box:box(el.getBoundingClientRect())}
    })
    if(root.matches('[data-edit-group-id]'))groups.unshift({el:root,id:root.dataset.editGroupId!,axis:(root.dataset.editAxis||'y') as Group['axis'],kind:items.find(i=>i.group===root.dataset.editGroupId)?.kind||null,box:box(root.getBoundingClientRect())})
    if(landing){const i=items.find(i=>i.id===landing!.id);if(i)hide(i)}
    measure();requestFrame()
  }
  function exitEditMode(){if(dead)return;clearPending();if(drag)finish(true);mode(false)}
  function destroy() {
    if(dead)return
    clearPending();if(drag)finish(true);endLanding();mode(false);dead=true
    view.cancelAnimationFrame(raf);view.clearTimeout(announceTimer);raf=0
    for(const remove of listeners)remove()
    for(const i of items)restore(i.el,i.saved)
    restore(root,rootSaved);style.remove();live.remove();instructions.remove();items=[];groups=[];scrollers=[]
  }
  listen(root,'pointerdown',onDown as EventListener)
  listen(doc,'pointermove',onMove as EventListener,{passive:false})
  listen(doc,'pointerup',onUp as EventListener)
  listen(doc,'pointercancel',onCancel as EventListener)
  listen(root,'lostpointercapture',((e:PointerEvent)=>{if(drag?.id===e.pointerId)finish(true)}) as EventListener)
  listen(doc,'pointerdown',((e:PointerEvent)=>{if(editing&&!root.contains(e.target as Node))exitEditMode()}) as EventListener)
  listen(root,'click',((e:MouseEvent)=>{if(view.performance.now()<clickUntil){e.preventDefault();e.stopImmediatePropagation()}}) as EventListener,true)
  listen(doc,'keydown',onKeys as EventListener)
  listen(doc,'scroll',onScroll as EventListener,true)
  listen(view,'blur',(()=>{clearPending();if(drag)finish(true)}) as EventListener)
  listen(doc,'visibilitychange',(()=>{if(doc.hidden){clearPending();if(drag)finish(true)}}) as EventListener)
  listen(view,'resize',(()=>{clearPending();measure()}) as EventListener)
  // Native touch scrolling is allowed until the hold has completed. Register before
  // touchstart (not after lift), so iOS can honour preventDefault on the first move.
  listen(doc,'touchmove',((e:TouchEvent)=>{if(drag&&!drag.keyboard&&e.cancelable)e.preventDefault()}) as EventListener,{passive:false})
  listen(root,'contextmenu',((e:Event)=>{if(pending||drag||editing)e.preventDefault()}) as EventListener)
  if(opts.reducedMotion===undefined)listen(media,'change',((e:MediaQueryListEvent)=>{reduced=e.matches;refresh();if(reduced)endLanding()}) as EventListener)
  refresh()
  return{exitEditMode,refresh,destroy}
}
