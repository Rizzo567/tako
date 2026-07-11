'use client'
import { useEffect, useRef, useState } from 'react'
import type { Transition } from 'framer-motion'

// Curve di riferimento dal design handoff, rispecchiate in JS per Framer Motion.
export const SPRING: Transition = { type: 'spring', stiffness: 480, damping: 24 }
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 380, damping: 30 }
export const SPRING_SHEET: Transition = { type: 'spring', stiffness: 380, damping: 34 }
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
export const PRESS = { scale: 0.94 }
export const PRESS_SM = { scale: 0.97 }

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Burst di coriandoli a tutto schermo (WAAPI, si autodistrugge). Usato alla
 * conferma dell'ordine. No-op in reduced-motion.
 */
export function confettiBurst(x?: number, y?: number, n = 26) {
  if (typeof document === 'undefined' || prefersReducedMotion() || !document.body.animate) return
  const cols = ['#ED7159', '#F4B860', '#4FA882', '#D9533A', '#FCE7DF', '#E0A23C']
  const cx = x ?? window.innerWidth / 2
  const cy = y ?? window.innerHeight * 0.62
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div')
    const w = 6 + Math.random() * 5, h = 9 + Math.random() * 6
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${w}px;height:${h}px;border-radius:2px;background:${cols[i % cols.length]};z-index:9999;pointer-events:none;`
    document.body.appendChild(p)
    const ang = Math.random() * Math.PI * 2, v = 90 + Math.random() * 170
    const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v - 130 - Math.random() * 90
    const rot = Math.random() * 720 - 360
    const an = p.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rot * 0.5}deg) scale(1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.25}px,${dy + 260 + Math.random() * 120}px) rotate(${rot}deg) scale(.85)`, opacity: 0 },
    ], { duration: 1050 + Math.random() * 500, easing: 'cubic-bezier(.22,.9,.35,1)', fill: 'forwards' })
    an.onfinish = () => p.remove()
  }
}

/**
 * Count-up animato di un valore numerico (totali carrello/tracking).
 * Rispetta prefers-reduced-motion (salta direttamente al valore finale).
 */
export function useCountUp(value: number, dur = 520): number {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      fromRef.current = value
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const to = value
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(from + (to - from) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, dur])

  return display
}

/**
 * Pallina che vola in arco dalla foto del piatto all'icona carrello, poi
 * il carrello rimbalza. Web Animations API: leggera, fuori dal React tree.
 * No-op (solo bounce) in reduced-motion.
 */
export function flyToCart(originEl: HTMLElement | null, color?: string) {
  const cart = document.querySelector<HTMLElement>('[data-cart-anchor]')
  const bounce = () => {
    if (cart?.animate) {
      cart.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.32) rotate(-6deg)' }, { transform: 'scale(1)' }],
        { duration: 460, easing: 'cubic-bezier(.34,1.56,.64,1)' },
      )
    }
  }
  if (!originEl || !cart || prefersReducedMotion() || !document.body.animate) {
    setTimeout(bounce, 120)
    return
  }
  const a = originEl.getBoundingClientRect()
  const b = cart.getBoundingClientRect()
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2
  const ex = b.left + b.width / 2, ey = b.top + b.height / 2
  const dot = document.createElement('div')
  Object.assign(dot.style, {
    position: 'fixed', left: `${sx - 16}px`, top: `${sy - 16}px`,
    width: '32px', height: '32px', borderRadius: '999px',
    background: color || 'var(--brand)', zIndex: '99999', pointerEvents: 'none',
    boxShadow: '0 8px 20px rgba(42,31,26,.35)',
  } as CSSStyleDeclaration)
  document.body.appendChild(dot)
  const mx = (sx + ex) / 2 + 30, my = Math.min(sy, ey) - 90
  const an = dot.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
    { transform: `translate(${mx - sx}px,${my - sy}px) scale(1.15)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${ex - sx}px,${ey - sy}px) scale(.18)`, opacity: 0.35, offset: 1 },
  ], { duration: 640, easing: 'cubic-bezier(.5,0,.35,1)' })
  an.onfinish = () => { dot.remove(); bounce() }
}
