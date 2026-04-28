'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sala: 'Sala',
  tavoli: 'Gestione Tavoli',
  ordini: 'Ordini',
  kds: 'Cucina',
  cassa: 'Cassa',
  menu: 'Menu',
  statistiche: 'Statistiche',
  inventario: 'Inventario',
  staff: 'Staff',
  impostazioni: 'Impostazioni',
  onboarding: 'Onboarding',
}

export function Breadcrumb() {
  const pathname = usePathname()

  // Split path into segments, filter empty strings
  const segments = pathname.split('/').filter(Boolean)

  // Build crumbs: each crumb has a label and a full href up to that segment
  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm font-body">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={14} className="text-ink/30 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-black text-ink">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-ink/50 hover:text-coral transition-colors font-semibold"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
