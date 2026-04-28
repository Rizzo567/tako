'use client'
import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '@/lib/store'
import { api } from '@/lib/api'
import { ArrowLeft, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Hai piatti vegani? 🌿',
  'Quali piatti senza glutine avete? 🌾',
  'Cosa mi consigli oggi? 🍽️',
  'Ingredienti del piatto del giorno?',
]

export function AiChat({ onBack }: { onBack: () => void }) {
  const { restaurantId, primaryColor } = useSessionStore()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Ciao! 👋 Sono Tako, il tuo assistente. Posso risponderti su ingredienti, allergeni, porzioni e abbinamenti. Come posso aiutarti?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const history = newMessages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/customer/ai-chat', { restaurantId, message: text, history })
      setMessages(m => [...m, { role: 'assistant', content: data.data.message }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Scusa, ho avuto un problema. Riprova tra un attimo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <div className="sticky top-0 z-40 bg-white border-b-2 border-ink/10 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border-2 border-ink/20 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full grid place-items-center text-white font-black text-sm" style={{ background: primaryColor ?? '#ED7159' }}>T</div>
          <div>
            <p className="font-display font-black text-sm">Tako AI</p>
            <p className="text-xs text-green-500 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> online</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {messages.map((m, i) => (
          <div key={i} className={cn('max-w-[85%] px-4 py-3 rounded-2xl text-sm font-semibold', m.role === 'user' ? 'ml-auto text-white rounded-br-sm' : 'mr-auto bg-white border-2 border-ink/10 text-ink rounded-bl-sm')} style={{ background: m.role === 'user' ? (primaryColor ?? '#ED7159') : undefined }}>
            {m.content}
          </div>
        ))}
        {messages.length === 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); send(s) }}
                className="shrink-0 px-4 py-2.5 rounded-2xl border-2 border-ink/15 bg-white font-body font-semibold text-sm text-ink/70 active:scale-95 transition-transform whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-white border-2 border-ink/10 flex gap-1.5 items-center rounded-bl-sm">
            {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-coral/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white border-t-2 border-ink/10 p-4">
        <div className="flex gap-3">
          <input
            className="flex-1 px-4 py-3 rounded-2xl border-2 border-ink/20 font-body font-semibold text-sm focus:outline-none focus:border-coral"
            placeholder="Chiedi qualcosa sul menu..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} className="w-12 h-12 rounded-2xl grid place-items-center text-white disabled:opacity-40 transition-opacity" style={{ background: primaryColor ?? '#ED7159' }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
