// Copilot — l'assistente del ristoratore, col pollice.
//
// Il server NON cambia (piano §5 F5.1): sono le stesse due rotte che la dashboard
// usa dal desktop, `POST /ai/owner/chat/stream` (SSE) e `POST /ai/owner/execute`.
// Cambia solo la mano che le usa, e da lì discendono le quattro scelte di questa
// schermata:
//
//  1. **Nessuna mutation parte da sola, mai.** Il motore propone (`pending[]`), la
//     card chiede, il dito conferma. È l'unica strada per cui un'azione che cambia
//     dati passa da qui: `run()` è chiamata SOLO dall'onClick del tasto di conferma.
//     Su un telefono, dove il tocco accidentale esiste, la card è anche la prima
//     cosa che si legge — non un dettaglio in coda alla risposta.
//  2. **La conferma è un bersaglio da pollice** (52 px, larghezza piena) e sta
//     sotto la spiegazione, non accanto: la mano che regge il telefono copre il
//     lato destro dello schermo, e un tasto lì si preme per sbaglio.
//  3. **Lo streaming è un lusso, non un requisito.** Su 4G attraverso il tunnel un
//     SSE può non arrivare mai (proxy che bufferizzano) o morire a metà. Il ripiego
//     è la rotta non-streaming, con lo spinner: perdita di eleganza, zero perdita
//     di funzione (Exit del piano, adottata come comportamento normale e silenzioso).
//  4. **La conversazione sopravvive alla navigazione.** Le sotto-schermate dell'hub
//     si smontano quando si esce: senza persistenza, tornare in Sala per controllare
//     un tavolo cancellerebbe la domanda appena fatta.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/app'
import { Btn, Card, Spinner } from '../ui/kit'
import { Icon } from '../ui/icons'

/** Mutation proposta dal motore: nome dell'azione, argomenti risolti, etichetta umana. */
interface Pending {
  name: string
  args: Record<string, unknown>
  label: string
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  pending?: Pending[]
  /** Esito per indice della card: una volta eseguita/annullata non si ripresenta. */
  done?: Record<number, { ok: boolean; text: string }>
  streaming?: boolean
}

const LS_CHAT = 'tako.owner.copilot'
const MAX_KEEP = 24

/** Le domande che un ristoratore fa davvero il primo giorno, non esempi di brochure. */
const SUGGESTIONS = [
  'Quanto ho incassato oggi?',
  'Che tavoli sono occupati?',
  'Segna esaurito il branzino',
  'Cosa sta finendo in magazzino?',
]

const INTRO = 'Chiedimi quello che vuoi sul locale: incassi, tavoli, magazzino, menu. Se serve cambiare qualcosa te lo propongo e decidi tu.'

function loadChat(): Msg[] {
  try {
    const raw = localStorage.getItem(LS_CHAT)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Msg[]
    if (!Array.isArray(parsed)) return []
    // Le card in sospeso NON si ripristinano: una proposta salvata ieri sera si
    // riferisce a dati di ieri sera. Ricaricarla come confermabile significherebbe
    // offrire un tasto che esegue un'azione decisa in un contesto che non c'è più.
    return parsed.slice(-MAX_KEEP).map((m) => ({ role: m.role, content: String(m.content ?? '') }))
  } catch {
    return []
  }
}

function saveChat(msgs: Msg[]) {
  try {
    localStorage.setItem(LS_CHAT, JSON.stringify(msgs.slice(-MAX_KEEP).map((m) => ({ role: m.role, content: m.content }))))
  } catch { /* storage pieno o disabilitato: la chat resta comunque in memoria */ }
}

function errorText(code?: string, fallback?: string): string {
  if (code === 'AI_UNAVAILABLE') return 'L\'assistente non è configurato su questa appliance.'
  if (code === 'AI_RATE_LIMITED') return 'Ho raggiunto il limite di richieste: riprova fra un minuto.'
  return fallback ?? 'Non sono riuscito a rispondere. Riprova.'
}

/**
 * Card di una mutation PROPOSTA. Il tasto è l'unico punto dell'app da cui
 * `POST /ai/owner/execute` può partire: nessun effetto al montaggio, nessun timer,
 * nessuna esecuzione ottimistica.
 */
function PendingCard({ item, state, onConfirm, onCancel }: {
  item: Pending
  state?: { ok: boolean; text: string }
  onConfirm: () => void
  onCancel: () => void
}) {
  const [running, setRunning] = useState(false)
  if (state) {
    return (
      <div className="ow-cop-pending" data-state={state.ok ? 'done' : 'error'}>
        <div className="ow-cop-pending-label">{item.label}</div>
        <div className="ow-cop-pending-out">
          <Icon name={state.ok ? 'check' : 'alert'} size={15} stroke={2.4} />
          <span>{state.text}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="ow-cop-pending" data-state="ask">
      <div className="ow-cop-pending-kicker">
        <Icon name="alert" size={13} stroke={2.6} />
        Serve la tua conferma
      </div>
      <div className="ow-cop-pending-label">{item.label}</div>
      <button
        type="button"
        className="press ow-btn ow-btn-brand ow-btn-lg ow-cop-confirm"
        disabled={running}
        onClick={() => { setRunning(true); onConfirm() }}
      >
        {running ? <Spinner size={18} /> : <Icon name="check" size={18} stroke={2.4} />}
        {running ? 'Eseguo…' : 'Conferma ed esegui'}
      </button>
      <button type="button" className="press ow-cop-cancel" disabled={running} onClick={onCancel}>
        Annulla
      </button>
    </div>
  )
}

export function CopilotScreen() {
  const { api } = useApp()
  const [msgs, setMsgs] = useState<Msg[]>(loadChat)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  // true mentre gira il ripiego non-streaming: è ciò che giustifica lo spinner al
  // posto del testo che compare parola per parola.
  const [buffering, setBuffering] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { saveChat(msgs) }, [msgs])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])

  // Textarea che cresce con il testo, fino a cinque righe: oltre, la tastiera del
  // telefono non lascerebbe più vedere la conversazione.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [input])

  /** Aggiorna l'ULTIMO messaggio assistente (quello in costruzione). */
  const patchLast = useCallback((fn: (m: Msg) => Msg) => {
    setMsgs((all) => {
      const i = all.length - 1
      if (i < 0 || all[i]!.role !== 'assistant') return all
      const next = all.slice()
      next[i] = fn(all[i]!)
      return next
    })
  }, [])

  const send = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message || busy) return
    setInput('')
    setBusy(true)
    setBuffering(false)

    // La history è la conversazione PRECEDENTE: il messaggio corrente lo aggiunge
    // il server come `userMessage` — includerlo qui lo duplicherebbe nel prompt.
    const history = msgs.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 1900) }))
    setMsgs((all) => [...all, { role: 'user', content: message }, { role: 'assistant', content: '', streaming: true }])

    /** Ripiego: una sola chiamata alla rotta non-streaming, con lo spinner acceso. */
    const nonStreaming = async (code?: string) => {
      setBuffering(true)
      try {
        const data = await api.post<{ message: string; pending?: Pending[] }>('/ai/owner/chat', { message, history })
        patchLast((m) => ({ ...m, content: data.message || 'Fatto.', pending: data.pending ?? [], streaming: false }))
      } catch (e) {
        const status = (e as { status?: number }).status
        const c = code ?? (status === 503 ? 'AI_UNAVAILABLE' : status === 429 ? 'AI_RATE_LIMITED' : undefined)
        patchLast((m) => ({ ...m, content: errorText(c), streaming: false }))
      } finally {
        setBuffering(false)
      }
    }

    try {
      const res = await api.stream('/ai/owner/chat/stream', { message, history })
      if (!res.ok || !res.body) {
        // 503/429 hanno un testo loro; qualunque altro esito è "SSE non disponibile"
        // e merita il tentativo non-streaming prima di arrendersi.
        await nonStreaming(res.status === 503 ? 'AI_UNAVAILABLE' : res.status === 429 ? 'AI_RATE_LIMITED' : undefined)
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let failed: string | undefined
      let closed = false
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let idx: number
        // Gli eventi SSE sono separati da una riga vuota; le righe che iniziano con
        // ':' sono l'heartbeat del server (': ping' ogni 15 s) e si scartano qui.
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const line = chunk.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          let ev: { type?: string; text?: string; message?: string; pending?: Pending[]; code?: string } | null = null
          try { ev = JSON.parse(line.slice(5).trim()) } catch { continue }
          if (!ev) continue
          if (ev.type === 'token') patchLast((m) => ({ ...m, content: m.content + (ev!.text ?? '') }))
          else if (ev.type === 'reset') patchLast((m) => ({ ...m, content: '' }))
          else if (ev.type === 'done') {
            patchLast((m) => ({ ...m, content: ev!.message || m.content || 'Fatto.', pending: ev!.pending ?? [], streaming: false }))
            closed = true
          } else if (ev.type === 'error') {
            failed = ev.code ?? 'AI_ERROR'
            closed = true
          }
        }
        if (closed) break
      }
      // Errore dal server (quota, modello giù): un tentativo sulla rotta normale.
      if (failed) { await nonStreaming(failed); return }
      // Stream chiuso senza 'done': è la firma di un proxy che ha tagliato la
      // connessione. Anche qui si ripiega invece di lasciare una bolla vuota.
      if (!closed) { await nonStreaming(); return }
    } catch {
      await nonStreaming()
    } finally {
      setBusy(false)
      patchLast((m) => (m.streaming ? { ...m, streaming: false } : m))
    }
  }, [api, busy, msgs, patchLast])

  /** L'UNICO punto da cui parte una mutation. Chiamato solo dal tap di conferma. */
  const runPending = useCallback(async (msgIndex: number, cardIndex: number, item: Pending) => {
    let out: { ok: boolean; text: string }
    try {
      const data = await api.post<{ summary?: string }>('/ai/owner/execute', { name: item.name, args: item.args })
      out = { ok: true, text: data?.summary || 'Fatto.' }
    } catch (e) {
      out = { ok: false, text: (e as Error).message || 'Esecuzione non riuscita.' }
    }
    setMsgs((all) => all.map((m, i) => (i === msgIndex ? { ...m, done: { ...m.done, [cardIndex]: out } } : m)))
  }, [api])

  const cancelPending = useCallback((msgIndex: number, cardIndex: number) => {
    setMsgs((all) => all.map((m, i) => (
      i === msgIndex ? { ...m, done: { ...m.done, [cardIndex]: { ok: true, text: 'Annullato.' } } } : m
    )))
  }, [])

  const empty = msgs.length === 0

  return (
    <div className="ow-cop">
      {empty && (
        <Card pad={16}>
          <div className="ow-cop-hello">
            <span className="ow-cop-spark"><Icon name="sparkles" size={19} stroke={2.2} /></span>
            <div>
              <h2>L&apos;assistente del locale</h2>
              <p className="ow-muted">{INTRO}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="ow-cop-thread">
        {msgs.map((m, i) => (
          <div key={i} className="ow-cop-msg" data-role={m.role}>
            {m.role === 'assistant' && m.streaming && !m.content
              ? <span className="ow-cop-typing"><i /><i /><i /></span>
              : <div className="ow-cop-text">{m.content}</div>}
            {m.role === 'assistant' && m.streaming && buffering && (
              <div className="ow-cop-wait"><Spinner size={14} /> Sto rispondendo senza streaming…</div>
            )}
            {(m.pending ?? []).map((p, k) => (
              <PendingCard
                key={k}
                item={p}
                {...(m.done?.[k] ? { state: m.done[k]! } : {})}
                onConfirm={() => void runPending(i, k, p)}
                onCancel={() => cancelPending(i, k)}
              />
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {empty && (
        <div className="ow-cop-sugg">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="press ow-chip" onClick={() => void send(s)}>{s}</button>
          ))}
        </div>
      )}

      {msgs.length > 0 && !busy && (
        <div className="ow-cop-clear">
          <Btn kind="ghost" size="sm" icon="refresh" onClick={() => { setMsgs([]); saveChat([]) }}>Nuova conversazione</Btn>
        </div>
      )}

      <div className="ow-cop-composer">
        <textarea
          ref={taRef}
          className="ow-cop-input"
          rows={1}
          value={input}
          placeholder="Scrivi al tuo assistente…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Invio manda solo con una tastiera fisica: sul telefono il tasto
            // "a capo" deve restare un a capo, o si mandano messaggi a metà.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(input) }
          }}
        />
        <button
          type="button"
          className="press ow-cop-send"
          aria-label="Invia"
          disabled={busy || !input.trim()}
          onClick={() => void send(input)}
        >
          {busy ? <Spinner size={18} /> : <Icon name="share" size={19} stroke={2.4} />}
        </button>
      </div>
    </div>
  )
}
