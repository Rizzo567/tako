'use client'
// Layer di modifica dentro l'iframe /menu-preview/<menuId>?edit=1 (dashboard editor 22/10, PIANO D1/D8/D10, CONTRATTO §4–5).
// Caricato in modo pigro solo da MenuPreview: la pagina pubblica non lo scarica mai. Selezione (riquadro + matita), messaggi
// alla SPA, aggancio del motore del gesto (`gesture.ts`), lampeggio. Il renderer resta quello dei clienti in modo `editing`.
import './edit.css'
import { useEffect, useRef, useState } from 'react'
import { applyOps } from '../../../../../packages/menu-ops/src/index'
import type { Op } from '../../../../../packages/menu-ops/src/types'
import { MENU_MOTION } from '@/lib/menu-motion'
import { createMenuGesture, type MenuGesture, type ReorderDrop } from './gesture'
import { outgoing, sameSelection, type EditSelection } from './protocol'
import { canDropInto, currentOrderView, dropOps, frameSelectors, keyAction, pencilLabel, selectionFromAttributes } from './selection'

export type EditLayerState = { selection: EditSelection; flash: string[]; disabled: boolean; editing: boolean; tick: number }
type Props = { root: HTMLElement | null; doc: any; setDoc: (doc: any) => void; menuId: string; state: EditLayerState; exitTick: number }

const EDITABLE = '[data-edit-select],[data-edit-id]'
const post = (message: object) => { try { if (window.parent !== window) window.parent.postMessage(message, location.origin) } catch {} }
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MenuEditLayer({ root, doc, setDoc, menuId, state, exitTick }: Props) {
  const [selection, setSelection] = useState<EditSelection>(null)
  const [mode, setMode] = useState(false)
  const docRef = useRef(doc), menuRef = useRef(menuId), selRef = useRef<EditSelection>(null), modeRef = useRef(false), seqRef = useRef(0)
  const gestureRef = useRef<MenuGesture | null>(null), frameRef = useRef<HTMLDivElement>(null), pencilRef = useRef<HTMLButtonElement>(null)
  const lastSpa = useRef<{ selection: EditSelection; editing: boolean } | null>(null), pendingFlash = useRef<string[]>([]), flashRef = useRef<() => void>(() => {})
  docRef.current = doc; menuRef.current = menuId; selRef.current = selection; modeRef.current = mode

  const select = (next: EditSelection, notify = true) => {
    if (sameSelection(selRef.current, next)) return
    selRef.current = next; setSelection(next)
    if (notify) post(outgoing.select(next))
  }
  const sendOps = (ops: Op[]) => {
    if (!ops.length) return
    try { setDoc(applyOps(docRef.current, ops).workspace) } catch { post(outgoing.error('APPLY_FAILED')); return }
    post(outgoing.ops(ops, ++seqRef.current))
  }

  // Ordine visto ora, per la fotografia dell'ordine manuale fatta dalla SPA alla creazione di un Sottomenu dal «+».
  // Con documento già manuale nessun calcolo (la fotografia non serve più).
  useEffect(() => {
    if (!doc || doc?.design?.manualOrder === true) return
    try { post(outgoing.view(currentOrderView(doc, new Date().getHours()))) } catch {}
  }, [doc])

  // Motore del gesto: tocco breve = selezione, pressione lunga = modalità tremolio, rilascio = op.
  useEffect(() => {
    if (!root || state.disabled) return
    root.style.setProperty('--edit-fast', MENU_MOTION.durationMs.fast + 'ms'); root.style.setProperty('--edit-micro', MENU_MOTION.durationMs.micro + 'ms'); root.style.setProperty('--edit-data', MENU_MOTION.durationMs.data + 'ms')
    const gesture = createMenuGesture({
      root, itemSelector: '[data-edit-id]', reducedMotion: reduced(),
      canDrop: (item, toGroup) => canDropInto(item.kind, toGroup, menuRef.current),
      onTap: id => { const el = root.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"]`); if (el) select(selectionFromAttributes({ id, kind: el.getAttribute('data-edit-kind') })) },
      onDrop: (drop: ReorderDrop) => { let ops: Op[] = []; try { ops = dropOps(docRef.current, drop) } catch {} if (ops.length) sendOps(ops); else post(outgoing.error('DROP_IGNORED')) },
      onModeChange: editing => {
        setMode(editing); modeRef.current = editing
        if (editing) root.setAttribute('data-edit-jiggle', ''); else root.removeAttribute('data-edit-jiggle')
        post(outgoing.mode(editing))
      },
    })
    gestureRef.current = gesture
    return () => { gesture.destroy(); gestureRef.current = null; root.removeAttribute('data-edit-jiggle') }
  }, [root, state.disabled])

  // Stato dalla SPA: selezione e uscita dal tremolio solo quando cambiano lato SPA (niente eco che sovrascrive un clic recente).
  useEffect(() => {
    const prev = lastSpa.current
    if (!prev || !sameSelection(prev.selection, state.selection)) select(state.selection, false)
    if (prev?.editing && !state.editing && modeRef.current) gestureRef.current?.exitEditMode()
    lastSpa.current = { selection: state.selection, editing: state.editing }
    if (state.flash.length) pendingFlash.current = state.flash.slice()
  }, [state.tick])
  useEffect(() => { if (exitTick) gestureRef.current?.exitEditMode() }, [exitTick])
  useEffect(() => { if (state.disabled) select(null) }, [state.disabled])

  // Clic, fuoco e tastiera sulla vista.
  useEffect(() => {
    if (!root || state.disabled) return
    const editable = (target: EventTarget | null) => { const el = (target as Element | null)?.closest?.(EDITABLE) as HTMLElement | null; return el && root.contains(el) ? el : null }
    const fromEl = (el: HTMLElement) => selectionFromAttributes({ id: el.getAttribute('data-edit-id'), kind: el.getAttribute('data-edit-kind'), select: el.getAttribute('data-edit-select') })
    // Clic fuori (anche fuori dalla colonna del menu sugli schermi larghi) = deseleziona; la matita non conta come «fuori».
    // Il «fuori» si decide sul pointerdown (punto reale del dito): il clic sintetico del tocco può essere spostato dal browser
    // (touch adjustment) su un elemento vicino non selezionabile e deselezionerebbe per sbaglio.
    const onClick = (e: MouseEvent) => { if (modeRef.current) return; const el = editable(e.target); if (el) select(fromEl(el)) }
    const onDown = (e: PointerEvent) => { if (modeRef.current || e.button > 0) return; if (!editable(e.target) && !(e.target as Element)?.closest?.('.tako-edit-pencil')) select(null) }
    const onFocus = (e: FocusEvent) => { if (modeRef.current) return; const el = editable(e.target); if (el && el === e.target) select(fromEl(el)) }
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e.key, { selected: !!selRef.current, handled: e.defaultPrevented, picking: !!root.querySelector('[data-gesture-picked]') })
      if (action === 'open' && editable(e.target)) { e.preventDefault(); post(outgoing.open(selRef.current!)) }
      else if (action === 'deselect') { e.preventDefault(); select(null) }
    }
    const onDocKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !root.contains(e.target as Node) && selRef.current) select(null) }
    document.addEventListener('click', onClick); document.addEventListener('pointerdown', onDown); root.addEventListener('focusin', onFocus); root.addEventListener('keydown', onKey); document.addEventListener('keydown', onDocKey)
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('pointerdown', onDown); root.removeEventListener('focusin', onFocus); root.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onDocKey) }
  }, [root, state.disabled])

  // Dopo ogni ri-render (documento nuovo, cambio pagina fra pillole, cambio Menu): riaggancio del gesto e lampeggio.
  useEffect(() => {
    if (!root) return
    let frame = 0
    const flash = () => {
      const ids = pendingFlash.current; if (!ids.length) return
      const found = ids.flatMap(id => Array.from(root.querySelectorAll<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"],[data-edit-select$=":${CSS.escape(id)}"]`)))
      if (!found.length) return
      pendingFlash.current = []
      const ms = reduced() ? MENU_MOTION.durationMs.data : MENU_MOTION.durationMs.fast * 2
      for (const el of found) { el.removeAttribute('data-edit-flash'); void el.offsetWidth; el.setAttribute('data-edit-flash', ''); setTimeout(() => el.removeAttribute('data-edit-flash'), ms) }
    }
    flashRef.current = flash
    const settle = () => { frame = 0; gestureRef.current?.refresh(); flash() }
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(settle) })
    observer.observe(root, { childList: true, subtree: true })
    frame = requestAnimationFrame(settle)
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [root])
  // Documento o stato nuovi senza cambi di DOM (stesso contenuto): riaggancio e lampeggio comunque al frame successivo.
  useEffect(() => { if (!root) return; const id = requestAnimationFrame(() => { gestureRef.current?.refresh(); flashRef.current() }); return () => cancelAnimationFrame(id) }, [doc, state.tick])

  // Riquadro e matita: seguono l'elemento. Niente ciclo a ogni frame: si ricalcola (un solo rAF alla volta) solo su scroll,
  // resize, cambi di dimensione (ResizeObserver), mutazioni del DOM e fine delle transizioni di pagina.
  useEffect(() => {
    const frameEl = frameRef.current, pencil = pencilRef.current
    if (!root || !frameEl || !pencil) return
    if (!selection || mode) { frameEl.classList.add('tako-edit-hidden'); pencil.classList.add('tako-edit-hidden'); return }
    let raf = 0, last = '', observed: HTMLElement | null = null
    const target = () => { for (const sel of frameSelectors(selection)) for (const el of Array.from(root.querySelectorAll<HTMLElement>(sel))) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return { el, r } } return null }
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null
    const update = () => {
      raf = 0
      if (document.hidden) return
      const t = target()
      if (t?.el !== observed) { if (observed) resize?.unobserve(observed); observed = t?.el || null; if (observed) resize?.observe(observed) }
      if (!t) { frameEl.classList.add('tako-edit-hidden'); pencil.classList.add('tako-edit-hidden'); last = ''; return }
      const pad = 4, { r } = t, key = `${r.left}|${r.top}|${r.width}|${r.height}`
      if (key === last) return
      // Si è mosso: si segue anche al frame dopo (animazioni WAAPI senza eventi) finché resta fermo.
      const moved = last !== ''; last = key; if (moved) schedule()
      const radius = parseFloat(getComputedStyle(t.el).borderTopLeftRadius) || 10
      frameEl.style.transform = `translate3d(${r.left - pad}px,${r.top - pad}px,0)`; frameEl.style.width = r.width + pad * 2 + 'px'; frameEl.style.height = r.height + pad * 2 + 'px'; frameEl.style.borderRadius = Math.min(radius + pad, 999) + 'px'
      frameEl.classList.remove('tako-edit-hidden'); pencil.classList.remove('tako-edit-hidden')
      const pw = pencil.offsetWidth || 44, ph = pencil.offsetHeight || 32
      const x = Math.max(4, Math.min(innerWidth - pw - 4, r.right + pad - pw + 6)), y = Math.max(4, r.top - pad - ph / 2)
      pencil.style.transform = `translate3d(${x}px,${y}px,0)`
      const name = (t.el.querySelector('h3')?.textContent || t.el.textContent || '').trim().slice(0, 60)
      pencil.setAttribute('aria-label', pencilLabel(selection.kind, name, t.el.getAttribute('data-edit-kind') === 'section' || !!t.el.closest('[data-edit-kind="section"]')))
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(update) }
    const mutations = new MutationObserver(schedule)
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] })
    resize?.observe(root)
    const events = ['transitionend', 'transitioncancel', 'animationend'] as const
    addEventListener('scroll', schedule, { capture: true, passive: true }); addEventListener('resize', schedule)
    for (const e of events) root.addEventListener(e, schedule)
    document.addEventListener('visibilitychange', schedule)
    update()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      mutations.disconnect(); resize?.disconnect()
      removeEventListener('scroll', schedule, { capture: true }); removeEventListener('resize', schedule)
      for (const e of events) root.removeEventListener(e, schedule)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [root, selection, mode])

  return <>
    <div ref={frameRef} aria-hidden className="tako-edit-frame tako-edit-hidden" data-edit-frame/>
    <button ref={pencilRef} type="button" className="tako-edit-pencil tako-edit-hidden" data-edit-pencil aria-label="Modifica" onClick={() => { if (selRef.current) post(outgoing.open(selRef.current)) }}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="2"/></svg>
      <span>Modifica</span>
    </button>
  </>
}
