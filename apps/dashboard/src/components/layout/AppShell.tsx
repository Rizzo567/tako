'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/icon'
import { Tako } from '@/components/ui/Tako'
import { Avatar, Badge, IconBtn, useMountTransition } from '@/components/ui/kit'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { useLiveNotif, useNotifications, setScrollDown, useScrollDown } from '@/lib/ui-bus'

/* ───────── nav config (id → route, icona, gruppo) ───────── */
type RoleKey = 'owner' | 'cameriere' | 'chef' | 'cassiere'
interface NavItem { id: string; label: string; icon: IconName; route: string; badge?: boolean }

const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Operatività', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', route: '/dashboard' },
    { id: 'ordini', label: 'Ordini', icon: 'orders', route: '/dashboard/ordini', badge: true },
    { id: 'kds', label: 'Cucina', icon: 'kitchen', route: '/dashboard/kds' },
    { id: 'cassa', label: 'Cassa', icon: 'cassa', route: '/dashboard/cassa' },
    { id: 'comanda', label: 'Comanda', icon: 'comanda', route: '/comanda' },
  ]},
  { group: 'Sala', items: [
    { id: 'sala', label: 'Sala Live', icon: 'map', route: '/dashboard/sala' },
    { id: 'tavoli', label: 'Gestione Tavoli', icon: 'table', route: '/dashboard/sala/tavoli' },
    { id: 'qr', label: 'QR Codes', icon: 'qr', route: '/dashboard/sala/qr' },
  ]},
  { group: 'Gestione', items: [
    { id: 'menu', label: 'Menu', icon: 'menu', route: '/dashboard/menu' },
    { id: 'inventario', label: 'Inventario', icon: 'inventory', route: '/dashboard/inventario' },
    { id: 'statistiche', label: 'Statistiche', icon: 'stats', route: '/dashboard/statistiche' },
    { id: 'insights', label: 'Analisi Menu', icon: 'insights', route: '/dashboard/insights' },
    { id: 'staff', label: 'Staff', icon: 'staff', route: '/dashboard/staff' },
  ]},
]
const ROLE_ACCESS: Record<RoleKey, string[] | null> = {
  owner: null,
  cameriere: ['dashboard', 'ordini', 'sala', 'tavoli', 'comanda', 'cassa', 'menu'],
  chef: ['dashboard', 'kds', 'ordini', 'menu', 'inventario'],
  cassiere: ['dashboard', 'cassa', 'ordini', 'sala'],
}
const MOBILE_PRIMARY: Record<RoleKey, string[]> = {
  owner: ['dashboard', 'ordini', 'sala', 'cassa'],
  cameriere: ['sala', 'ordini', 'comanda', 'cassa'],
  chef: ['kds', 'ordini', 'menu', 'inventario'],
  cassiere: ['cassa', 'ordini', 'sala', 'dashboard'],
}
const ROLE_LABEL: Record<string, string> = { owner: 'Titolare', dipendente: 'Cameriere', cameriere: 'Cameriere', chef: 'Chef', cassiere: 'Cassiere' }
const ALL_ITEMS = NAV.flatMap((g) => g.items)
const findItem = (id: string) => ALL_ITEMS.find((i) => i.id === id) ?? ALL_ITEMS[0]

function navAllowed(role: RoleKey) {
  const allow = ROLE_ACCESS[role]
  return NAV.map((g) => ({ ...g, items: g.items.filter((it) => !allow || allow.includes(it.id)) })).filter((g) => g.items.length)
}
function routeIntro(id: string, nome: string): { pose: string; title: string } {
  const m: Record<string, { pose: string; title: string }> = {
    dashboard: { pose: 'hello', title: `Ciao, ${nome.split(' ')[0] || ''}!` },
    ordini: { pose: 'phone', title: 'Ordini live' }, kds: { pose: 'chef', title: 'Cucina' },
    cassa: { pose: 'pay', title: 'Cassa' }, comanda: { pose: 'phone', title: 'Comanda' },
    sala: { pose: 'serve', title: 'Sala Live' }, tavoli: { pose: 'serve', title: 'Gestione Tavoli' },
    qr: { pose: 'phone', title: 'QR Codes' }, menu: { pose: 'dish', title: 'Menu' },
    inventario: { pose: 'dishAlt', title: 'Inventario' }, statistiche: { pose: 'pay', title: 'Statistiche' },
    insights: { pose: 'dishAlt', title: 'Analisi Menu' }, staff: { pose: 'hello', title: 'Staff' },
    impostazioni: { pose: 'bowtie', title: 'Impostazioni' },
  }
  return m[id] ?? { pose: 'neutral', title: findItem(id).label }
}
const initialsOf = (name?: string | null) => (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

function useActiveId() {
  const pathname = usePathname()
  // route più specifica che combacia
  const match = ALL_ITEMS
    .filter((i) => pathname === i.route || pathname.startsWith(i.route + '/'))
    .sort((a, b) => b.route.length - a.route.length)[0]
  if (pathname === '/dashboard') return 'dashboard'
  if (pathname.startsWith('/dashboard/impostazioni')) return 'impostazioni'
  return match?.id ?? 'dashboard'
}

async function doLogout(clear: () => void) {
  try { await api.post('/auth/logout') } catch { /* ignora */ }
  clear()
  window.location.href = '/login'
}

/* ───────── desktop sidebar ───────── */
function DesktopSidebar({ role, badge }: { role: RoleKey; badge: number }) {
  const router = useRouter()
  const active = useActiveId()
  const groups = navAllowed(role)
  const [userOpen, setUserOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleGroup = (g: string) => setCollapsed((c) => ({ ...c, [g]: !c[g] }))
  const ref = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  const clear = useAuthStore((s) => s.clearAuth)
  useEffect(() => {
    if (!userOpen) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setUserOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [userOpen])

  const boxStyle: React.CSSProperties = { background: 'var(--nav)', color: 'var(--nav-ink)', borderRadius: 20, boxShadow: 'var(--sh-2)', padding: '8px 10px 9px' }
  const NavBtn = (it: NavItem) => {
    const on = active === it.id
    return (
      <button key={it.id} className="press" onClick={() => router.push(it.route)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '8px 11px', borderRadius: 11, marginBottom: 1,
          color: on ? 'var(--on-brand)' : 'var(--nav-ink)', background: on ? 'var(--brand)' : 'transparent', fontWeight: on ? 700 : 600, fontSize: 14,
          boxShadow: on ? '0 6px 16px -6px var(--brand)' : 'none', transition: 'background .15s' }}>
        <Icon name={it.icon} size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
        {it.badge && badge > 0 && (
          <span style={{ minWidth: 19, height: 19, padding: '0 6px', borderRadius: 99, background: on ? 'rgba(255,255,255,.25)' : 'var(--brand)', color: 'var(--on-brand)', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{badge}</span>
        )}
      </button>
    )
  }
  return (
    <aside className="hidden lg:flex scrollbar-thin" style={{ width: 262, flex: 'none', margin: 12, height: 'calc(100vh - 24px)', position: 'sticky', top: 12, flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
      {groups.map((g, gi) => (
        <div key={g.group} style={boxStyle}>
          {gi === 0 && (
            <div style={{ padding: '7px 7px 9px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <Tako pose="logoMark" size={38} float={false} style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.3))' }} />
              <div>
                <div style={{ fontFamily: 'var(--f-display)', fontWeight: 900, fontSize: 19, color: '#fff', lineHeight: 1 }}>Tako</div>
                <div style={{ fontSize: 10.5, color: 'var(--nav-ink-2)', marginTop: 2 }}>Dashboard</div>
              </div>
            </div>
          )}
          <button className="press" onClick={() => toggleGroup(g.group)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px 7px', background: 'transparent' }}>
            <span style={{ fontFamily: 'var(--f-ui)', fontWeight: 700, fontSize: 13, color: 'var(--nav-ink-2)' }}>{g.group}</span>
            <Icon name="chevD" size={15} style={{ marginLeft: 'auto', color: 'var(--nav-ink-2)', transform: collapsed[g.group] ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {!collapsed[g.group] && g.items.map(NavBtn)}
          {gi === groups.length - 1 && (
            <div ref={ref} style={{ position: 'relative', paddingTop: 10, marginTop: 8, borderTop: '1px solid var(--nav-line)' }}>
              {userOpen && (
                <div className="pop-in" style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(100% - 2px)', transformOrigin: 'bottom', background: 'var(--nav-2)', border: '1px solid var(--nav-line)', borderRadius: 14, boxShadow: 'var(--sh-3)', padding: 6, marginBottom: 6 }}>
                  <button className="press" onClick={() => { router.push('/dashboard/impostazioni'); setUserOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, color: 'var(--nav-ink)', fontSize: 14, fontWeight: 600 }}>
                    <Icon name="settings" size={18} />Impostazioni
                  </button>
                  <div style={{ height: 1, background: 'var(--nav-line)', margin: '5px 8px' }} />
                  <button className="press" onClick={() => doLogout(clear)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, color: '#F0907F', fontSize: 14, fontWeight: 700 }}>
                    <Icon name="logout" size={18} />Esci dall'account
                  </button>
                </div>
              )}
              <button className="press" onClick={() => setUserOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: userOpen ? 'var(--nav-2)' : 'transparent', borderRadius: 11, padding: 5 }}>
                <Avatar initials={initialsOf(user?.name)} size={34} color="var(--brand)" />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--nav-ink-2)' }}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</div>
                </div>
                <Icon name="chevU" size={16} style={{ color: 'var(--nav-ink-2)', transform: userOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
            </div>
          )}
        </div>
      ))}
    </aside>
  )
}

/* ───────── notifications sheet (mobile) ───────── */
const TONE_NOTIF: Record<string, [string, string]> = {
  brand: ['var(--brand-tint)', 'var(--brand-deep)'], info: ['var(--info-bg)', '#3A6587'],
  wait: ['var(--wait-bg)', '#9A6912'], ok: ['var(--ok-bg)', 'var(--ok-deep)'], muted: ['var(--muted-bg)', 'var(--ink-2)'],
}
function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mounted, active } = useMountTransition(open, 340)
  const { list, unread, markAllRead } = useNotifications()
  if (!mounted) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 130, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,16,.45)', opacity: active ? 1 : 0, transition: 'opacity .3s', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '26px 26px 0 0', boxShadow: 'var(--sh-pop)', maxHeight: '76%', display: 'flex', flexDirection: 'column', transform: active ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .36s var(--spring)', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '10px 0 4px', display: 'grid', placeItems: 'center' }}><span style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--hairline)' }} /></div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 18px 14px', borderBottom: '1px solid var(--hairline)' }}>
          <h3 style={{ fontSize: 19, fontWeight: 900 }}>Notifiche</h3>
          {unread > 0 && <Badge tone="brand" solid>{unread} nuove</Badge>}
          <button className="press" onClick={markAllRead} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>Segna lette</button>
        </div>
        <div className="scrollbar-thin" style={{ overflowY: 'auto', padding: '6px 12px 16px' }}>
          {list.length === 0 && <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Nessuna notifica</div>}
          {list.map((n) => {
            const [bg, fg] = TONE_NOTIF[n.tone ?? 'brand'] ?? TONE_NOTIF.brand
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 10px', borderRadius: 14, background: n.unread ? 'var(--brand-wash)' : 'transparent' }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center', background: bg, color: fg }}><Icon name={(n.icon as IconName) || 'bell'} size={19} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.25 }}>{n.title}</div>
                  {n.sub && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{n.sub}</div>}
                </div>
                {n.unread && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--brand)', flex: 'none', marginTop: 6 }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ───────── mobile header (con capsula notifica volante) ───────── */
function MobileHeader() {
  const active = useActiveId()
  const user = useAuthStore((s) => s.user)
  const intro = routeIntro(active, user?.name ?? '')
  const { unread } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const [anim, setAnim] = useState<{ n: any; phase: string } | null>(null)
  useLiveNotif(useCallback((n) => setAnim({ n, phase: 'prep' }), []))
  useEffect(() => {
    if (!anim) return
    const next: Record<string, [string | null, number]> = { prep: ['enter', 30], enter: ['reveal', 560], reveal: ['hold', 540], hold: ['collapse', 2900], collapse: ['exit', 400], exit: [null, 440] }
    const step = next[anim.phase]; if (!step) return
    const t = setTimeout(() => setAnim((a) => (a ? (step[0] ? { ...a, phase: step[0] } : null) : null)), step[1])
    return () => clearTimeout(t)
  }, [anim])
  const ph = anim?.phase
  const busy = !!anim
  const headerHidden = busy && ph !== 'exit'
  const isActive = busy && ['enter', 'reveal', 'hold', 'collapse'].includes(ph!)
  const cap = ({ prep: { x: 290, w: 44, s: .78, o: 0 }, enter: { x: 0, w: 44, s: 1, o: 1 }, reveal: { x: 0, w: 256, s: 1, o: 1 }, hold: { x: 0, w: 256, s: 1, o: 1 }, collapse: { x: 0, w: 44, s: 1, o: 1 }, exit: { x: 290, w: 44, s: .78, o: 0 } }[ph!]) ?? { x: 290, w: 44, s: .78, o: 0 }
  const capTrans = ({ enter: 'transform .58s cubic-bezier(.3,1.35,.42,1), opacity .3s ease', reveal: 'width .52s cubic-bezier(.34,1.5,.5,1)', collapse: 'width .4s cubic-bezier(.5,0,.5,1)', exit: 'transform .44s cubic-bezier(.45,0,.7,.55), opacity .34s ease' }[ph!]) ?? 'none'
  const showText = ph === 'reveal' || ph === 'hold'
  return (
    <header style={{ position: 'relative', flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: '8px 14px 10px', minHeight: 60 }}>
      <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center' }}>
        {isActive && <span style={{ position: 'absolute', width: 46, height: 46, borderRadius: '50%', background: 'radial-gradient(circle, var(--brand) 0%, transparent 70%)', animation: 'nb-glow 1.4s var(--out)' }} />}
        <Tako pose={intro.pose} size={48} float={false} style={{ animation: busy ? 'nb-tako .9s var(--spring)' : undefined }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, transform: headerHidden ? 'translateY(-30px) scale(.92)' : 'none', filter: headerHidden ? 'blur(4px)' : 'none', opacity: headerHidden ? 0 : 1, transition: 'transform .4s var(--out), opacity .3s ease, filter .3s ease', transformOrigin: 'left center', pointerEvents: headerHidden ? 'none' : 'auto' }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--f-display)', fontWeight: 900, fontSize: 21, lineHeight: 1.05, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{intro.title}</div>
        <span style={{ position: 'relative', flex: 'none' }}>
          <IconBtn name="bell" tone="soft" size={40} onClick={() => setNotifOpen(true)} />
          {unread > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 99, background: 'var(--brand)', border: '2px solid var(--surface)' }} />}
        </span>
      </div>
      {busy && (
        <div onClick={() => { setAnim(null); setNotifOpen(true) }} style={{ position: 'absolute', left: 70, top: 9, height: 46, width: cap.w, maxWidth: 'calc(100% - 88px)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', borderRadius: 15, background: 'var(--nav)', color: 'var(--nav-ink)', boxShadow: '0 14px 30px rgba(0,0,0,.34)', overflow: 'hidden', whiteSpace: 'nowrap', opacity: cap.o, transform: `translateX(${cap.x}px) scale(${cap.s})`, transformOrigin: 'right center', transition: capTrans, zIndex: 30, cursor: 'pointer' }}>
          <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--brand)', color: '#fff' }}><Icon name={(anim!.n.icon as IconName) || 'bell'} size={16} stroke={2.6} /></span>
          <span style={{ minWidth: 0, display: showText ? 'block' : 'none' }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>{anim!.n.title}</span>
            {anim!.n.sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nav-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{anim!.n.sub}</span>}
          </span>
        </div>
      )}
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </header>
  )
}

/* ───────── bottom bar a vetro ───────── */
function BottomBar({ role, badge, openDrawer }: { role: RoleKey; badge: number; openDrawer: () => void }) {
  const router = useRouter()
  const active = useActiveId()
  const compact = useScrollDown()
  const prim = MOBILE_PRIMARY[role].map(findItem)
  const Tab = ({ it, isMore }: { it: NavItem; isMore?: boolean }) => {
    const on = !isMore && active === it.id
    return (
      <button className="press" onClick={isMore ? openDrawer : () => router.push(it.route)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 0 : 4, padding: compact ? '8px 0' : '9px 0 8px', color: on ? 'var(--brand)' : 'var(--ink-3)', position: 'relative' }}>
        <span style={{ position: 'relative' }}>
          <Icon name={isMore ? 'apps' : it.icon} size={compact ? 25 : 22} stroke={on ? 2.5 : 2} />
          {!isMore && it.badge && badge > 0 && <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 99, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 9.5, fontWeight: 800, display: 'grid', placeItems: 'center', border: '1.5px solid rgba(255,255,255,.95)' }}>{badge}</span>}
        </span>
        <span style={{ fontSize: 10, fontWeight: on ? 700 : 600, maxHeight: compact ? 0 : 14, opacity: compact ? 0 : 1, overflow: 'hidden', transition: 'max-height .25s var(--out), opacity .18s' }}>{isMore ? 'Altro' : it.label.split(' ')[0]}</span>
      </button>
    )
  }
  return (
    <nav style={{ position: 'fixed', left: 14, right: 14, bottom: 16, display: 'flex', alignItems: 'stretch', borderRadius: 26, padding: '2px 6px', zIndex: 40, backdropFilter: 'blur(30px) saturate(200%)', WebkitBackdropFilter: 'blur(30px) saturate(200%)', background: 'linear-gradient(160deg, rgba(255,255,255,.6), rgba(255,255,255,.34))', border: '1px solid rgba(255,255,255,.7)', boxShadow: '0 16px 42px rgba(42,31,26,.22), inset 0 1px 0 rgba(255,255,255,.95)' }}>
      {prim.map((it) => <Tab key={it.id} it={it} />)}
      <Tab isMore it={ALL_ITEMS[0]} />
    </nav>
  )
}

/* ───────── drawer "Altro" ───────── */
function MobileDrawer({ open, onClose, role, badge }: { open: boolean; onClose: () => void; role: RoleKey; badge: number }) {
  const router = useRouter()
  const active = useActiveId()
  const user = useAuthStore((s) => s.user)
  const clear = useAuthStore((s) => s.clearAuth)
  const { mounted, active: shown } = useMountTransition(open, 320)
  const primary = MOBILE_PRIMARY[role]
  const groups = navAllowed(role).map((g) => ({ ...g, items: g.items.filter((it) => !primary.includes(it.id)) })).filter((g) => g.items.length)
  if (!mounted) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,16,.45)', opacity: shown ? 1 : 0, transition: 'opacity .3s', backdropFilter: 'blur(2px)' }} />
      <div className="scrollbar-thin" style={{ position: 'relative', width: 296, maxWidth: '86vw', height: 'auto', maxHeight: 'calc(100% - 24px)', alignSelf: 'flex-end', margin: '12px 12px 12px 0', borderRadius: 26, background: 'var(--nav)', color: 'var(--nav-ink)', overflowY: 'auto', padding: '16px 12px', boxShadow: 'var(--sh-3)', transform: shown ? 'translateX(0)' : 'translateX(110%)', transition: 'transform .34s var(--spring)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 14px' }}>
          <span style={{ fontFamily: 'var(--f-display)', fontWeight: 900, fontSize: 20, color: '#fff' }}>Altro</span>
          <IconBtn name="x" tone="ghost" size={34} style={{ marginLeft: 'auto', color: 'var(--nav-ink-2)' }} onClick={onClose} />
        </div>
        {groups.map((g) => (
          <div key={g.group} style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--nav-ink-2)', padding: '6px 8px' }}>{g.group}</div>
            {g.items.map((it) => {
              const on = active === it.id
              return (
                <button key={it.id} className="press" onClick={() => { router.push(it.route); onClose() }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, color: on ? 'var(--on-brand)' : 'var(--nav-ink)', background: on ? 'var(--brand)' : 'transparent', fontWeight: on ? 700 : 600, fontSize: 15 }}>
                  <Icon name={it.icon} size={20} /><span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                  {it.badge && badge > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: on ? 'rgba(255,255,255,.25)' : 'var(--brand)', color: 'var(--on-brand)', fontSize: 11.5, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{badge}</span>}
                </button>
              )
            })}
          </div>
        ))}
        <div style={{ marginTop: 8, padding: 12, borderTop: '1px solid var(--nav-line)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Avatar initials={initialsOf(user?.name)} size={36} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{user?.name}</div><div style={{ fontSize: 12, color: 'var(--nav-ink-2)' }}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</div></div>
          <IconBtn name="settings" tone="ghost" size={36} style={{ color: 'var(--nav-ink-2)' }} onClick={() => { router.push('/dashboard/impostazioni'); onClose() }} />
          <IconBtn name="logout" tone="ghost" size={36} style={{ color: '#F0907F' }} onClick={() => doLogout(clear)} />
        </div>
      </div>
    </div>
  )
}

/* ───────── shell wrapper responsive ───────── */
export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const role: RoleKey = (user?.role === 'dipendente' ? 'cameriere' : (user?.role as RoleKey)) ?? 'owner'
  const [drawer, setDrawer] = useState(false)
  const [badge, setBadge] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const lastScroll = useRef(0)

  // badge ordini attivi (poll leggero; gli eventi socket dell'hub invalidano comunque le viste)
  useEffect(() => {
    let alive = true
    const fetchBadge = () => api.get('/orders/active').then((r) => { if (alive) setBadge((r.data.data ?? []).length) }).catch(() => {})
    fetchBadge()
    const t = setInterval(fetchBadge, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const onScroll = useCallback(() => {
    const el = mainRef.current; if (!el) return
    const y = el.scrollTop
    setScrollDown(y > lastScroll.current && y > 40)
    lastScroll.current = y
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <DesktopSidebar role={role} badge={badge} />
      <main ref={mainRef} onScroll={onScroll} className="flex-1 min-w-0 pt-[60px] pb-[96px] lg:pt-0 lg:pb-0" style={{ background: 'var(--bg)', minHeight: '100vh', overflowY: 'auto', height: '100vh' }}>
        {children}
      </main>
      {/* mobile chrome */}
      <div className="lg:hidden">
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)', borderBottom: '1px solid var(--hairline)' }}>
          <MobileHeader />
        </div>
        <BottomBar role={role} badge={badge} openDrawer={() => setDrawer(true)} />
        <MobileDrawer open={drawer} onClose={() => setDrawer(false)} role={role} badge={badge} />
      </div>
    </div>
  )
}
