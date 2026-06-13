'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Star, RefreshCw } from 'lucide-react'
import type { MenuItemMetrics, AiSuggestion } from '@tako/types'

// ── Quadrant config ───────────────────────────────────────────────────────────

const QUADRANT = {
  star:       { label: 'Star',       color: 'text-sun',   bg: 'bg-sun/10',   border: 'border-sun/30',   icon: Star },
  plowhorse:  { label: 'Plowhorse',  color: 'text-sky',   bg: 'bg-sky/10',   border: 'border-sky/30',   icon: TrendingUp },
  puzzle:     { label: 'Puzzle',     color: 'text-coral', bg: 'bg-coral/10', border: 'border-coral/30', icon: AlertTriangle },
  dog:        { label: 'Dog',        color: 'text-ink/40',bg: 'bg-ink/5',    border: 'border-ink/15',   icon: TrendingDown },
  unknown:    { label: 'n/d',        color: 'text-ink/30',bg: 'bg-ink/5',    border: 'border-ink/10',   icon: TrendingUp },
} as const

const SUGGESTION_TYPE_COLOR: Record<string, string> = {
  increase_price: 'text-mint',
  decrease_price: 'text-coral',
  feature:        'text-sun',
  reposition:     'text-sky',
  remove:         'text-coral',
  bundle:         'text-mint',
  cost_check:     'text-ink/60',
}

const DAYS_OPTIONS = [7, 14, 30, 90]

// ── Cost editor inline ────────────────────────────────────────────────────────

function CostEditor({ item, onSaved }: { item: MenuItemMetrics; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(item.costPrice?.toString() ?? '')
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (cost: number) =>
      api.patch(`/insights/menu/${item.menuItemId}/cost`, { costPrice: cost }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insights'] }); setEditing(false); onSaved() },
  })

  if (!editing) return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-ink/40 hover:text-coral transition-colors underline underline-offset-2"
    >
      {item.costPrice != null ? formatEuro(item.costPrice) : 'imposta costo'}
    </button>
  )

  return (
    <form
      onSubmit={e => { e.preventDefault(); const n = parseFloat(val); if (!isNaN(n)) mut.mutate(n) }}
      className="flex items-center gap-1"
    >
      <span className="text-xs text-ink/50"></span>
      <input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        value={val}
        onChange={e => setVal(e.target.value)}
        className="w-16 text-xs border border-coral/50 rounded-md px-2 py-1 bg-white text-ink outline-none focus:border-coral"
      />
      <button type="submit" className="text-xs text-coral font-bold hover:text-coral/70">OK</button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink/30 hover:text-ink/60">✕</button>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [days, setDays] = useState(30)
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [aiError, setAiError] = useState('')
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['insights', days],
    queryFn: () => api.get(`/insights/menu?days=${days}`).then(r => r.data.data),
  })

  const aiMutation = useMutation({
    mutationFn: () =>
      api.post('/insights/menu/ai', {
        items: data?.items ?? [],
        periodDays: days,
        totalRevenue: data?.totalRevenue ?? 0,
      }).then(r => r.data.data),
    onSuccess: d => { setSuggestions(d.suggestions); setAiError('') },
    onError: (e: any) => setAiError(e?.response?.data?.error?.message ?? 'Errore AI'),
  })

  const items: MenuItemMetrics[] = data?.items ?? []

  // Group by quadrant for summary
  const stars = items.filter(i => i.quadrant === 'star').length
  const puzzles = items.filter(i => i.quadrant === 'puzzle').length
  const dogs = items.filter(i => i.quadrant === 'dog').length

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-3xl text-ink">Analisi Menu</h1>
          <p className="text-sm text-ink/50 mt-1">Capire cosa funziona. Decidere cosa cambiare.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-ink/10 rounded-xl p-1">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  days === d ? 'bg-coral text-white shadow-sm' : 'text-ink/50 hover:text-ink'
                }`}
              >
                {d}gg
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-white border border-ink/10 text-ink/40 hover:text-ink transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-ink/30">
          <RefreshCw size={20} className="animate-spin mr-2" /> Caricamento...
        </div>
      ) : !items.length ? (
        <div className="card text-center py-16 text-ink/40">
          <p className="font-bold text-lg mb-2">Nessun dato nel periodo selezionato</p>
          <p className="text-sm">Inizia a registrare ordini per vedere le analisi.</p>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: `Ricavo ${days}gg`, value: formatEuro(data?.totalRevenue ?? 0), sub: `${items.length} piatti` },
              { label: 'Star', value: stars, sub: 'alto volume + alto margine', color: 'text-sun' },
              { label: 'Puzzle', value: puzzles, sub: 'basso volume + alto margine', color: 'text-coral' },
              { label: 'Dog', value: dogs, sub: 'basso volume + basso margine', color: 'text-ink/40' },
            ].map(kpi => (
              <div key={kpi.label} className="card">
                <p className="text-xs font-bold text-ink/50 mb-1 uppercase tracking-wide">{kpi.label}</p>
                <p className={`font-display font-black text-3xl ${(kpi as any).color ?? 'text-ink'}`}>{kpi.value}</p>
                <p className="text-xs text-ink/40 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* AI suggestions */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-black text-xl">Suggerimenti AI</h2>
              <button
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-coral text-white rounded-xl text-sm font-bold hover:bg-coral/80 transition-colors disabled:opacity-50"
              >
                <Sparkles size={15} />
                {aiMutation.isPending ? 'Analisi...' : 'Analizza con AI'}
              </button>
            </div>

            {aiError && (
              <p className="text-sm text-coral mb-4">{aiError}</p>
            )}

            {!suggestions.length && !aiMutation.isPending && (
              <p className="text-sm text-ink/40">
                Premi "Analizza con AI" per ricevere suggerimenti data-driven sul tuo menu.
              </p>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-col gap-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-ink/[0.02] rounded-xl border border-ink/5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-coral/10 flex items-center justify-center">
                      <span className="text-xs font-black text-coral">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap mb-1">
                        <span className="font-bold text-ink">{s.itemName}</span>
                        <span className={`text-xs font-bold uppercase tracking-wide ${SUGGESTION_TYPE_COLOR[s.type] ?? 'text-ink/50'}`}>
                          {s.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-ink mb-1">{s.action}</p>
                      <p className="text-sm text-ink/60">{s.reason}</p>
                    </div>
                    {s.estimatedMonthlyImpact && (
                      <span className="flex-shrink-0 text-sm font-black text-mint bg-mint/10 px-3 py-1 rounded-lg whitespace-nowrap">
                        {s.estimatedMonthlyImpact}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="card overflow-hidden">
            <h2 className="font-display font-black text-xl mb-4">Performance piatti</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8">
                    {['Piatto', 'Quadrante', 'Venduti', 'Ricavo', 'Quota', 'Prezzo medio', 'Costo', 'Margine'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-ink/40 uppercase tracking-wide pb-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const q = QUADRANT[item.quadrant] ?? QUADRANT.unknown
                    const QIcon = q.icon
                    return (
                      <tr key={item.menuItemId} className={`border-b border-ink/5 hover:bg-ink/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-ink/[0.01]'}`}>
                        <td className="py-3 pr-4 font-medium max-w-[200px] truncate">{item.name}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${q.bg} ${q.color} ${q.border}`}>
                            <QIcon size={11} />
                            {q.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-bold">{item.totalQty}</td>
                        <td className="py-3 pr-4 font-bold">{formatEuro(item.totalRevenue)}</td>
                        <td className="py-3 pr-4 text-ink/60">{item.revenueShare}%</td>
                        <td className="py-3 pr-4">{formatEuro(item.avgPrice)}</td>
                        <td className="py-3 pr-4">
                          <CostEditor item={item} onSaved={() => qc.invalidateQueries({ queryKey: ['insights'] })} />
                        </td>
                        <td className="py-3 pr-4">
                          {item.marginPercent != null ? (
                            <span className={`font-bold ${item.marginPercent >= 60 ? 'text-mint' : item.marginPercent >= 40 ? 'text-sun' : 'text-coral'}`}>
                              {item.marginPercent}%
                            </span>
                          ) : (
                            <span className="text-ink/25 text-xs">n/d</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
