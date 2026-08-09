// Staff e turni — chi c'è adesso, chi timbra, chi non entra più.
//
// Il piano (§5 F5.3) chiede tre cose: vedere chi è in turno, timbrare entrata e
// uscita per un membro, attivare o disattivare un account. Le rotte esistono già
// tutte (`shifts.ts`, `staff.ts`) e non cambiano. Le scelte di forma:
//
//  • **Chi è in turno sta in cima.** La domanda che si fa dal telefono è «chi c'è
//    adesso in sala», non «quanti dipendenti ho». Gli altri vengono dopo, e chi è
//    disattivato scende in fondo sbiadito.
//  • **Timbrare è UN tap dalla lista**, non dentro un foglio: `Altro → Staff →
//    Entrata` sono tre gesti, ed è la cosa che si fa due volte al giorno per
//    persona. Il foglio serve al resto (ruolo, contatti, account).
//  • **Disattivare un account è un'azione da titolare e si dice cosa fa.** Il
//    server, oltre a mettere `active = false`, CANCELLA tutte le sessioni di quel
//    membro (`staff.ts`): il suo tablet in sala si scollega all'istante. Un
//    bottone che non lo dicesse sarebbe una trappola a metà servizio, quindi
//    l'avviso sta sopra il bottone, visibile PRIMA del tap.
//  • **Il proprio account non si tocca da qui**: disattivarsi da soli significa
//    perdere la sessione del telefono che si sta usando.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import { Badge, Btn, Card, EmptyState, SectionTitle, Skeleton } from '../ui/kit'
import { Icon } from '../ui/icons'

interface Member {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  lastLoginAt: string | null
  phone: string | null
}

interface Shift {
  id: string
  userId: string
  startsAt: string
  endsAt: string | null
  role: string | null
  userName: string
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'titolare',
  cassiere: 'cassa',
  chef: 'cucina',
  dipendente: 'sala',
}

/** "2h 12′" — da quanto è aperto il turno. Il ristoratore ragiona in durate. */
function durata(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `${min}′`
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}′`
}

function iniziali(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function StaffScreen() {
  const { api, session } = useApp()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<Member | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, active] = await Promise.all([
        api.get<Member[]>('/staff'),
        api.get<Shift[]>('/shifts/active'),
      ])
      setMembers(list)
      setShifts(active)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [api])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  // Si timbra anche dalla dashboard e dagli altri telefoni: la lista deve seguire
  // il turno di chi ha appena strisciato, non l'ultimo caricamento.
  useLiveEvent('shift:updated', () => { void load() })

  const shiftByUser = useMemo(() => new Map(shifts.map((s) => [s.userId, s])), [shifts])

  /**
   * Timbratura. È l'unica azione della lista, e ha un solo modo di fallire che vale
   * la pena mostrare: 409 ALREADY_CLOCKED_IN / 404 NOT_CLOCKED_IN, cioè "qualcun
   * altro ha già timbrato per lui". Il messaggio del server lo dice meglio di noi.
   */
  const timbra = async (m: Member, verso: 'in' | 'out') => {
    if (busy) return
    setBusy(m.id)
    setErr(null)
    try {
      await api.post(`/shifts/clock-${verso}`, { userId: m.id })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Timbratura non riuscita')
    } finally {
      setBusy(null)
    }
  }

  if (!members && failed) {
    return <EmptyState icon="user" title="Staff non disponibile" sub="L'appliance non risponde: riprova quando torni in sala." />
  }
  if (!members) {
    return <div className="ow-stack"><Skeleton height={44} /><Skeleton height={220} /></div>
  }

  // In turno prima, poi chi può ancora entrare, infine gli account spenti.
  const ordered = [...members].sort((a, b) => {
    const rank = (m: Member) => (shiftByUser.has(m.id) ? 0 : m.active ? 1 : 2)
    return rank(a) - rank(b) || a.name.localeCompare(b.name)
  })
  const inTurno = shifts.length

  return (
    <div className="ow-stack">
      <SectionTitle right={<Badge tone={inTurno > 0 ? 'ok' : 'muted'} dot>{inTurno > 0 ? `${inTurno} in turno` : 'nessuno in turno'}</Badge>}>
        Squadra
      </SectionTitle>

      {err && <div className="ow-warn"><Icon name="alert" size={16} />{err}</div>}

      {ordered.length === 0 ? (
        <EmptyState icon="user" title="Nessun membro" sub="I membri dello staff si creano dalla dashboard, in Impostazioni → Staff." />
      ) : (
        <Card pad={0}>
          {ordered.map((m) => {
            const shift = shiftByUser.get(m.id)
            return (
              <div key={m.id} className="ow-staff-row" data-on={shift ? '1' : '0'} data-active={m.active ? '1' : '0'}>
                <button type="button" className="press ow-staff-main" onClick={() => setOpen(m)}>
                  <span className="ow-staff-ava" data-on={shift ? '1' : '0'}>{iniziali(m.name)}</span>
                  <span className="ow-staff-txt">
                    <span className="ow-staff-name">{m.name}</span>
                    <span className="ow-staff-sub">
                      {ROLE_LABEL[m.role] ?? m.role}
                      {shift ? ` · in turno da ${durata(shift.startsAt)}` : m.active ? '' : ' · account disattivato'}
                    </span>
                  </span>
                </button>
                {m.active && (
                  <button
                    type="button"
                    className="press ow-staff-clock"
                    data-act={shift ? 'clock-out' : 'clock-in'}
                    disabled={busy === m.id}
                    onClick={() => void timbra(m, shift ? 'out' : 'in')}
                  >
                    <Icon name={shift ? 'logout' : 'check'} size={16} stroke={2.4} />
                    {shift ? 'Uscita' : 'Entrata'}
                  </button>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {open && (
        <MembroSheet
          membro={open}
          shift={shiftByUser.get(open.id) ?? null}
          isSelf={session?.user?.id === open.id}
          isOwner={session?.user?.role === 'owner'}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); void load() }}
        />
      )}
    </div>
  )
}

/**
 * Il foglio del membro: contatti, turno aperto, e l'interruttore dell'account —
 * che è l'unica cosa qui dentro che può cambiare la serata di qualcun altro.
 */
function MembroSheet({ membro, shift, isSelf, isOwner, onClose, onDone }: {
  membro: Member
  shift: Shift | null
  isSelf: boolean
  isOwner: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { api } = useApp()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      await fn()
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita')
      setBusy(false)
    }
  }

  const setActive = (active: boolean) => run(() => api.patch(`/staff/${membro.id}`, { active }))
  const timbra = (verso: 'in' | 'out') => run(() => api.post(`/shifts/clock-${verso}`, { userId: membro.id }))

  return (
    <div className="ow-sheet-wrap" onClick={onClose}>
      <div className="ow-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Membro ${membro.name}`}>
        <div className="ow-sheet-grip" />
        <div className="ow-sheet-head">
          <h2>{membro.name}</h2>
          <button type="button" className="press ow-icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="ow-sheet-body">
          <div className="ow-kv"><span>Ruolo</span><b>{ROLE_LABEL[membro.role] ?? membro.role}</b></div>
          <div className="ow-kv"><span>Email</span><b>{membro.email}</b></div>
          {membro.phone && <div className="ow-kv"><span>Telefono</span><b>{membro.phone}</b></div>}
          <div className="ow-kv">
            <span>Turno</span>
            <b>{shift ? `aperto da ${durata(shift.startsAt)}` : 'nessun turno aperto'}</b>
          </div>
          <div className="ow-kv">
            <span>Ultimo accesso</span>
            <b>{membro.lastLoginAt ? new Date(membro.lastLoginAt).toLocaleDateString() : 'mai'}</b>
          </div>

          {membro.active && (
            <div className="ow-row-btns">
              <Btn
                kind={shift ? 'soft' : 'ok'}
                size="md"
                icon={shift ? 'logout' : 'check'}
                act={shift ? 'sheet-clock-out' : 'sheet-clock-in'}
                disabled={busy}
                onClick={() => void timbra(shift ? 'out' : 'in')}
              >
                {shift ? 'Timbra uscita' : 'Timbra entrata'}
              </Btn>
            </div>
          )}

          {/* L'interruttore dell'account. Sta in fondo, dopo tutto il resto, e non
              esiste per chi non è titolare né per sé stessi. */}
          <div className="ow-staff-acct">
            <SectionTitle>Account</SectionTitle>
            {!isOwner ? (
              <p className="ow-muted">Solo il titolare può attivare o disattivare un account.</p>
            ) : isSelf ? (
              <p className="ow-muted">Questo sei tu: disattivarti chiuderebbe la sessione di questo telefono.</p>
            ) : membro.active ? (
              <>
                <div className="ow-warn">
                  <Icon name="alert" size={16} />
                  Disattivando scolleghi <b>subito</b> tutti i suoi dispositivi: tablet e telefono
                  smettono di funzionare a metà servizio e dovrà rientrare da capo.
                </div>
                <Btn kind="danger" size="md" icon="logout" act="deactivate" disabled={busy} onClick={() => void setActive(false)}>
                  Disattiva l&apos;account
                </Btn>
              </>
            ) : (
              <>
                <p className="ow-muted">L&apos;account è spento: non può accedere da nessun dispositivo.</p>
                <Btn kind="ok" size="md" icon="check" act="activate" disabled={busy} onClick={() => void setActive(true)}>
                  Riattiva l&apos;account
                </Btn>
              </>
            )}
          </div>

          {err && <div className="ow-warn" style={{ marginTop: 12 }}><Icon name="alert" size={16} />{err}</div>}
        </div>
      </div>
    </div>
  )
}
