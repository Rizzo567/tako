// Andamento — 7 e 30 giorni, e l'export che si manda al commercialista dal telefono.
//
// Tre cose che questa schermata NON fa, e sono scelte:
//
//  • non ridefinisce "incasso". Il numero è quello di `GET /api/stats/dashboard`,
//    MANCE INCLUSE — ed è scritto sotto la cifra, perché "Oggi" usa l'altra
//    convenzione (`/bills/summary/today` toglie la mancia, che è pass-through allo
//    staff). Due schermate con lo stesso numero diverso e nessuna etichetta è il
//    modo più veloce di far perdere fiducia ai conti;
//  • non chiama `/insights/menu` a ogni cambio di periodo senza motivo: quella rotta
//    ha un rate-limit di 10/min per ristorante (insights.ts) e l'aggregazione costa;
//  • non disegna grafici. Su 390 px un grafico a barre di 30 giorni è una striscia
//    illeggibile: le barre qui sono i sette giorni della settimana, in proporzione,
//    e per il resto contano i numeri.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { Badge, Btn, Card, EmptyState, SectionTitle, Skeleton, StatTile, euro } from '../ui/kit'
import { Icon } from '../ui/icons'

interface Dashboard {
  revenue: number
  avgTicket: number
  totalCovers: number
  billsCount: number
  dailyRevenue: { date: string; amount: number }[]
  topItems: { name: string; qty: number; revenue: number }[]
}

type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'unknown'

interface MenuMetric {
  menuItemId: string
  name: string
  totalQty: number
  totalRevenue: number
  marginPercent: number | null
  quadrant: Quadrant
}

interface Insights {
  items: MenuMetric[]
  periodDays: number
  totalRevenue: number
}

// I quattro quadranti della matrice di menu engineering, con il nome che un
// ristoratore userebbe davvero e la mossa che ne consegue. Il gergo inglese
// (star/plowhorse/puzzle/dog) resta il valore del server, non l'etichetta a video.
const QUADRANT: Record<Quadrant, { label: string; move: string; tone: 'ok' | 'wait' | 'info' | 'danger' | 'muted' }> = {
  star: { label: 'Cavalli di battaglia', move: 'Vendono e rendono: tienili in evidenza.', tone: 'ok' },
  plowhorse: { label: 'Molto venduti, poco margine', move: 'Rivedi la porzione o il costo, non il prezzo.', tone: 'wait' },
  puzzle: { label: 'Rendono ma non li ordina nessuno', move: 'Spostali in alto nel menu o falli raccontare in sala.', tone: 'info' },
  dog: { label: 'Non vendono e non rendono', move: 'Candidati a uscire dal menu.', tone: 'danger' },
  unknown: { label: 'Senza food cost', move: 'Metti il costo ingredienti: senza, il margine non si calcola.', tone: 'muted' },
}

const ORDER: Quadrant[] = ['star', 'plowhorse', 'puzzle', 'dog', 'unknown']

/** 'YYYY-MM-DD' nel fuso del telefono: è ciò che il server si aspetta in from/to. */
function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function AndamentoScreen() {
  const { api } = useApp()
  const [days, setDays] = useState<7 | 30>(7)
  const [data, setData] = useState<Dashboard | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const range = useCallback(() => {
    const to = new Date()
    const from = new Date(to.getTime() - (days - 1) * 86400_000)
    return { from: dayKey(from), to: dayKey(to) }
  }, [days])

  const load = useCallback(async () => {
    const { from, to } = range()
    try {
      const d = await api.get<Dashboard>(`/stats/dashboard?from=${from}&to=${to}`)
      setData(d)
      setFailed(false)
    } catch {
      setFailed(true)
      return
    }
    // Il menu engineering è un di più: se la rotta è a rate-limit o il periodo è
    // vuoto, la schermata resta utile lo stesso.
    try {
      setInsights(await api.get<Insights>(`/insights/menu?days=${days}`))
    } catch {
      setInsights(null)
    }
  }, [api, days, range])

  useEffect(() => { void load() }, [load])

  const esporta = async () => {
    const { from, to } = range()
    setBusy(true)
    setMsg(null)
    try {
      const blob = await api.blob(`/api/stats/export?from=${from}&to=${to}`)
      if (!blob) throw new Error('Export non riuscito')
      const filename = `tako-incassi-${from}_${to}.csv`
      const file = new File([blob], filename, { type: 'text/csv' })

      // Web Share API con file: sul telefono è la strada giusta — il CSV finisce
      // in WhatsApp, in Mail o in File senza passare da una cartella Download che
      // su iOS è scomoda da raggiungere. `canShare({files})` va chiesto PRIMA:
      // Safari espone `share` anche dove i file non li accetta, e senza il
      // controllo la chiamata fallisce dopo aver già consumato il gesto utente.
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: filename })
        setMsg({ tone: 'ok', text: 'Export condiviso.' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        // Il revoke immediato annulla il download su alcuni browser: un giro di
        // event loop non basta, un minuto sì e non trattiene memoria a lungo.
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        setMsg({ tone: 'ok', text: `Scaricato ${filename}` })
      }
    } catch (e) {
      // L'utente che chiude il foglio di condivisione non è un errore.
      if ((e as { name?: string })?.name === 'AbortError') setMsg(null)
      else setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Export non riuscito' })
    } finally {
      setBusy(false)
    }
  }

  if (!data && failed) {
    return <EmptyState icon="stats" title="Andamento non disponibile" sub="L'appliance non risponde: riprova quando torni in sala." />
  }
  if (!data) {
    return (
      <div className="ow-stack">
        <Skeleton height={44} />
        <div className="ow-grid-2"><Skeleton height={108} /><Skeleton height={108} /><Skeleton height={108} /><Skeleton height={108} /></div>
      </div>
    )
  }

  const maxDay = Math.max(1, ...data.dailyRevenue.map((d) => d.amount))
  const byQuadrant = new Map<Quadrant, MenuMetric[]>()
  for (const i of insights?.items ?? []) {
    const list = byQuadrant.get(i.quadrant) ?? []
    list.push(i)
    byQuadrant.set(i.quadrant, list)
  }

  return (
    <div className="ow-stack">
      <div className="ow-seg-scroll">
        {([7, 30] as const).map((d) => (
          <button key={d} type="button" className="press ow-chip" data-on={days === d ? '1' : '0'} onClick={() => setDays(d)}>
            {d} giorni
          </button>
        ))}
      </div>

      <div className="ow-grid-2">
        <StatTile label={`Incasso ${days} gg`} value={euro(data.revenue)} icon="banknote" sub="mance incluse" />
        <StatTile label="Ticket medio" value={euro(data.avgTicket)} icon="stats" accent="var(--ok)" sub={`${data.billsCount} conti`} />
        <StatTile label="Coperti" value={String(data.totalCovers)} icon="user" accent="var(--info)" />
        <StatTile
          label="Per coperto"
          value={euro(data.totalCovers ? data.revenue / data.totalCovers : 0)}
          icon="coins"
          accent="var(--wait)"
        />
      </div>

      {data.dailyRevenue.length > 0 && (
        <Card pad={16}>
          <SectionTitle>Ultimi 7 giorni</SectionTitle>
          <div className="ow-bars">
            {data.dailyRevenue.map((d) => (
              <div key={d.date} className="ow-bar-col">
                <div className="ow-bar" style={{ height: `${Math.max(3, (d.amount / maxDay) * 100)}%` }} data-zero={d.amount === 0 ? '1' : '0'} />
                <span className="ow-bar-day">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.topItems.length > 0 && (
        <Card pad={16}>
          <SectionTitle>Più venduti</SectionTitle>
          {data.topItems.slice(0, 8).map((t) => (
            <div key={t.name} className="ow-kv">
              <span>{t.name}</span>
              <b className="num">{t.qty} · {euro(t.revenue)}</b>
            </div>
          ))}
        </Card>
      )}

      {insights && insights.items.length > 0 && (
        <Card pad={16}>
          <SectionTitle right={<Badge tone="muted">{insights.periodDays} gg</Badge>}>Che cosa tenere a menu</SectionTitle>
          {ORDER.filter((q) => byQuadrant.has(q)).map((q) => {
            const meta = QUADRANT[q]
            const list = byQuadrant.get(q)!
            return (
              <div key={q} className="ow-quad">
                <div className="ow-quad-head">
                  <Badge tone={meta.tone} dot>{meta.label}</Badge>
                  <span className="num">{list.length}</span>
                </div>
                <p className="ow-muted">{meta.move}</p>
                {list.slice(0, 4).map((i) => (
                  <div key={i.menuItemId} className="ow-kv">
                    <span>{i.name}</span>
                    <b className="num">{i.totalQty} · {i.marginPercent != null ? `${i.marginPercent}%` : '—'}</b>
                  </div>
                ))}
                {list.length > 4 && <p className="ow-muted">e altri {list.length - 4}.</p>}
              </div>
            )
          })}
        </Card>
      )}

      <Card pad={16}>
        <SectionTitle>Export</SectionTitle>
        <p className="ow-muted">
          Un CSV con un rigo per giorno — conti, coperti, incasso, mance, sconti — e i piatti venduti.
          Si apre in Excel e in Numbers, e da qui si manda com&apos;è al commercialista.
        </p>
        {msg && (
          <div className={msg.tone === 'ok' ? 'ow-warn ow-warn-ok' : 'ow-enroll-err'} style={{ marginTop: 10 }}>
            <Icon name={msg.tone === 'ok' ? 'check' : 'alert'} size={16} />
            {msg.text}
          </div>
        )}
        <Btn kind="brand" icon="share" full disabled={busy} onClick={() => void esporta()} style={{ marginTop: 12 }}>
          {busy ? 'Preparo il file…' : `Esporta ${days} giorni`}
        </Btn>
      </Card>
    </div>
  )
}
