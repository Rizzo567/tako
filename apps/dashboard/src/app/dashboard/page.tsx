'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { TrendingUp, ShoppingCart, Users, Euro } from 'lucide-react'
import { useOnboardingStore } from '@/lib/store'
import Link from 'next/link'

const ONBOARDING_STEPS = [
  { id: 'restaurant', label: 'Dati ristorante' },
  { id: 'tables', label: 'Tavoli' },
  { id: 'menu', label: 'Menu' },
  { id: 'qr', label: 'QR Code' },
  { id: 'staff', label: 'Team' },
]

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats/dashboard').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: todayData } = useQuery({
    queryKey: ['bills-today'],
    queryFn: () => api.get('/bills/summary/today').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { completedSteps, isStepComplete } = useOnboardingStore()

  const kpis = [
    { label: 'Incasso oggi', value: formatEuro(todayData?.revenue ?? 0), icon: Euro, color: 'text-coral' },
    { label: 'Ordini attivi', value: stats?.pendingOrdersCount ?? 0, icon: ShoppingCart, color: 'text-sun' },
    { label: 'Ticket medio', value: formatEuro(stats?.avgTicket ?? 0), icon: TrendingUp, color: 'text-mint' },
    { label: 'Coperti oggi', value: stats?.totalCovers ?? 0, icon: Users, color: 'text-sky' },
  ]

  const progressPct = (completedSteps.length / 5) * 100

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-black text-3xl">Dashboard</h1>
        <p className="text-ink/60 font-semibold mt-1">Buongiorno! Ecco come va oggi.</p>
      </div>

      {/* Onboarding widget */}
      {completedSteps.length < 5 && (
        <div className="card-flat border-l-4 border-coral mb-8 p-5">
          <h2 className="font-display font-black text-lg mb-3">Completa il setup</h2>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-ink/10 mb-4">
            <div
              className="h-2 rounded-full bg-coral transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Step chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {ONBOARDING_STEPS.map((step) => {
              const done = isStepComplete(step.id)
              return (
                <span
                  key={step.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    done
                      ? 'bg-mint/15 text-mint'
                      : 'bg-ink/10 text-ink/50'
                  }`}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="6" fill="currentColor" opacity="0.2" />
                      <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-current opacity-40 inline-block" />
                  )}
                  {step.label}
                </span>
              )
            })}
          </div>

          <Link
            href="/dashboard/onboarding"
            className="text-sm font-bold text-coral hover:underline"
          >
            Continua il setup →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-ink/60">{kpi.label}</p>
              <kpi.icon size={20} className={kpi.color} />
            </div>
            <p className="font-display font-black text-3xl">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {stats?.dailyRevenue && (
        <div className="card mb-5">
          <h2 className="font-display font-black text-xl mb-5">Andamento settimana</h2>
          <div className="flex items-end gap-3 h-40">
            {stats.dailyRevenue.map((d: { date: string; amount: number }, i: number) => {
              const max = Math.max(...stats.dailyRevenue.map((x: any) => x.amount), 1)
              const h = (d.amount / max) * 100
              const isToday = d.date === new Date().toISOString().split('T')[0]
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-black text-ink/60">{formatEuro(d.amount)}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(h, 4)}%`, background: isToday ? '#ED7159' : 'rgba(237,113,89,0.3)' }} />
                  <span className="text-xs font-bold text-ink/50">{new Date(d.date).toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
