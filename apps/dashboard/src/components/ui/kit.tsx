'use client'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './icon'
import { Tako, type TakoPose } from './Tako'

/* ───────────────── Card ───────────────── */
export function Card({ children, pad = 18, style, className = '', ...rest }: {
  children?: ReactNode; pad?: number; style?: CSSProperties; className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} style={{ background: 'var(--raised)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)', border: '1px solid var(--hairline)', padding: pad, ...style }} {...rest}>
      {children}
    </div>
  )
}

/* ───────────────── Button ───────────────── */
type BtnKind = 'brand' | 'dark' | 'soft' | 'ghost' | 'danger' | 'ok'
type BtnSize = 'sm' | 'md' | 'lg'
export function Button({ children, onClick, kind = 'brand', size = 'md', icon, full, disabled, type = 'button', style }: {
  children?: ReactNode; onClick?: () => void; kind?: BtnKind; size?: BtnSize; icon?: IconName
  full?: boolean; disabled?: boolean; type?: 'button' | 'submit'; style?: CSSProperties
}) {
  const sizes = { sm: { h: 36, px: 13, fs: 13.5 }, md: { h: 44, px: 18, fs: 15 }, lg: { h: 52, px: 24, fs: 16.5 } }[size]
  const kinds: Record<BtnKind, CSSProperties> = {
    brand: { background: disabled ? 'var(--ink-3)' : 'var(--brand)', color: 'var(--on-brand)', boxShadow: disabled ? 'none' : '0 6px 16px -6px var(--brand)' },
    dark: { background: 'var(--ink)', color: 'var(--surface)' },
    soft: { background: 'var(--sunken)', color: 'var(--ink)' },
    ghost: { background: 'transparent', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)' },
    danger: { background: 'var(--danger-bg)', color: 'var(--danger)' },
    ok: { background: 'var(--ok)', color: '#fff' },
  }
  return (
    <button type={type} className="press" onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: full ? '100%' : 'auto',
        height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: 'var(--r-md)', fontSize: sizes.fs, fontWeight: 700,
        fontFamily: 'var(--f-ui)', opacity: disabled ? 0.6 : 1, transition: 'filter .15s', ...kinds[kind], ...style }}>
      {icon && <Icon name={icon} size={sizes.fs + 4} />}{children}
    </button>
  )
}

type IconBtnTone = 'soft' | 'ghost' | 'brand' | 'raised'
export function IconBtn({ name, onClick, size = 40, iconSize = 20, tone = 'soft', style, label }: {
  name: IconName; onClick?: () => void; size?: number; iconSize?: number; tone?: IconBtnTone; style?: CSSProperties; label?: string
}) {
  const tones: Record<IconBtnTone, CSSProperties> = {
    soft: { background: 'var(--sunken)', color: 'var(--ink)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)' },
    brand: { background: 'var(--brand)', color: 'var(--on-brand)' },
    raised: { background: 'var(--raised)', color: 'var(--ink)', boxShadow: 'var(--sh-1)' },
  }
  return (
    <button aria-label={label || name} className="press" onClick={onClick}
      style={{ width: size, height: size, borderRadius: 'var(--r-md)', display: 'grid', placeItems: 'center', ...tones[tone], ...style }}>
      <Icon name={name} size={iconSize} />
    </button>
  )
}

/* ───────────────── Badge ───────────────── */
export type Tone = 'ok' | 'okDeep' | 'wait' | 'info' | 'brand' | 'danger' | 'muted'
export const TONE: Record<Tone, [string, string]> = {
  ok: ['var(--ok-bg)', 'var(--ok-deep)'], okDeep: ['var(--ok)', '#fff'], wait: ['var(--wait-bg)', '#9A6912'],
  info: ['var(--info-bg)', '#3A6587'], brand: ['var(--brand-tint)', 'var(--brand-deep)'], danger: ['var(--danger-bg)', 'var(--danger)'],
  muted: ['var(--muted-bg)', 'var(--ink-2)'],
}
export function Badge({ children, tone = 'muted', dot, solid, style }: {
  children?: ReactNode; tone?: Tone; dot?: boolean; solid?: boolean; style?: CSSProperties
}) {
  const [bg, fg] = TONE[tone] ?? TONE.muted
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)',
      fontSize: 12.5, fontWeight: 700, background: solid ? fg : bg, color: solid ? '#fff' : fg, whiteSpace: 'nowrap', ...style }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: solid ? '#fff' : fg }} />}{children}
    </span>
  )
}

/* ───────────────── KPI ───────────────── */
export function Kpi({ label, value, sub, icon, accent = 'var(--brand)', trend }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: IconName; accent?: string; trend?: 'up' | 'down'
}) {
  return (
    <Card pad={18} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${accent}1f`, color: accent }}><Icon name={icon} size={18} /></span>
      </div>
      <div className="num" style={{ fontSize: 30, lineHeight: 1, color: 'var(--ink)' }}>{value}</div>
      {sub && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: trend === 'up' ? 'var(--ok-deep)' : trend === 'down' ? 'var(--danger)' : 'var(--ink-3)' }}>{sub}</div>}
    </Card>
  )
}

export function Progress({ value, color = 'var(--brand)', h = 8 }: { value: number; color?: string; h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 99, background: 'var(--sunken)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .6s var(--out)' }} />
    </div>
  )
}

/* ───────────────── BarChart ───────────────── */
export function BarChart({ data, color = 'var(--brand)', h = 120, fmt = (v: number) => String(v), labelKey = 'g', valKey = 'v' }: {
  data: Array<Record<string, any>>; color?: string; h?: number; fmt?: (v: number) => string; labelKey?: string; valKey?: string
}) {
  const max = Math.max(...data.map((d) => Number(d[valKey]))) || 1
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: h }}>
      {data.map((d, i) => {
        const pct = (Number(d[valKey]) / max) * 100
        const last = i === data.length - 1
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', fontFamily: 'var(--f-mono)' }}>{fmt(Number(d[valKey]))}</div>
            <div title={fmt(Number(d[valKey]))} style={{ width: '100%', maxWidth: 38, height: mounted ? `calc(${pct}% - 24px)` : 0, minHeight: 4, borderRadius: '8px 8px 4px 4px', background: last ? color : `${color}55`, transition: `height .7s var(--out) ${i * 0.05}s` }} />
            <div style={{ fontSize: 11.5, fontWeight: 600, color: last ? 'var(--ink)' : 'var(--ink-3)' }}>{String(d[labelKey])}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────── Empty ───────────────── */
export function Empty({ icon = 'sparkles', title, sub, action, tako }: {
  icon?: IconName; title: string; sub?: string; action?: ReactNode; tako?: TakoPose
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 24px', textAlign: 'center' }}>
      {tako
        ? <Tako pose={tako} size={130} />
        : <span style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand)' }}><Icon name={icon} size={26} /></span>}
      <div style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 18 }}>{title}</div>
      {sub && <div style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 320 }}>{sub}</div>}
      {action}
    </div>
  )
}

/* ───────────────── Search ───────────────── */
export function Search({ value, onChange, placeholder = 'Cerca…', style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 14px', background: 'var(--raised)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', color: 'var(--ink-3)', ...style }}>
      <Icon name="search" size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--f-ui)', fontSize: 14.5, color: 'var(--ink)' }} />
    </div>
  )
}

/* ───────────────── Avatar ───────────────── */
export function Avatar({ initials, color = 'var(--brand)', size = 38 }: { initials: string; color?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: color, color: '#fff', fontWeight: 800, fontSize: size * 0.38, fontFamily: 'var(--f-display)' }}>{initials}</span>
  )
}

/* ───────────────── Overlay (modal/drawer) ───────────────── */
export function useMountTransition(open: boolean, dur = 320) {
  const [mounted, setMounted] = useState(open)
  const [active, setActive] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (open) { setMounted(true); t = setTimeout(() => setActive(true), 20) }
    else { setActive(false); t = setTimeout(() => setMounted(false), dur) }
    return () => clearTimeout(t)
  }, [open, dur])
  return { mounted, active }
}

export function Overlay({ open, onClose, children, anchor = 'center' }: {
  open: boolean; onClose: () => void; children: ReactNode; anchor?: 'center' | 'right' | 'bottom'
}) {
  const { mounted, active } = useMountTransition(open, 320)
  if (!mounted || typeof document === 'undefined') return null
  const pos = {
    center: { alignItems: 'center', justifyContent: 'center' },
    right: { alignItems: 'stretch', justifyContent: 'flex-end' },
    bottom: { alignItems: 'flex-end', justifyContent: 'stretch' },
  }[anchor] as CSSProperties
  const enter = {
    center: active ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.97)',
    right: active ? 'translateX(0)' : 'translateX(100%)',
    bottom: active ? 'translateY(0)' : 'translateY(100%)',
  }[anchor]
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', ...pos }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,16,.45)', opacity: active ? 1 : 0, transition: 'opacity .3s', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', transform: enter, transition: 'transform .34s var(--spring)', maxHeight: '100%', display: 'flex' }}>{children}</div>
    </div>,
    document.body,
  )
}

/* ───────────────── Confirm ───────────────── */
export function Confirm({ open, onClose, onConfirm, title, body, danger, confirmLabel = 'Conferma' }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: ReactNode; danger?: boolean; confirmLabel?: string
}) {
  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 380, maxWidth: 'calc(100vw - 40px)', background: 'var(--raised)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-pop)', padding: 24, margin: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', background: danger ? 'var(--danger-bg)' : 'var(--brand-tint)', color: danger ? 'var(--danger)' : 'var(--brand)', marginBottom: 14 }}>
          <Icon name={danger ? 'alert' : 'bell'} size={24} />
        </div>
        <h3 style={{ fontSize: 19 }}>{title}</h3>
        {body && <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '8px 0 20px' }}>{body}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: body ? 0 : 16 }}>
          <Button kind="soft" full onClick={onClose}>Annulla</Button>
          <Button kind={danger ? 'danger' : 'brand'} full onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ───────────────── PageHead ───────────────── */
export function PageHead({ title, sub, actions, tako, mobile }: {
  title: string; sub?: string; actions?: ReactNode; tako?: TakoPose; mobile?: boolean
}) {
  if (mobile) {
    return actions ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>{actions}</div> : null
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        {tako && <Tako pose={tako} size={62} />}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>{title}</h1>
          {sub && <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>{sub}</p>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}
