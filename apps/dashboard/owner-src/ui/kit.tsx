// Primitivi UI — le stesse forme della dashboard staff (public/staff/src/02-kit.js),
// riscritte in TypeScript e con le sole varianti che servono sul telefono.
//
// Le tre regole che rendono una schermata "Tako" e che qui non si negoziano:
//   1. ogni card ha SIA il bordo hairline SIA l'ombra bassa (--sh-1): la profondità
//      viene dal bordo, non dal blur;
//   2. i numeri passano tutti dalla classe .num (Nunito 900, tabular-nums);
//   3. tutto ciò che si tocca ha .press (scale .95 con la curva --spring).
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './icons'

export type Tone = 'ok' | 'wait' | 'info' | 'brand' | 'danger' | 'muted'

const TONE: Record<Tone, [string, string]> = {
  ok: ['var(--ok-bg)', 'var(--ok-deep)'],
  wait: ['var(--wait-bg)', '#9A6912'],
  info: ['var(--info-bg)', '#3A6587'],
  brand: ['var(--brand-tint)', 'var(--brand-deep)'],
  danger: ['var(--danger-bg)', 'var(--danger)'],
  muted: ['var(--muted-bg)', 'var(--ink-2)'],
}

export function Card({ children, pad = 16, style, onClick, className = '' }: {
  children: ReactNode
  pad?: number
  style?: CSSProperties
  onClick?: () => void
  className?: string
}) {
  const cls = `ow-card ${onClick ? 'press' : ''} ${className}`.trim()
  return (
    <div className={cls} style={{ padding: pad, ...style }} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  )
}

export function Btn({ children, onClick, kind = 'brand', size = 'md', icon, full, disabled, style }: {
  children?: ReactNode
  onClick?: () => void
  kind?: 'brand' | 'soft' | 'ghost' | 'dark' | 'danger' | 'ok'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  full?: boolean
  disabled?: boolean
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      className={`press ow-btn ow-btn-${kind} ow-btn-${size}`}
      onClick={onClick}
      disabled={disabled}
      style={{ ...(full ? { width: '100%' } : null), ...style }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} stroke={2.2} />}
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'muted', dot, solid, style }: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  solid?: boolean
  style?: CSSProperties
}) {
  const [bg, fg] = TONE[tone]
  return (
    <span className="ow-badge-pill" style={{ background: solid ? fg : bg, color: solid ? '#fff' : fg, ...style }}>
      {dot && <span className="ow-dot" style={{ background: solid ? '#fff' : fg }} />}
      {children}
    </span>
  )
}

/** Numero grande + etichetta: il mattone della schermata "Oggi". */
export function StatTile({ label, value, sub, subTone, icon, accent = 'var(--brand)' }: {
  label: string
  value: string
  sub?: string
  subTone?: 'ok' | 'danger' | 'muted'
  icon?: string
  accent?: string
}) {
  return (
    <Card pad={14}>
      <div className="ow-stat-head">
        <span className="ow-stat-label">{label}</span>
        {icon && (
          <span className="ow-stat-ico" style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <div className="num ow-stat-value">{value}</div>
      {sub && <div className={`ow-stat-sub ow-sub-${subTone ?? 'muted'}`}>{sub}</div>}
    </Card>
  )
}

export function EmptyState({ icon = 'sparkles', title, sub, action }: {
  icon?: string
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <div className="ow-empty">
      <span className="ow-empty-ico"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
      {action}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="ow-section-title">
      <h2>{children}</h2>
      {right}
    </div>
  )
}

export function Spinner({ size = 22 }: { size?: number }) {
  return <span className="ow-spin" style={{ width: size, height: size }} />
}

/** Scheletro di caricamento: meglio di uno spinner quando la forma è già nota. */
export function Skeleton({ height = 64, style }: { height?: number; style?: CSSProperties }) {
  return <div className="ow-skel" style={{ height, ...style }} />
}

/** Foglio che sale dal basso: il dettaglio (tavolo, conto, ordine) senza cambiare schermata. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="ow-sheet-wrap" onClick={onClose}>
      <div className="ow-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="ow-sheet-grip" />
        <div className="ow-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="press ow-icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="ow-sheet-body">{children}</div>
        {footer && <div className="ow-sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** Euro formattati come nella dashboard: due decimali, separatore italiano. */
export function euro(n: number | null | undefined): string {
  const v = typeof n === 'number' && isFinite(n) ? n : 0
  return `€ ${v.toFixed(2).replace('.', ',')}`
}

/** "3′ fa" / "1h 12′ fa": la staff ragiona in minuti dal fatto, non in orari assoluti. */
export function since(iso: string | null | undefined): string {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'adesso'
  if (min < 60) return `${min}′ fa`
  return `${Math.floor(min / 60)}h ${min % 60}′ fa`
}

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return ''
  try { return new Date(iso).toTimeString().slice(0, 5) } catch { return '' }
}
