'use client'
import { useState, useRef, useEffect } from 'react'
import { useSessionStore, useCartStore } from '@/lib/store'
import { api } from '@/lib/api'
import { ArrowLeft, Send, Sparkles, CheckCircle2, BellRing, ShoppingBag } from 'lucide-react'
import { formatEuro } from '@/lib/utils'

interface AgentAction { type: string; [k: string]: unknown }
interface Message { role: 'user' | 'assistant'; content: string; actions?: AgentAction[] }

const SUGGESTIONS = [
  'Cosa mi consigli?',
  'Avete piatti senza glutine?',
  'Ordina una margherita e due birre',
  'A che punto è il mio ordine?',
]

export function AiChat({ onBack, onOrderPlaced }: { onBack: () => void; onOrderPlaced?: () => void }) {
  const { restaurantId, tableId, tableNumber, sessionId, restaurantName } = useSessionStore()
  const cart = useCartStore()
  const setOrderId = useSessionStore((s) => s.setOrderId)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Ciao! Sono l'assistente di ${restaurantName ?? 'questo locale'}. Posso consigliarti, prendere l'ordine e seguirlo per te. Dimmi pure.` },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Apply structured actions the assistant performed server-side.
  function applyActions(actions: AgentAction[]) {
    for (const a of actions) {
      if (a.type === 'cart_add' && Array.isArray(a.lines)) {
        for (const l of a.lines as { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string }[]) {
          cart.add({ menuItemId: l.menuItemId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, notes: l.notes })
        }
      }
      if (a.type === 'order_placed' && typeof a.orderId === 'string') {
        setOrderId(a.orderId)
        cart.clear()
      }
    }
  }

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
      const actions: AgentAction[] = data.data.actions ?? []
      applyActions(actions)
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
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--status-success)' }} /> online
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
            {m.actions?.map((a, j) => <ActionCard key={j} action={a} onTrack={onOrderPlaced} />)}
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

function ActionCard({ action, onTrack }: { action: AgentAction; onTrack?: () => void }) {
  if (action.type === 'cart_add' && Array.isArray(action.lines)) {
    const lines = action.lines as { name: string; quantity: number; unitPrice: number }[]
    if (!lines.length) return null
    const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    return (
      <div className="ml-1 max-w-[88%] overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-1)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
          <ShoppingBag size={16} strokeWidth={2.2} style={{ color: 'var(--brand)' }} />
          <span className="font-display text-[13px] font-bold text-[var(--text-primary)]">Aggiunto al carrello</span>
        </div>
        <div className="px-4 py-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-1 text-[14px]">
              <span className="font-medium text-[var(--text-primary)]">{l.quantity}× {l.name}</span>
              <span className="font-semibold text-[var(--text-secondary)]">{formatEuro(l.unitPrice * l.quantity)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-[var(--border-subtle)] pt-2 text-[14px]">
            <span className="font-bold text-[var(--text-primary)]">Totale parziale</span>
            <span className="font-display font-bold" style={{ color: 'var(--brand)' }}>{formatEuro(total)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (action.type === 'order_placed') {
    return (
      <div className="ml-1 max-w-[88%] rounded-[18px] border px-4 py-3.5 shadow-[var(--elev-1)]" style={{ borderColor: 'color-mix(in srgb, var(--status-success) 30%, transparent)', background: 'color-mix(in srgb, var(--status-success) 8%, var(--surface-raised))' }}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} strokeWidth={2.2} style={{ color: 'var(--status-success)' }} />
          <span className="font-display text-[15px] font-bold text-[var(--text-primary)]">Ordine inviato in cucina!</span>
        </div>
        {typeof action.total === 'number' && (
          <p className="mt-1 pl-7 text-[13px] font-semibold text-[var(--text-secondary)]">Totale {formatEuro(action.total)}</p>
        )}
        {onTrack && (
          <button onClick={onTrack} className="mt-3 w-full rounded-full py-2.5 text-[14px] font-bold text-[var(--on-brand)] active:scale-[0.98]" style={{ background: 'var(--brand)' }}>
            Segui l&apos;ordine
          </button>
        )}
      </div>
    )
  }

  if (action.type === 'waiter_called') {
    return (
      <div className="ml-1 flex max-w-[88%] items-center gap-2 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 shadow-[var(--elev-1)]">
        <BellRing size={18} strokeWidth={2.2} style={{ color: 'var(--brand)' }} />
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">Ho avvisato il cameriere.</span>
      </div>
    )
  }

  return null
}
