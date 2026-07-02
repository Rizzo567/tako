'use client'
import { useState, useRef, useEffect } from 'react'
import { useSessionStore, useCartStore } from '@/lib/store'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/utils'
import { ArrowLeft, Send, Sparkles, ShoppingBag, Plus, Check, Bell } from 'lucide-react'

// Azioni che l'assistente può restituire e che la PWA applica.
interface CartAction { type: 'add_to_cart'; items: { menuItemId: string; variantId?: string; name: string; unitPrice: number; quantity: number }[] }
interface WaiterAction { type: 'waiter_called'; reason?: string }
type ChatAction = CartAction | WaiterAction

interface Message { role: 'user' | 'assistant'; content: string; actions?: ChatAction[] }

// L'assistente ora è AGENTICO: consiglia, aggiunge al carrello, chiama il cameriere,
// controlla lo stato dell'ordine. I suggerimenti riflettono ciò che sa fare davvero.
const SUGGESTIONS = [
  'Cosa mi consigli di leggero?',
  'Aggiungi due margherite al carrello',
  'Avete piatti senza glutine?',
  'A che punto è il mio ordine?',
]

/* ─────────────── ActionCard: applica in-app le azioni tornate dall'AI ─────────────── */
function ActionCard({ action }: { action: ChatAction }) {
  const add = useCartStore((s) => s.add)
  const [applied, setApplied] = useState(false)

  if (action.type === 'waiter_called') {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] shadow-[var(--elev-1)]">
        <span className="grid h-7 w-7 place-items-center rounded-full text-[var(--on-brand)]" style={{ background: 'var(--brand)' }}><Bell size={15} /></span>
        Cameriere avvisato
      </div>
    )
  }

  const total = action.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const applyToCart = () => {
    if (applied) return
    for (const it of action.items) {
      add({ menuItemId: it.menuItemId, variantId: it.variantId, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice })
    }
    setApplied(true)
    toast.success('Aggiunto al carrello')
  }

  return (
    <div className="mt-2 max-w-[88%] rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 shadow-[var(--elev-1)]">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        <ShoppingBag size={14} /> Proposta ordine
      </div>
      <div className="space-y-1">
        {action.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[14px] font-medium text-[var(--text-primary)]">
            <span className="min-w-0 truncate">{it.quantity}× {it.name}</span>
            <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{formatEuro(it.unitPrice * it.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
        <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Totale</span>
        <span className="text-[15px] font-bold tabular-nums text-[var(--text-primary)]">{formatEuro(total)}</span>
      </div>
      <button
        onClick={applyToCart}
        disabled={applied}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[14px] font-bold text-[var(--on-brand)] transition-transform active:scale-95 disabled:opacity-70"
        style={{ background: applied ? 'var(--status-success)' : 'var(--brand)' }}
      >
        {applied ? <><Check size={16} /> Aggiunto</> : <><Plus size={16} /> Aggiungi al carrello</>}
      </button>
    </div>
  )
}

export function AiChat({ onBack }: { onBack: () => void; onOrderPlaced?: () => void }) {
  const { restaurantId, tableId, tableNumber, sessionId, restaurantName } = useSessionStore()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Ciao! Sono l'assistente di ${restaurantName ?? 'questo locale'}. Posso consigliarti, aggiungere piatti al carrello e chiamare il cameriere. Dimmi pure.` },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/customer/ai-chat', { restaurantId, message: text, tableId, tableNumber, sessionId, history })
      const actions: ChatAction[] = Array.isArray(data.data.actions) ? data.data.actions : []
      setMessages((m) => [...m, { role: 'assistant', content: data.data.message, actions }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Scusa, ho avuto un intoppo. Riprova tra un attimo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--surface-base)]">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} aria-label="Indietro" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-primary)] active:scale-95">
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full text-[var(--on-brand)]" style={{ background: 'var(--brand)' }}>
            <Sparkles size={17} strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold text-[var(--text-primary)]">Assistente</p>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--status-success)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--status-success)' }} /> in linea
            </p>
          </div>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-28">
        {messages.map((m, i) => (
          <div key={i} className="space-y-2">
            <div className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[82%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px] font-medium leading-snug text-[var(--on-brand)]'
                    : 'max-w-[88%] rounded-[20px] rounded-bl-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5 text-[15px] font-medium leading-snug text-[var(--text-primary)] shadow-[var(--elev-1)]'
                }
                style={m.role === 'user' ? { background: 'var(--brand)' } : undefined}
              >
                {m.content}
              </div>
            </div>
            {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
              <div className="flex flex-col items-start">
                {m.actions.map((a, ai) => <ActionCard key={ai} action={a} />)}
              </div>
            )}
          </div>
        ))}

        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-2 text-[13px] font-semibold text-[var(--text-secondary)] active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3.5 shadow-[var(--elev-1)]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--brand)', opacity: 0.55, animationDelay: `${i * 140}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3 text-[15px] font-medium text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand)]"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Invia"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[var(--on-brand)] transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: 'var(--brand)' }}
          >
            <Send size={19} strokeWidth={2.2} />
          </button>
        </form>
      </div>
    </div>
  )
}
