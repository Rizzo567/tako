// "Altro": tutto ciò che non è servizio — stato della connessione, dispositivo,
// scollegamento. Poco e chiaro: sul telefono l'impostazione che non serve durante
// il servizio è rumore.
import { useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { Badge, Btn, Card, SectionTitle } from '../ui/kit'
import { Icon } from '../ui/icons'
import { NotificheCard } from './notifiche'

interface SystemInfo {
  version?: string
  lanUrl?: string | null
  remoteUrl?: string | null
  tunnel?: { state?: string } | null
}

export function AltroScreen() {
  const { session, net, base, api, logout, recheck } = useApp()
  const [info, setInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    api.get<SystemInfo>('/system/info').then(setInfo).catch(() => setInfo(null))
  }, [api])

  const netLabel = net === 'lan' ? 'Sei nel locale: connessione diretta all\'appliance.'
    : net === 'remote' ? 'Sei fuori dal locale: passi dal tunnel sicuro.'
      : net === 'offline' ? 'L\'appliance non risponde. Vedi gli ultimi dati caricati.'
        : 'Sto scegliendo la via più veloce…'

  return (
    <div className="ow-stack">
      <Card pad={16}>
        <SectionTitle right={<Badge tone={net === 'lan' ? 'ok' : net === 'remote' ? 'wait' : net === 'offline' ? 'danger' : 'muted'} dot>
          {net === 'lan' ? 'In sala' : net === 'remote' ? 'Da remoto' : net === 'offline' ? 'Offline' : 'Verifico'}
        </Badge>}>Connessione</SectionTitle>
        <p className="ow-muted">{netLabel}</p>
        <div className="ow-kv">
          <span>Indirizzo</span>
          <b className="mono">{base || window.location.origin}</b>
        </div>
        {info?.version && (
          <div className="ow-kv"><span>Versione appliance</span><b className="mono">{info.version}</b></div>
        )}
        <Btn kind="soft" size="sm" icon="refresh" onClick={recheck} style={{ marginTop: 12 }}>Ricontrolla la rete</Btn>
      </Card>

      {/* Le notifiche stanno QUI e non in una schermata dedicata: è la sezione che il
          ristoratore apre quando cerca un interruttore, ed è dove il piano (F2, note
          per i task successivi) le aveva già previste. */}
      <NotificheCard />

      <Card pad={16}>
        <SectionTitle>Questo dispositivo</SectionTitle>
        <div className="ow-kv"><span>Ristorante</span><b>{session?.restaurant?.name ?? '—'}</b></div>
        <div className="ow-kv"><span>Utente</span><b>{session?.user?.name ?? '—'}</b></div>
        <div className="ow-kv">
          <span>Collegato fino al</span>
          <b>{session?.expiresAt ? new Date(session.expiresAt).toLocaleDateString() : '—'}</b>
        </div>
        <p className="ow-muted" style={{ marginTop: 10 }}>
          Puoi scollegare questo telefono anche dalla dashboard, in <b>Dispositivi → App
          ristoratore</b>: la revoca ha effetto immediato.
        </p>
        <Btn kind="danger" size="sm" icon="logout" onClick={logout} style={{ marginTop: 12 }}>Scollega questo telefono</Btn>
      </Card>

      <Card pad={16}>
        <SectionTitle>Cosa arriva</SectionTitle>
        <ul className="ow-list-plain">
          <li><Icon name="coins" size={16} /> Magazzino e prezzi dal telefono</li>
          <li><Icon name="qr" size={16} /> Foto dei piatti scattate col telefono</li>
          <li><Icon name="sparkles" size={16} /> L&apos;assistente del ristoratore</li>
        </ul>
      </Card>
    </div>
  )
}
