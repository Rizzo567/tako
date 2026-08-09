// Menu — disponibilità e prezzo dal telefono.
//
// Il goal del piano (§5 F4.2) è una frase sola: «finito il branzino» si risolve in
// 3 tap. Il conto, dall'apertura dell'app:
//
//   1. «Altro»   2. «Menu»   3. la pastiglia della disponibilità sulla riga
//
// Quindi la pastiglia STA sulla riga e commuta al tocco: nessun foglio da aprire,
// nessuna conferma. È l'azione più frequente e la più urgente — si fa mentre il
// cuoco lo sta ancora dicendo — e il menu del cliente si aggiorna da solo, perché
// `menu:item_availability` è già emesso anche sulla room pubblica `menu:{id}`
// (routes/menu.ts) e `GET /api/customer/.../menu` filtra su `available`.
//
// Il prezzo, che invece si cambia una volta a stagione, sta dietro un tap in più.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import { resizeForUpload } from '../lib/photo'
import { Badge, Btn, Card, EmptyState, Skeleton, euro } from '../ui/kit'
import { Icon } from '../ui/icons'

interface Item {
  id: string
  sectionId: string
  name: string
  price: number
  available: boolean
  imageUrl: string | null
}

interface Section {
  id: string
  name: string
  position: number
  active: boolean
  items: Item[]
}

interface MenuHead {
  id: string
  name: string
  active: boolean
  position: number
}

/**
 * Miniatura del piatto.
 *
 * IN SALA (LAN) l'`<img src>` punta al file e basta: `/uploads/*` è servito senza
 * gate. DA REMOTO no — una richiesta di immagine è una navigazione del browser e non
 * porta l'header Authorization, quindi il gate del tunnel (F1.3) risponde 404 e la
 * foto non si vede. Lì si passa da `api.blobUrl()`, che scarica con fetch + Bearer.
 * Il blob URL si revoca all'uscita: senza, un menu lungo sfoglia decine di MB.
 */
function DishThumb({ url, onPick, busy }: { url: string | null; onPick: () => void; busy: boolean }) {
  const { api, remote } = useApp()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!url) { setSrc(null); return }
    if (!remote) { setSrc(api.url(url)); return }
    let revoke: string | null = null
    let alive = true
    void api.blobUrl(url).then((b) => {
      if (!alive) { if (b) URL.revokeObjectURL(b); return }
      revoke = b
      setSrc(b)
    })
    return () => {
      alive = false
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [api, url, remote])

  return (
    <button
      type="button"
      className="press ow-thumb"
      data-has={src ? '1' : '0'}
      onClick={onPick}
      disabled={busy}
      aria-label={url ? 'Cambia la foto del piatto' : 'Scatta la foto del piatto'}
    >
      {busy
        ? <span className="ow-spin" style={{ width: 18, height: 18 }} />
        : src
          ? <img src={src} alt="" />
          : <Icon name="camera" size={18} stroke={2.1} />}
    </button>
  )
}

export function MenuScreen() {
  const { api } = useApp()
  const [menus, setMenus] = useState<MenuHead[] | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [onlyOut, setOnlyOut] = useState(false)
  const [edit, setEdit] = useState<Item | null>(null)
  // Le righe già commutate localmente: l'interfaccia risponde al dito subito e la
  // riga resta coerente anche prima che il fetch di conferma torni.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  // Foto (F4.3): un solo <input file> per tutta la schermata, riusato — il piatto a
  // cui appartiene lo scatto sta nel ref, non nel DOM.
  const fileRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [photoMsg, setPhotoMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    api.get<MenuHead[]>('/menus')
      .then((all) => {
        setMenus(all)
        setMenuId((cur) => cur ?? (all.find((m) => m.active) ?? all[0])?.id ?? null)
      })
      .catch(() => setFailed(true))
  }, [api])

  const load = useCallback(async () => {
    if (!menuId) return
    try {
      const full = await api.get<{ sections: Section[] }>(`/menus/${menuId}`)
      setSections(full.sections ?? [])
      setPending({})
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [api, menuId])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  // Un secondo telefono (o la dashboard) che cambia una voce deve vedersi qui: è lo
  // stesso evento che riceve il cliente al tavolo.
  useLiveEvent('menu:item_availability', () => { void load() })
  useLiveEvent('menu:updated', () => { void load() })

  const toggle = async (item: Item) => {
    const next = !(pending[item.id] ?? item.available)
    setPending((p) => ({ ...p, [item.id]: next }))
    try {
      await api.patch(`/menus/items/${item.id}/availability`, { available: next })
    } catch {
      // Rimbalzo allo stato vero: mostrare "finito" quando il cliente lo vede ancora
      // a menu è il modo più veloce di perdere fiducia nell'app.
      setPending((p) => ({ ...p, [item.id]: item.available }))
    }
  }

  const pickPhoto = (itemId: string) => {
    targetRef.current = itemId
    setPhotoMsg(null)
    // Lo stesso input riusato: senza azzerare `value`, riscegliere LO STESSO file non
    // fa scattare `change` e il ristoratore crede che l'app si sia piantata.
    if (fileRef.current) fileRef.current.value = ''
    fileRef.current?.click()
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const itemId = targetRef.current
    if (!file || !itemId) return
    setUploading(itemId)
    setPhotoMsg(null)
    try {
      const { blob, filename, shrunk, width, height } = await resizeForUpload(file)
      const out = await api.upload<{ imageUrl: string; styled: boolean }>(`/menus/items/${itemId}/photo`, blob, filename)
      setPhotoMsg({
        tone: 'ok',
        text: out.styled
          ? 'Foto migliorata dall\'AI e messa a menu.'
          : shrunk
            ? `Foto messa a menu (ridotta a ${width}×${height}).`
            : 'Foto messa a menu.',
      })
      await load()
    } catch (err) {
      setPhotoMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Foto non caricata' })
    } finally {
      setUploading(null)
      targetRef.current = null
    }
  }

  if (!menus && failed) {
    return <EmptyState icon="menu" title="Menu non disponibile" sub="L'appliance non risponde: riprova quando torni in sala." />
  }
  if (!menus || !sections) {
    return <div className="ow-stack"><Skeleton height={44} /><Skeleton height={220} /><Skeleton height={160} /></div>
  }
  if (!menus.length) {
    return <EmptyState icon="menu" title="Nessun menu" sub="I menu si creano dalla dashboard, anche importandoli da un testo." />
  }

  const all = sections.flatMap((s) => s.items.map((i) => ({ ...i, available: pending[i.id] ?? i.available })))
  const outCount = all.filter((i) => !i.available).length
  const visible = (list: Item[]) => list.filter((i) => !onlyOut || !(pending[i.id] ?? i.available))

  return (
    <div className="ow-stack">
      {/* `capture="environment"`: su iPhone e Android apre la fotocamera POSTERIORE
          invece della galleria — il gesto è "fotografo il piatto", non "cerco un
          file". Chi vuole la galleria la raggiunge comunque dal selettore di sistema. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void onPhoto(e)}
      />

      {photoMsg && (
        <div className={photoMsg.tone === 'ok' ? 'ow-warn ow-warn-ok' : 'ow-enroll-err'}>
          <Icon name={photoMsg.tone === 'ok' ? 'check' : 'alert'} size={16} />
          {photoMsg.text}
        </div>
      )}

      {menus.length > 1 && (
        <div className="ow-seg-scroll">
          {menus.map((m) => (
            <button key={m.id} type="button" className="press ow-chip" data-on={m.id === menuId ? '1' : '0'} onClick={() => { setSections(null); setMenuId(m.id) }}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="ow-seg-scroll">
        <button type="button" className="press ow-chip" data-on={onlyOut ? '0' : '1'} onClick={() => setOnlyOut(false)}>
          Tutti · {all.length}
        </button>
        <button type="button" className="press ow-chip" data-on={onlyOut ? '1' : '0'} onClick={() => setOnlyOut(true)}>
          Finiti · {outCount}
        </button>
      </div>

      {onlyOut && outCount === 0 && (
        <EmptyState icon="check" title="Niente è finito" sub="Tutte le voci del menu sono disponibili." />
      )}

      {sections.map((s) => {
        const items = visible(s.items)
        if (!items.length) return null
        return (
          <Card key={s.id} pad={0}>
            <div className="ow-menu-sec">{s.name}</div>
            {items.map((i) => {
              const available = pending[i.id] ?? i.available
              return (
                <div key={i.id} className="ow-menu-row">
                  <DishThumb url={i.imageUrl} busy={uploading === i.id} onPick={() => pickPhoto(i.id)} />
                  <button type="button" className="press ow-menu-main" onClick={() => setEdit(i)}>
                    <span className="ow-menu-name">{i.name}</span>
                    <span className="num ow-menu-price">{euro(i.price)}</span>
                  </button>
                  {/* Il terzo tap. Commuta e basta: nessun foglio, nessuna conferma. */}
                  <button
                    type="button"
                    className="press ow-avail"
                    data-on={available ? '1' : '0'}
                    onClick={() => void toggle(i)}
                    aria-pressed={available}
                    aria-label={`${i.name}: ${available ? 'segna finito' : 'rimetti a menu'}`}
                  >
                    <Icon name={available ? 'check' : 'x'} size={15} stroke={2.6} />
                    {available ? 'A menu' : 'Finito'}
                  </button>
                </div>
              )
            })}
          </Card>
        )
      })}

      {edit && (
        <PrezzoSheet
          item={{ ...edit, available: pending[edit.id] ?? edit.available }}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); void load() }}
        />
      )}
    </div>
  )
}

/** Prezzo (e disponibilità, per chi arriva qui dal nome invece che dalla pastiglia). */
function PrezzoSheet({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const { api } = useApp()
  const [price, setPrice] = useState(String(item.price).replace('.', ','))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    const n = Number(price.replace(',', '.'))
    if (!isFinite(n) || n < 0) { setErr('Prezzo non valido'); return }
    setBusy(true)
    setErr(null)
    try {
      await api.patch(`/menus/items/${item.id}`, { price: Math.round(n * 100) / 100 })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Prezzo non salvato')
      setBusy(false)
    }
  }

  return (
    <div className="ow-sheet-wrap" onClick={onClose}>
      <div className="ow-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.name}>
        <div className="ow-sheet-grip" />
        <div className="ow-sheet-head">
          <h2>{item.name}</h2>
          <button type="button" className="press ow-icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="ow-sheet-body">
          <div className="ow-kv">
            <span>Stato</span>
            <b><Badge tone={item.available ? 'ok' : 'danger'} dot>{item.available ? 'a menu' : 'finito'}</Badge></b>
          </div>
          <label className="ow-field-label" htmlFor="ow-price">Prezzo</label>
          {/* inputMode decimal: sul telefono apre il tastierino, non la tastiera intera. */}
          <input
            id="ow-price"
            className="ow-input"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {err && <div className="ow-enroll-err">{err}</div>}
        </div>
        <div className="ow-sheet-foot">
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full disabled={busy} onClick={() => void save()}>{busy ? 'Salvo…' : 'Salva prezzo'}</Btn>
        </div>
      </div>
    </div>
  )
}
