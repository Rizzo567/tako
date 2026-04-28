'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, Grid3X3, ShoppingCart, Receipt,
  ChefHat, BarChart3, Package, Users, Settings, LogOut,
  ChevronDown, ChevronUp, Menu, X,
} from 'lucide-react'
import { createContext, useContext, useState, ReactNode } from 'react'
import { useAuthStore } from '@/lib/store'
import { useOrdersStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ─── Mobile menu context ──────────────────────────────────────────────────────

interface MobileMenuCtx {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const MobileMenuContext = createContext<MobileMenuCtx>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const toggle = () => setIsOpen((v) => !v)
  const close = () => setIsOpen(false)
  return (
    <MobileMenuContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </MobileMenuContext.Provider>
  )
}

export function useMobileMenu() {
  return useContext(MobileMenuContext)
}

// ─── Hamburger button ─────────────────────────────────────────────────────────

export function MobileMenuButton() {
  const { isOpen, toggle } = useMobileMenu()
  return (
    <button
      onClick={toggle}
      aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
      className="md:hidden p-2 rounded-lg text-ink hover:bg-ink/10 transition-colors"
    >
      {isOpen ? <X size={22} /> : <Menu size={22} />}
    </button>
  )
}

// ─── Top-level nav links (excluding Sala, handled separately) ─────────────────

const topLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
]

const bottomLinks = [
  { href: '/dashboard/ordini', label: 'Ordini', icon: ShoppingCart, badge: true },
  { href: '/dashboard/kds', label: 'Cucina (KDS)', icon: ChefHat },
  { href: '/dashboard/cassa', label: 'Cassa', icon: Receipt },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/dashboard/statistiche', label: 'Statistiche', icon: BarChart3 },
  { href: '/dashboard/inventario', label: 'Inventario', icon: Package },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
  { href: '/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
]

const salaSubLinks = [
  { href: '/dashboard/sala', label: 'Sala Live', exact: true },
  { href: '/dashboard/sala/tavoli', label: 'Gestione Tavoli' },
]

// ─── Sidebar inner content ────────────────────────────────────────────────────

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, restaurant, clearAuth } = useAuthStore()
  const pendingCount = useOrdersStore((s) => s.pendingCount)

  const salaActive = pathname.startsWith('/dashboard/sala')
  const [salaOpen, setSalaOpen] = useState(salaActive)

  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-2xl text-cream">Tako</span>
          <span className="text-xs bg-coral px-2 py-0.5 rounded-full text-white font-black">PRO</span>
        </div>
        <p className="text-xs text-cream/60 font-semibold mt-1 truncate">{restaurant?.name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Top links */}
        {topLinks.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn('sidebar-link', active ? 'active' : 'text-cream/70')}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* Sala collapsible section */}
        <div>
          <button
            onClick={() => setSalaOpen((v) => !v)}
            className={cn(
              'sidebar-link w-full',
              salaActive ? 'active' : 'text-cream/70',
            )}
          >
            <Grid3X3 size={18} />
            <span>Sala</span>
            <span className="ml-auto">
              {salaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {salaOpen && (
            <div className="mt-1 space-y-1">
              {salaSubLinks.map(({ href, label, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      'sidebar-link pl-8 text-sm',
                      active ? 'active' : 'text-cream/60',
                    )}
                  >
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom links */}
        {bottomLinks.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn('sidebar-link', active ? 'active' : 'text-cream/70')}
            >
              <Icon size={18} />
              <span>{label}</span>
              {badge && pendingCount > 0 && (
                <span className="ml-auto bg-coral text-white text-xs font-black px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-coral grid place-items-center text-white font-black text-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-cream text-sm font-black truncate">{user?.name}</p>
            <p className="text-cream/50 text-xs font-semibold capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={clearAuth}
          className="flex items-center gap-2 text-cream/60 hover:text-coral transition-colors text-sm font-bold"
        >
          <LogOut size={14} /> Esci
        </button>
      </div>
    </>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { isOpen, close } = useMobileMenu()

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'w-64 min-h-screen bg-ink flex flex-col fixed left-0 top-0 z-40 transition-transform duration-300',
          // Mobile: hidden by default, slide in when open
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <SidebarContent onNavigate={close} />
      </aside>
    </>
  )
}
