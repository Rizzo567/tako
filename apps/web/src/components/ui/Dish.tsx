'use client'
import { forwardRef } from 'react'

// Gradiente deterministico derivato dal nome del piatto: tile coerente quando
// manca la foto reale. In produzione la foto (imageUrl) ha sempre la precedenza.
export function dishGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  const h2 = (h + 36) % 360
  return `linear-gradient(135deg, hsl(${h} 52% 72%), hsl(${h2} 48% 60%))`
}

function initial(name: string): string {
  const clean = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').trim()
  return (clean[0] || '·').toUpperCase()
}

interface DishProps {
  name: string
  imageUrl?: string
  size?: number
  radius?: number
  className?: string
}

/** Tile immagine piatto: foto reale se presente, altrimenti monogram su gradiente. */
export const Dish = forwardRef<HTMLDivElement, DishProps>(function Dish(
  { name, imageUrl, size = 86, radius = 14, className },
  ref,
) {
  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: size, height: size, borderRadius: radius, overflow: 'hidden',
        position: 'relative', flex: 'none', display: 'grid', placeItems: 'center',
        background: imageUrl ? 'var(--sunken)' : dishGradient(name),
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      ) : (
        <span className="serif" style={{ fontSize: size * 0.42, color: 'rgba(255,255,255,.92)', lineHeight: 1 }}>
          {initial(name)}
        </span>
      )}
    </div>
  )
})
