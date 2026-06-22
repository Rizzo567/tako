'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE_OUT } from '@/lib/motion'
import { Bubbles } from '@/components/ui/Bubbles'

// QR finto decorativo (21×21, 3 finder pattern + moduli pseudo-casuali deterministici).
function FauxQR() {
  const N = 21
  const cells: number[] = []
  const eye = (x: number, y: number): number => {
    for (const [ox, oy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      const dx = x - ox, dy = y - oy
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return ring || core ? 1 : 0
      }
    }
    return -1
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const e = eye(x, y)
      cells.push(e >= 0 ? e : (((x * 31 + y * 17 + x * y * 7) % 3 === 0) ? 1 : 0))
    }
  }
  return (
    <div
      className="grid"
      style={{
        width: 134, height: 134, background: '#fff', borderRadius: 18, padding: 12,
        boxShadow: 'var(--sh-2)', gridTemplateColumns: `repeat(${N},1fr)`, gap: 0,
      }}
    >
      {cells.map((v, i) => (
        <span key={i} style={{ background: v ? 'var(--ink)' : 'transparent', borderRadius: 1 }} />
      ))}
    </div>
  )
}

export default function Splash() {
  const reduce = useReducedMotion()
  // rise-fade staggerato sui blocchi (delay handoff: .15 / .28 / .42 / .54)
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE_OUT, delay },
        }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-8 text-center"
      style={{ paddingBottom: 'calc(var(--safe-b) + 30px)' }}>
      <Bubbles count={11} />

      {/* mascotte + pulse rings */}
      <motion.div
        className="relative grid place-items-center"
        style={{ width: 200, height: 190, zIndex: 1 }}
        initial={reduce ? undefined : { scale: 0.5, opacity: 0 }}
        animate={reduce ? undefined : { scale: [0.5, 1.08, 1], opacity: 1 }}
        transition={reduce ? undefined : { duration: 0.8, ease: EASE_OUT }}
      >
        {!reduce && [0, 1].map(i => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              inset: '28% 18%', background: 'var(--brand-tint)',
              animation: `pulse-ring 3s ${i * 1.5}s ease-out infinite`,
            }}
          />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascotte/tako-hello.png"
          alt="Tako"
          className="anim-bob relative w-[200px]"
          style={{ filter: 'drop-shadow(0 22px 34px rgba(217,83,58,.28))' }}
        />
      </motion.div>

      <motion.h1 className="serif mt-1.5 leading-none tracking-tight text-[var(--ink)]"
        style={{ fontSize: 58, zIndex: 1 }} {...rise(0.15)}>
        Tako
      </motion.h1>

      <motion.p className="mt-3.5 max-w-[280px] text-[16.5px] leading-relaxed text-[var(--ink-2)]"
        style={{ zIndex: 1 }} {...rise(0.28)}>
        Scansiona il <b className="text-[var(--ink)]">QR sul tuo tavolo</b> per sfogliare il menù e ordinare.
        Niente app da scaricare.
      </motion.p>

      <motion.div className="mt-8" style={{ zIndex: 1 }} {...rise(0.42)}>
        <FauxQR />
      </motion.div>

      <motion.p className="mt-6 text-[12.5px] text-[var(--ink-3)]" style={{ zIndex: 1 }} {...rise(0.54)}>
        Tako · sistema operativo del ristorante
      </motion.p>
    </div>
  )
}
