'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { TrendingUp, Euro, Users, ShoppingCart } from 'lucide-react'

export default function StatistichePage() {
  const { data: stats } = useQuery({
    queryKey: ['stats-full'],
    queryFn: () => api.get('/stats/dashboard').then(r => r.data.data),
  })

  return (
    <div className="p-8">
      <h1 className="font-display font-black text-3xl mb-8">Statistiche</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Ricavi (7gg)', value: formatEuro(stats?.revenue ?? 0), icon: Euro, color: 'text-coral' },
          { label: 'Ticket medio', value: formatEuro(stats?.avgTicket ?? 0), icon: TrendingUp, color: 'text-mint' },
          { label: 'Coperti', value: stats?.totalCovers ?? 0, icon: Users, color: 'text-sky' },
          { label: 'Conti emessi', value: stats?.billsCount ?? 0, icon: ShoppingCart, color: 'text-sun' },
        ].map(kpi => (
          <div key={kpi.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-ink/60">{kpi.label}</p>
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <p className="font-display font-black text-3xl">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="font-display font-black text-xl mb-6">Andamento ultimi 7 giorni</h2>
        <div className="flex items-end gap-4 h-48">
          {stats?.dailyRevenue?.map((d: { date: string; amount: number }) => {
            const max = Math.max(...(stats.dailyRevenue.map((x: any) => x.amount) ?? [1]), 1)
            const h = (d.amount / max) * 100
            const isToday = d.date === new Date().toISOString().split('T')[0]
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-ink/60 text-center">{formatEuro(d.amount)}</span>
                <div className="w-full rounded-t-xl transition-all duration-700" style={{ height: `${Math.max(h, 4)}%`, background: isToday ? '#ED7159' : 'rgba(237,113,89,0.3)' }} />
                <span className="text-xs font-bold text-ink/50">{new Date(d.date).toLocaleDateString('it-IT', { weekday: 'short' })}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
