// Guscio dell'app: header flottante + barra inferiore.
//
// È la copia mobile della shell della staff (public/staff/src/03-shell-nav.js), con
// due differenze deliberate: NESSUN ramo desktop (questa app vive sul telefono) e
// nessun drawer con l'albero completo delle 14 voci — sul telefono ne vivono 5.
//
// La barra "vetro" e il compact-on-scroll sono presi 1:1 dalla staff perché sono la
// firma dell'interfaccia: chi ha già visto la dashboard deve riconoscerla al volo.
import type { ReactNode } from 'react'
import { Icon } from './icons'

export type SectionId = 'sala' | 'ordini' | 'cassa' | 'oggi' | 'altro'

export interface SectionDef {
  id: SectionId
  label: string
  icon: string
}

// Cinque sezioni, l'ordine è quello del piano (§5 F2.2): Sala · Ordini · Cassa · Oggi · Altro.
export const SECTIONS: SectionDef[] = [
  { id: 'sala', label: 'Sala', icon: 'map' },
  { id: 'ordini', label: 'Ordini', icon: 'orders' },
  { id: 'cassa', label: 'Cassa', icon: 'cassa' },
  { id: 'oggi', label: 'Oggi', icon: 'stats' },
  { id: 'altro', label: 'Altro', icon: 'apps' },
]

export type NetKind = 'lan' | 'remote' | 'offline' | 'checking'

// I tre stati di D4, mai ambigui: verde in sala, giallo da remoto, rosso irraggiungibile.
const NET_LABEL: Record<NetKind, string> = {
  checking: 'Verifico…',
  lan: 'In sala',
  remote: 'Da remoto',
  offline: 'Non raggiungibile',
}

export function NetBadge({ kind, onClick }: { kind: NetKind; onClick?: () => void }) {
  return (
    <button type="button" className="press ow-net" data-net={kind} onClick={onClick}>
      <span className="ow-dot" />
      {NET_LABEL[kind]}
    </button>
  )
}

export function Header({ title, net, onNetClick, right }: {
  title: string
  net: NetKind
  onNetClick?: () => void
  right?: ReactNode
}) {
  return (
    <header className="ow-header">
      <div className="ow-header-row">
        <h1>{title}</h1>
        <div className="ow-header-right">
          {right}
          <NetBadge kind={net} onClick={onNetClick} />
        </div>
      </div>
    </header>
  )
}

export function BottomBar({ active, onGo, badges, compact }: {
  active: SectionId
  onGo: (id: SectionId) => void
  badges?: Partial<Record<SectionId, number>>
  compact: boolean
}) {
  return (
    <nav className="ow-bb" data-compact={compact ? '1' : '0'} aria-label="Sezioni">
      {SECTIONS.map((s) => {
        const on = s.id === active
        const n = badges?.[s.id] ?? 0
        return (
          <button
            key={s.id}
            type="button"
            className="press ow-bb-tab"
            data-on={on ? '1' : '0'}
            onClick={() => onGo(s.id)}
            aria-current={on ? 'page' : undefined}
          >
            <span className="ow-bb-ico">
              <Icon name={s.icon} size={compact ? 25 : 22} stroke={on ? 2.5 : 2} />
              {n > 0 && <span className="ow-bb-badge">{n > 99 ? '99+' : n}</span>}
            </span>
            <span className="ow-bb-label">{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
