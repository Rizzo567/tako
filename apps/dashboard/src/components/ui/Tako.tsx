'use client'
import type { CSSProperties } from 'react'
import { useBrandStore } from '@/lib/brand-store'

// Alias semantico → filename reale (i nomi file del bundle sono mescolati).
export const TAKO_POSE: Record<string, string> = {
  hello: 'logo',          // strizza l'occhio — saluto / hero
  neutral: 'elegante',    // sorriso neutro — generico / vuoto
  chef: 'neutro',         // cappello + spatola — cucina
  phone: 'piatto',        // tiene telefono — ordini / comanda / qr
  serve: 'pasta',         // vassoio con cloche — sala / servizio
  dish: 'telefono',       // piatto fumante — menu
  dishAlt: 'cassa',       // piatto (alt) — inventario
  pay: 'pollice_in_su',   // scontrino + monete — cassa / stats
  bowtie: 'mangia',       // papillon — impostazioni
}

export type TakoPose = keyof typeof TAKO_POSE | 'logoMark'

export function Tako({ pose = 'neutral', size = 120, float = false, flip = false, style, alt = 'Tako' }: {
  pose?: TakoPose | string; size?: number; float?: boolean; flip?: boolean; style?: CSSProperties; alt?: string
}) {
  const brand = useBrandStore((s) => s.brand)
  let file = TAKO_POSE[pose] ?? pose
  if (pose === 'logoMark') file = brand === 'arancione' ? 'logo-chef' : 'neutro'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/takos/${brand}/${file}.png`}
      alt={alt}
      draggable={false}
      className={float ? 'tako-float' : undefined}
      style={{
        width: size, height: size, objectFit: 'contain', flex: 'none', userSelect: 'none',
        filter: 'drop-shadow(0 12px 18px rgba(42,31,26,.16))',
        transform: flip ? 'scaleX(-1)' : 'none', ...style,
      }}
    />
  )
}
