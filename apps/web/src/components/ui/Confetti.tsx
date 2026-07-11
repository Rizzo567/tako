'use client'
import { useReducedMotion } from 'framer-motion'

// Coriandoli inline (dentro una card: hero tracking, action card AI, conferma cameriere).
// Cadono dall'alto della card. Off in reduced-motion.
export function Confetti({ n = 14 }: { n?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  const cols = ['var(--brand)', 'var(--ok)', 'var(--warn)', 'var(--brand-deep)']
  return (
    <div aria-hidden style={{ position: 'absolute', top: 0, left: '50%', pointerEvents: 'none', zIndex: 5 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute', width: 7, height: 11, borderRadius: 2,
            background: cols[i % cols.length],
            left: `${Math.random() * 200 - 100}px`, top: -8,
            animation: `confetti-fall ${0.9 + Math.random() * 0.7}s ${Math.random() * 0.2}s var(--out) forwards`,
          }}
        />
      ))}
    </div>
  )
}
