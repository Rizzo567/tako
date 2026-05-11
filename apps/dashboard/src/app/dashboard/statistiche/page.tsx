'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { TrendingUp, Euro, Users, ShoppingCart, QrCode, Timer, MousePointerClick } from 'lucide-react'

function formatSeconds(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export default function StatistichePage() {
  const { data: stats } = useQuery({
    queryKey: ['stats-full'],
    queryFn: () => api.get('/stats/dashboard').then(r => r.data.data),
  })

  const sessions = stats?.sessions
  const scansPerHour: { hour: number; count: number }[] = sessions?.scansPerHour ?? []
  const maxScans = Math.max(...scansPerHour.map((h: { hour: number; count: number }) => h.count), 1)
  const currentHour = new Date().getHours()

  return (
    <div className="p-8">
      <h1 className="font-display font-black text-3xl mb-8">Statistiche</h1>

      {/* Revenue KPIs */}
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

      {/* Session KPIs */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          {
            label: 'Scansioni QR (7gg)',
            value: sessions?.totalScans ?? '—',
            icon: QrCode,
            color: 'text-coral',
          },
          {
            label: 'Tasso conversione',
            value: sessions?.totalScans > 0 ? `${sessions.conversionRate}%` : '—',
            icon: MousePointerClick,
            color: 'text-mint',
            sub: 'scansioni → primo ordine',
          },
          {
            label: 'Tempo al primo ordine',
            value: formatSeconds(sessions?.avgTimeToFirstOrderSec ?? null),
            icon: Timer,
            color: 'text-sun',
            sub: 'media per sessione',
          },
        ].map(kpi => (
          <div key={kpi.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-ink/60">{kpi.label}</p>
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <p className="font-display font-black text-3xl">{kpi.value}</p>
            {kpi.sub && <p className="text-xs text-ink/40 font-semibold mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="card mb-8">
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

      {/* Peak hours chart */}
      <div className="card">
        <h2 className="font-display font-black text-xl mb-1">Orari di punta</h2>
        <p className="text-sm text-ink/50 font-semibold mb-6">Scansioni QR per ora del giorno (ultimi 7 giorni)</p>
        <div className="flex items-end gap-1 h-32">
          {scansPerHour.map(({ hour, count }) => {
            const h = (count / maxScans) * 100
            const isNow = hour === currentHour
            const isPeak = count === maxScans && maxScans > 0
            return (
              <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                {count > 0 && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-ink text-cream text-[10px] font-bold px-1.5 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {count}
                  </div>
                )}
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${Math.max(h, count > 0 ? 8 : 2)}%`,
                    background: isPeak
                      ? '#ED7159'
                      : isNow
                      ? 'rgba(237,113,89,0.6)'
                      : count > 0
                      ? 'rgba(237,113,89,0.25)'
                      : 'rgba(42,31,26,0.05)',
                  }}
                />
                {hour % 3 === 0 && (
                  <span className="text-[9px] font-bold text-ink/40">{hour}h</span>
                )}
              </div>
            )
          })}
        </div>
        {maxScans === 0 && (
          <p className="text-center text-ink/30 font-display font-black text-sm mt-4">Nessuna scansione nel periodo</p>
        )}
      </div>
    </div>
  )
}
