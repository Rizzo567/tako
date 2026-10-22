// Diagnosi del gesto sul telefono vero (22/10): `?gesturedebug=1` sull'URL della dashboard (letto dal genitore same-origin)
// o dell'iframe. Mostra in piccolo gli ultimi eventi grezzi (tipo, ms, bersaglio, coordinate, cancelable/defaultPrevented)
// e lo stato della macchina del gesto con il motivo di ogni annullo. Senza il parametro non esiste nulla.
export function gestureDebugEnabled(): boolean {
  const on = (search: string) => { try { return new URLSearchParams(search).get('gesturedebug') === '1' } catch { return false } }
  if (on(location.search)) return true
  try { return window.parent !== window && on(window.parent.location.search) } catch { return false }
}

export function createGestureDebugOverlay(doc: Document): { state(state: string, detail: string): void; destroy(): void } {
  const view = doc.defaultView!, box = doc.createElement('div'), head = doc.createElement('div'), list = doc.createElement('div')
  box.setAttribute('data-gesture-debug', ''); box.setAttribute('aria-hidden', 'true')
  box.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:calc(100vw - 8px);pointer-events:none;background:rgba(0,0,0,.82);color:#fff;font:calc(10px * var(--tako-edit-inv,1))/1.35 ui-monospace,Menlo,monospace;padding:calc(4px * var(--tako-edit-inv,1));border-radius:6px;white-space:pre;overflow:hidden'
  head.style.cssText = 'color:#ffd54a;font-weight:700'
  box.append(head, list); (doc.body || doc.documentElement).append(box)
  const lines: string[] = [], t0 = view.performance.now(), MAX = 15
  let gestureState = 'idle', lastReason = ''
  const lastMoveLog: Record<string, number> = {}
  const ms = () => Math.round(view.performance.now() - t0)
  const render = () => { head.textContent = `gesto: ${gestureState}${lastReason ? ' · ' + lastReason : ''}  [touch=${'ontouchstart' in view ? 'sì' : 'no'} inv=${getComputedStyle(doc.documentElement).getPropertyValue('--tako-edit-inv').trim() || '1'}]`; list.textContent = lines.join('\n') }
  const push = (line: string) => { lines.push(line); while (lines.length > MAX) lines.shift(); render() }
  const name = (t: EventTarget | null) => {
    if (!(t instanceof view.Element)) return t === doc ? 'document' : t === view ? 'window' : String(t && (t as any).constructor?.name)
    const kind = t.closest('[data-edit-id]')?.getAttribute('data-edit-kind')
    return t.tagName.toLowerCase() + ((t as HTMLButtonElement).disabled ? '[dis]' : '') + (kind ? '@' + kind : '')
  }
  const flags = (e: Event) => (e.cancelable ? 'C' : 'c') + (e.defaultPrevented ? 'P' : 'p')
  const handler = (e: Event) => {
    const type = e.type
    if (type === 'touchmove' || type === 'pointermove' || type === 'scroll') { const now = view.performance.now(); if (now - (lastMoveLog[type] || 0) < 120) return; lastMoveLog[type] = now }
    let xy = ''
    if ('changedTouches' in e) { const t = (e as TouchEvent).changedTouches[0]; if (t) xy = `${Math.round(t.clientX)},${Math.round(t.clientY)} n${(e as TouchEvent).touches.length}` }
    else if ('clientX' in e) { const p = e as PointerEvent; xy = `${Math.round(p.clientX)},${Math.round(p.clientY)}${p.pointerType ? ' ' + p.pointerType : ''}` }
    else if (type === 'scroll') xy = `y=${Math.round(view.scrollY)}`
    push(`${String(ms()).padStart(6)} ${type.padEnd(13)} ${name(e.target).padEnd(16)} ${xy} ${flags(e)} [${gestureState}]`)
  }
  const types = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'click', 'contextmenu', 'selectstart', 'dragstart', 'scroll', 'blur', 'focus', 'resize', 'visibilitychange']
  // Bubble su window: si legge defaultPrevented DOPO i gestori del modulo (documento/radice). scroll e blur in cattura.
  for (const type of types) view.addEventListener(type, handler, { capture: type === 'scroll' || type === 'blur' || type === 'focus', passive: true })
  render()
  return {
    state(state, detail) { gestureState = state; lastReason = detail; push(`${String(ms()).padStart(6)} » ${state}: ${detail}`) },
    destroy() { for (const type of types) view.removeEventListener(type, handler, { capture: type === 'scroll' || type === 'blur' || type === 'focus' }); box.remove() },
  }
}
