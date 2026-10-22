// STUB del modulo gesto (CONTRATTO-GESTO.md). Stessa firma di `packages/menu-gesture/src/index.ts`, NESSUNA animazione:
// - clic/tocco breve su un elemento → onTap(id);
// - pressione lunga (longPressMs, default 1000) senza movimento → modalità «tremolio» (onModeChange(true)), senza tremolio visivo;
// - tastiera minima per provare la logica dati: Spazio prende, frecce spostano nel gruppo, Spazio/Invio posa (onDrop), Esc annulla.
// Il riordino vero (trascinamento, molla, auto-scroll) lo fa il modulo dell'altro agente. Qui lo si sostituisce in `gesture.ts`.
export type ReorderDrop = { id: string; kind: 'menu' | 'submenu' | 'section' | 'dish'; fromGroup: string; toGroup: string; toIndex: number }
export type GestureOptions = {
  root: HTMLElement
  itemSelector: string
  canDrop?: (item: { id: string; kind: string }, toGroup: string) => boolean
  onDrop: (drop: ReorderDrop) => void
  onModeChange?: (editing: boolean) => void
  onTap?: (id: string) => void
  longPressMs?: number
  reducedMotion?: boolean
}
export type MenuGesture = { enterEditMode?(): void; exitEditMode(): void; refresh(): void; destroy(): void }

type Picked = { el: HTMLElement; id: string; kind: ReorderDrop['kind']; group: string; from: number; to: number }

export function createMenuGesture(opts: GestureOptions): MenuGesture {
  const { root, itemSelector } = opts
  let mode = false, picked: Picked | null = null, press: { timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null = null
  const live = document.createElement('div')
  live.setAttribute('aria-live', 'assertive'); live.setAttribute('data-gesture-live', '')
  Object.assign(live.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' })
  document.body.appendChild(live)
  const say = (text: string) => { live.textContent = text }
  const setMode = (next: boolean) => { if (mode === next) return; mode = next; opts.onModeChange?.(next) }
  const itemOf = (target: EventTarget | null) => { const el = (target as Element | null)?.closest?.(itemSelector) as HTMLElement | null; return el && root.contains(el) ? el : null }
  const siblings = (group: string) => Array.from(root.querySelectorAll<HTMLElement>(itemSelector)).filter(e => e.getAttribute('data-edit-group') === group)
  const info = (el: HTMLElement) => ({ id: el.getAttribute('data-edit-id') || '', kind: (el.getAttribute('data-edit-kind') || '') as ReorderDrop['kind'], group: el.getAttribute('data-edit-group') || '' })

  const onClick = (e: MouseEvent) => {
    if (press?.fired) { press = null; e.preventDefault(); e.stopPropagation(); return }
    const el = itemOf(e.target)
    if (mode && !el) { setMode(false); return }
    if (el && !mode) opts.onTap?.(info(el).id)
  }
  const cancelPress = () => { if (press) { clearTimeout(press.timer); if (!press.fired) press = null } }
  const onPointerDown = (e: PointerEvent) => {
    const el = itemOf(e.target); if (!el || e.button > 0) return
    cancelPress()
    const state = { x: e.clientX, y: e.clientY, fired: false, timer: setTimeout(() => { state.fired = true; setMode(true) }, opts.longPressMs ?? 1000) }
    press = state
  }
  const onPointerMove = (e: PointerEvent) => { if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress() }
  const onPointerUp = () => { if (press && !press.fired) cancelPress() }

  const drop = () => {
    if (!picked) return
    const p = picked; picked = null; p.el.removeAttribute('data-gesture-picked')
    if (p.to !== p.from) { opts.onDrop({ id: p.id, kind: p.kind, fromGroup: p.group, toGroup: p.group, toIndex: p.to }); say(`Posato in posizione ${p.to + 1}`) } else say('Posato, nessuno spostamento')
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (picked) {
      if (e.key === 'Escape') { e.preventDefault(); picked.el.removeAttribute('data-gesture-picked'); picked = null; say('Spostamento annullato'); return }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drop(); return }
      const delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
      if (delta) { e.preventDefault(); const max = siblings(picked.group).length - 1; picked.to = Math.max(0, Math.min(max, picked.to + delta)); say(`Posizione ${picked.to + 1} di ${max + 1}`) }
      return
    }
    if (e.key !== ' ') return
    const el = itemOf(e.target); if (!el || el !== e.target) return
    const { id, kind, group } = info(el); if (!id || !group) return
    e.preventDefault()
    const index = siblings(group).indexOf(el)
    picked = { el, id, kind, group, from: index, to: index }
    el.setAttribute('data-gesture-picked', '')
    setMode(true)
    say(`Preso. Frecce per spostare, Spazio per posare, Esc per annullare. Posizione ${index + 1}`)
  }
  root.addEventListener('click', onClick, true)
  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', onPointerUp)
  root.addEventListener('pointercancel', cancelPress)
  root.addEventListener('keydown', onKeyDown, true)
  const api: MenuGesture & { drop(d: ReorderDrop): void } = {
    exitEditMode() { if (picked) { picked.el.removeAttribute('data-gesture-picked'); picked = null } setMode(false) },
    refresh() { if (picked && !root.contains(picked.el)) { picked = null } },
    destroy() { cancelPress(); root.removeEventListener('click', onClick, true); root.removeEventListener('pointerdown', onPointerDown); root.removeEventListener('pointermove', onPointerMove); root.removeEventListener('pointerup', onPointerUp); root.removeEventListener('pointercancel', cancelPress); root.removeEventListener('keydown', onKeyDown, true); live.remove(); if ((globalThis as any).__takoMenuGestureStub === api) delete (globalThis as any).__takoMenuGestureStub },
    /** Solo per le prove (scripts/verify-menu-editor-identical.mjs): simula un rilascio come lo farebbe il modulo vero. */
    drop(d: ReorderDrop) { if (!opts.canDrop || opts.canDrop({ id: d.id, kind: d.kind }, d.toGroup)) opts.onDrop(d) },
  }
  ;(globalThis as any).__takoMenuGestureStub = api
  return api
}
