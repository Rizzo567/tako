'use client'
import { useReducedMotion } from 'framer-motion'

/** Bolle ambient decorative che salgono sul background (splash). Off in reduced-motion. */
export function Bubbles({ count = 11, color = 'var(--brand-tint)' }: { count?: number; color?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {Array.from({ length: count }).map((_, i) => {
        const s = 9 + ((i * 37) % 26)
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 53 + 7) % 96}%`,
              bottom: -34,
              width: s, height: s, borderRadius: '50%',
              background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.85), ${color})`,
              border: '1px solid rgba(255,255,255,.5)',
              animation: `bubble-rise ${9 + (i % 5) * 2.4}s ${(i % 6) * 1.1}s ease-in infinite`,
            }}
          />
        )
      })}
    </div>
  )
}
