'use client'
import { useEffect, useState } from 'react'
import { Icon, type IconName } from './icon'

// Toast del design Tako. Su desktop: card scura in basso a destra con barra di
// avanzamento. Su mobile: pillola in alto al centro. API: toast('Salvato', {type:'success'}).
type ToastType = 'default' | 'success' | 'error' | 'warn' | 'info'
interface ToastItem { id: number; msg: string; type: ToastType; icon?: IconName; sub?: string; dur: number }

const store = { list: [] as ToastItem[], subs: new Set<() => void>(), id: 0 }
function emit() { store.subs.forEach((f) => f()) }

export function toast(msg: string, opts: { type?: ToastType; icon?: IconName; sub?: string; duration?: number } = {}) {
  const id = ++store.id
  const dur = opts.duration ?? 3600
  store.list = [...store.list, { id, msg, type: opts.type ?? 'default', icon: opts.icon, sub: opts.sub, dur }]
  emit()
  setTimeout(() => { store.list = store.list.filter((t) => t.id !== id); emit() }, dur)
}

function color(type: ToastType) {
  return type === 'success' ? 'var(--ok)' : type === 'error' ? 'var(--danger)' : type === 'warn' ? 'var(--wait)' : 'var(--brand)'
}
function fallbackIcon(type: ToastType): IconName {
  return type === 'success' ? 'check' : type === 'error' ? 'alert' : 'bell'
}

export function Toaster({ mobile = false }: { mobile?: boolean }) {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force((x) => x + 1); store.subs.add(f); return () => { store.subs.delete(f) } }, [])
  const dismiss = (id: number) => { store.list = store.list.filter((t) => t.id !== id); emit() }

  if (!mobile) {
    return (
      <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, pointerEvents: 'none' }}>
        {store.list.map((t) => {
          const c = color(t.type); const ic = t.icon ?? fallbackIcon(t.type)
          return (
            <div key={t.id} className="ds-toast-in" onClick={() => dismiss(t.id)}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13, width: 340, padding: '14px 16px 14px 14px', borderRadius: 16, background: 'var(--nav)', color: '#fff', boxShadow: '0 18px 44px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.07)', overflow: 'hidden', pointerEvents: 'auto', cursor: 'pointer', animation: 'ds-toast-in .4s var(--spring) both' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: c }} />
              <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: c, color: '#fff', boxShadow: `0 6px 16px -5px ${c}`, animation: 'ds-toast-icon .5s var(--spring) both' }}><Icon name={ic} size={21} stroke={2.4} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, fontFamily: 'var(--f-display)' }}>{t.msg}</div>
                {t.sub && <div style={{ fontSize: 12.5, color: 'var(--nav-ink-2)', marginTop: 1 }}>{t.sub}</div>}
              </div>
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: c, opacity: 0.5, transformOrigin: 'left', animation: `ds-prog ${t.dur}ms linear forwards` }} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', top: 14, left: 0, right: 0, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none', padding: '0 16px' }}>
      {store.list.map((t) => {
        const c = color(t.type); const ic = t.icon ?? fallbackIcon(t.type)
        return (
          <div key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, maxWidth: 420, padding: '11px 16px 11px 12px', borderRadius: 14, background: 'var(--ink)', color: 'var(--surface)', boxShadow: 'var(--sh-3)', animation: 'rise-fade .3s var(--out) both' }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: c, color: '#fff', flex: 'none' }}><Icon name={ic} size={15} stroke={2.6} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t.msg}</div>
              {t.sub && <div style={{ fontSize: 12.5, color: 'var(--nav-ink-2)' }}>{t.sub}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
