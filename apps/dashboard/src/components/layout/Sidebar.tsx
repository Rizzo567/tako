'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UtensilsCrossed, Grid3X3, ShoppingCart, Receipt, ChefHat, BarChart3, Package, Users, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useOrdersStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/sala', label: 'Sala', icon: Grid3X3 },
  { href: '/dashboard/ordini', label: 'Ordini', icon: ShoppingCart, badge: true },
  { href: '/dashboard/kds', label: 'Cucina (KDS)', icon: ChefHat },
  { href: '/dashboard/cassa', label: 'Cassa', icon: Receipt },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/dashboard/statistiche', label: 'Statistiche', icon: BarChart3 },
  { href: '/dashboard/inventario', label: 'Inventario', icon: Package },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
  { href: '/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, restaurant, clearAuth } = useAuthStore()
  const pendingCount = useOrdersStore((s) => s.pendingCount)

  return (
    <aside className="w-64 min-h-screen bg-ink flex flex-col fixed left-0 top-0 z-40">
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
        {links.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn('sidebar-link', active ? 'active' : 'text-cream/70')}>
              <Icon size={18} />
              <span>{label}</span>
              {badge && pendingCount > 0 && (
                <span className="ml-auto bg-coral text-white text-xs font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
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
        <button onClick={clearAuth} className="flex items-center gap-2 text-cream/60 hover:text-coral transition-colors text-sm font-bold">
          <LogOut size={14} /> Esci
        </button>
      </div>
    </aside>
  )
}
