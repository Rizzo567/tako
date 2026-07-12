'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSessionStore, useCartStore } from '@/lib/store'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/utils'
import { Send, ShoppingBag, Check, Bell, Clock } from 'lucide-react'
import { useI18n, type Lang } from '@/lib/i18n'
import { Confetti } from './ui/Confetti'
import { SPRING } from '@/lib/motion'

// Azioni ritornate da /customer/ai-chat. Il tipo è parsato in modo difensivo perché
// il contratto lato server può evolvere.
interface CartAction { type: 'add_to_cart' | 'cart_add'; items: { menuItemId: string; variantId?: string; name: string; unitPrice: number; quantity: number }[] }
interface WaiterAction { type: 'waiter_called'; reason?: string; label?: string }
interface OrderPlacedAction { type: 'order_placed'; orderId?: string; total?: number }
type ChatAction = CartAction | WaiterAction | OrderPlacedAction

interface Message { role: 'user' | 'assistant'; content: string; actions?: ChatAction[] }

const CHIPS: Record<Lang, string[]> = {
  it: ['Cosa mi consigli?', 'Avete piatti senza glutine?', 'Ordina una margherita e due birre', 'A che punto è il mio ordine?'],
  en: ['What do you recommend?', 'Any gluten-free dishes?', 'Order a margherita and two beers', 'How is my order doing?'],
  es: ['¿Qué me recomiendas?', '¿Tenéis platos sin gluten?', 'Pide una margarita y dos cervezas', '¿Cómo va mi pedido?'],
  de: ['Was empfiehlst du?', 'Habt ihr glutenfreie Gerichte?', 'Bestelle eine Margherita und zwei Bier', 'Wie steht es um meine Bestellung?'],
}

/* ─────────────── action cards ─────────────── */
function ActionCard({ action, onTrack }: { action: ChatAction; onTrack: () => void }) {
  const { t } = useI18n()
  const add = useCartStore((s) => s.add)
  const applied = useRef(false)

  // cart_add: aggiunge davvero al carrello (una volta), poi mostra la conferma.
  useEffect(() => {
    if ((action.type === 'add_to_cart' || action.type === 'cart_add') && !applied.current) {
      applied.current = true
      for (const it of action.items) {
        add({ menuItemId: it.menuItemId, variantId: it.variantId, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice })
      }
      toast.success(t('addedToCart'))
    }
  }, [action, add, t])

  const pop = { initial: { scale: 0.5, opacity: 0 }, animate: { scale: [0.5, 1.06, 1], opacity: 1 }, transition: SPRING }

  if (action.type === 'waiter_called') {
    return (
      <motion.div {...pop} className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'var(--raised)', boxShadow: 'inset 0 0 0 1.5px var(--brand)' }}>
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}><Bell size={20} /></span>
        <div>
          <p className="text-[14.5px] font-bold text-[var(--ink)]">{action.label ?? t('hdrWaiter')}</p>
          <p className="text-[13px] text-[var(--ink-2)]">{t('waiterNotified')}</p>
        </div>
      </motion.div>
    )
  }

  if (action.type === 'order_placed') {
    return (
      <motion.div {...pop} className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: 'var(--ok)' }}>
        <Confetti n={12} />
        <div className="flex items-center gap-2 text-[15px] font-bold"><Check size={20} strokeWidth={2.6} /> {t('orderSent')}</div>
        <p className="mb-3 mt-1 text-[13px] opacity-90">{action.orderId ? `#${action.orderId.slice(-5)} · ` : ''}{action.total != null ? formatEuro(action.total) : ''}</p>
        <button onClick={onTrack} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-bold text-[var(--ink)] active:scale-95" style={{ background: '#fff' }}>
          <Clock size={17} /> {t('trackOrder')}
        </button>
      </motion.div>
    )
  }

  // cart_add
  const total = action.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  return (
    <motion.div {...pop} className="rounded-2xl p-3.5" style={{ background: 'var(--raised)', boxShadow: 'inset 0 0 0 1.5px var(--ok)' }}>
      <div className="mb-2 flex items-center gap-2 text-[13.5px] font-bold" style={{ color: 'var(--ok)' }}>
        <ShoppingBag size={17} /> {t('addedToCart')}
      </div>
      {action.items.map((it, i) => (
        <div key={i} className="mb-1.5 flex items-baseline justify-between gap-3 text-[14px] text-[var(--ink)]">
          <span className="min-w-0 truncate"><b>{it.quantity}×</b> {it.name}</span>
          <span className="tnum flex-none text-[var(--ink-2)]">{formatEuro(it.unitPrice * it.quantity)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t pt-2 font-bold text-[var(--ink)]" style={{ borderColor: 'var(--hairline)' }}>
        <span>{t('total')}</span><span className="tnum">{formatEuro(total)}</span>
      </div>
    </motion.div>
  )
}

export function AiChat({ onOrderPlaced }: { onBack: () => void; onOrderPlaced?: () => void }) {
  const { t, lang } = useI18n()
  const { restaurantId, tableId, tableNumber, sessionId, restaurantName, setOrderId } = useSessionStore()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Ciao! Sono l'assistente di ${restaurantName ?? 'questo locale'}. Posso consigliarti, aggiungere piatti al carrello e chiamare il cameriere. Dimmi pure.` },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || typing) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setTyping(true)
    try {
      const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/customer/ai-chat', { restaurantId, message: text, tableId, tableNumber, sessionId, history })
      const actions: ChatAction[] = Array.isArray(data.data.actions) ? data.data.actions : []
      // order_placed: aggiorna lo store così il tracking mostra il nuovo ordine.
      const placed = actions.find((a): a is OrderPlacedAction => a.type === 'order_placed')
      if (placed?.orderId) setOrderId(placed.orderId)
      setMessages((m) => [...m, { role: 'assistant', content: data.data.message, actions }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t('chatError') }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - var(--header-h) - 96px)' }}>
      {/* sub-header assistente */}
      <div className="flex items-center gap-3 px-5 pb-3 pt-1">
        <div className="relative h-[42px] w-[42px] flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tako/tako-chef.png" alt="" className="h-[42px] w-[42px] object-contain" />
          <span className="absolute -right-px bottom-0 h-3 w-3 rounded-full" style={{ background: 'var(--ok)', boxShadow: '0 0 0 2.5px var(--surface)' }} />
        </div>
        <div className="leading-tight">
          <p className="text-[16px] font-bold text-[var(--ink)]">{t('navAssistant')}</p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ok)' }}>{t('chatOnline')}</p>
        </div>
      </div>
      <hr className="hairline" />

      {/* messaggi (scroll INTERNO: la pagina non scrolla → niente salto al focus) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.content && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING}
                className="max-w-[86%] whitespace-pre-line px-4 py-2.5 text-[14.5px] font-medium leading-snug"
                style={m.role === 'user'
                  ? { background: 'var(--brand)', color: 'var(--on-brand)', borderRadius: '18px 18px 6px 18px' }
                  : { background: 'var(--raised)', color: 'var(--ink)', borderRadius: '18px 18px 18px 6px', boxShadow: 'var(--sh-1)' }}
              >
                {m.content}
              </motion.div>
            )}
            {m.role === 'assistant' && m.actions?.map((a, ai) => (
              <div key={ai} className="w-[86%]"><ActionCard action={a} onTrack={() => onOrderPlaced?.()} /></div>
            ))}
          </div>
        ))}

        {messages.length === 1 && !typing && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pt-1">
            {CHIPS[(['it', 'en', 'es', 'de'].includes(lang) ? lang : 'it') as Lang].map((s) => (
              <button key={s} onClick={() => send(s)}
                className="flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-semibold text-[var(--ink-2)] active:scale-95"
                style={{ background: 'var(--raised)', boxShadow: 'var(--sh-1)' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {typing && (
          <div className="flex items-center gap-1.5 self-start rounded-[18px] rounded-bl-md px-4 py-3.5" style={{ background: 'var(--raised)', boxShadow: 'var(--sh-1)' }}>
            <span className="tdot" /><span className="tdot" /><span className="tdot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer in fondo al pannello (altezza fissa), subito sopra la bottom nav */}
      <div className="flex flex-none items-center gap-2.5 border-t px-4 pt-3"
        style={{ background: 'var(--surface)', borderColor: 'var(--hairline)', paddingBottom: 'calc(var(--safe-b) + 12px)' }}>
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          placeholder={t('chatPlaceholder')}
          className="h-[46px] flex-1 rounded-full px-[18px] text-[15px] text-[var(--ink)] outline-none"
          style={{ background: 'var(--raised)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)' }}
        />
        <button onClick={() => send()} disabled={!input.trim() || typing} aria-label="Invia"
          className="grid h-[46px] w-[46px] flex-none place-items-center rounded-full transition-colors active:scale-90"
          style={{ background: input.trim() ? 'var(--brand)' : 'var(--sunken)', color: input.trim() ? 'var(--on-brand)' : 'var(--ink-3)' }}>
          <Send size={20} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
