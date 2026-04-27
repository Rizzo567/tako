'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { TrendingUp, ShoppingCart, Users, Euro } from 'lucide-react'

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

  const kpis = [
    { label: 'Incasso oggi', value: formatEuro(todayData?.revenue ?? 0), icon: Euro, color: 'text-coral' },
    { label: 'Ordini attivi', value: stats?.pendingOrdersCount ?? 0, icon: ShoppingCart, color: 'text-sun' },
    { label: 'Ticket medio', value: formatEuro(stats?.avgTicket ?? 0), icon: TrendingUp, color: 'text-mint' },
    { label: 'Coperti oggi', value: stats?.totalCovers ?? 0, icon: Users, color: 'text-sky' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-black text-3xl">Dashboard</h1>
        <p className="text-ink/60 font-semibold mt-1">Buongiorno! Ecco come va oggi.</p>
      </div>

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
