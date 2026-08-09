// Collegamento del telefono: la prima schermata che il ristoratore vede.
//
// Due strade, entrambe previste dal piano F2.1: il QR scansionato (il codice arriva
// nel fragment dell'URL e l'arruolamento parte da solo) oppure il codice incollato a
// mano — il ripiego previsto dall'Exit, utile quando la fotocamera fa i capricci.
import { useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { enrollDevice, takeEnrollCodeFromUrl } from '../lib/session'
import { Btn, Card, Spinner } from '../ui/kit'
import { Icon } from '../ui/icons'

export function EnrollScreen() {
  const { base, setSession } = useApp()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (value: string) => {
    setBusy(true)
    setError(null)
    try {
      setSession(await enrollDevice(base, value.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Collegamento non riuscito.')
    } finally {
      setBusy(false)
    }
  }

  // QR appena scansionato: il codice è nel fragment, si consuma subito e sparisce
  // dalla barra degli indirizzi.
  useEffect(() => {
    const fromUrl = takeEnrollCodeFromUrl()
    if (fromUrl) void run(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="ow-enroll">
      <div className="ow-enroll-mark"><Icon name="smartphone" size={28} stroke={2.2} /></div>
      <h1>Collega il telefono</h1>
      <p className="ow-enroll-sub">
        Apri Tako sul computer del locale, vai su <b>Dispositivi → App ristoratore</b> e
        inquadra il QR con questo telefono. Devi essere sulla stessa rete WiFi.
      </p>

      {busy && <div className="ow-enroll-busy"><Spinner /> Collego…</div>}

      {!busy && (
        <Card pad={16} style={{ width: '100%' }}>
          <label className="ow-field-label" htmlFor="ow-code">Hai un codice? Incollalo qui</label>
          <input
            id="ow-code"
            className="ow-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="codice di collegamento"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Btn full onClick={() => void run(code)} disabled={code.trim().length < 16} style={{ marginTop: 12 }}>
            Collega
          </Btn>
        </Card>
      )}

      {error && <div className="ow-enroll-err">{error}</div>}
    </div>
  )
}
