# Tema «Sobrio» — verifica

Data: 2026-10-10. Branch `codex/tako-webapp`. Riferimento: [RIFERIMENTO-VIDEO.md](RIFERIMENTO-VIDEO.md).

Dove si sceglie: **Impostazioni › Locale › Aspetto › «Tema dell'interfaccia»** (Tako classico / Sobrio). Vale per utente e dispositivo: `localStorage` con chiave `tako-dash-ui:<id utente>` (il server non ha preferenze per utente). Default: classico. Il tema si applica con `data-ui="sobrio"` sul contenitore `.screen`.

Strumenti (tutti headless, nessuna finestra):
- `scripts/qa-screenshots.mjs` + `scripts/qa-screenshot-diff.mjs` (esistenti) — classico prima/dopo.
- `scripts/qa-tema-sobrio.mjs <dir> --ui classico|sobrio` — Panoramica, Impostazioni, Menu, Sala, riquadri rapidi, modale Cassa; desktop 1440 e telefono 390 emulato. Le scritture `/api` sono bloccate.
- `scripts/qa-tema-sobrio-motion.mjs <dir> [--frames]` — sonda per fotogramma (`requestAnimationFrame`: rettangolo e colore del contenitore, opacità e sfocatura del contenuto) più screencast CDP; API di scrittura **mockate in puppeteer** (`request.respond` con 900 ms di attesa, o `abort('failed')` per l'errore di rete). Nessuna scrittura sul Supabase remoto.
- Nota di misura: con `taskpolicy -b` Chrome headless scende a ~20 fps e falsa i tempi; lo script del movimento va eseguito senza QoS di background (dura ~1 minuto) e con i flag anti-throttling che imposta da solo.

## 1. Classico invariato

| confronto | esito |
|---|---|
| `qa-screenshots` (18 schermate) codice 091663a vs codice finale | 17 identiche; `customer-menu-mobile` 44 px (0,003 %) in `apps/web`, non toccato → rumore |
| `qa-tema-sobrio --ui classico` (home, menu, sala, modale Cassa: 8 schermate) | identiche tranne `sala-mobile` 10.956 px |
| controprova del rumore: due catture **dello stesso codice vecchio** | `staff-home-mobile` 35.976 px, `sala-mobile` 10.956 px: stesse differenze, ≤ 3 livelli per canale, solo sotto le superfici con `backdrop-filter` (barra in basso, intestazione mobile) e sugli angoli antialias |
| `impostazioni-*` | **differenza voluta**: nuova scheda «Tema dell'interfaccia» in cima ad Aspetto (unica modifica visibile del classico) |

Per avere zero pixel anche sui pulsanti, `Btn`/`IconBtn`/`Badge` nel classico usano gli stili letterali di prima; le varianti a token valgono solo con `UiCtx = "sobrio"`.

## 2. Sobrio accanto al video

| file | contenuto |
|---|---|
| `fotogrammi/confronto-riquadri.png` | video (riquadro aperto e card di successo, riportati a scala CSS 1/2,6) accanto a Comanda, Nuovo conto e card di successo di Tako |
| `fotogrammi/sobrio-desktop.png` | Panoramica (sidebar inclusa), Impostazioni › Aspetto, modale Cassa › Nuovo conto, Menu |
| `fotogrammi/sobrio-mobile.png` | Panoramica, Comanda, Impostazioni, Menu, Sala a 390 px |

Uguale al video: fondo bianco, grigi neutri (#0a0a0a / #525252 / #737373, bordi #e5e5e5, pannelli #fafafa), primario nero pieno a pillola (h 40), secondari bianchi con bordo 1 px a pillola (h 36), chip a pillola (h 28–30), card raggio 24 e pannelli 16, ombra morbida, Inter 400/500/600, colore solo nelle icone e nella spunta verde #15803d, logo arancione solo in alto a sinistra.

## 3. Movimento: video vs Tako

Tempi misurati dalla sonda (60 fps). «Avvio» = primo fotogramma in cui il contenitore si muove. Nel video l'avvio è ~1 fotogramma dopo il rilascio del clic; in Tako **18–26 ms** (render React + primo `requestAnimationFrame`).

| fase | grandezza | video | Tako (Nuovo conto) | Tako (modale Cassa) | Tako (telefono) |
|---|---|---|---|---|---|
| apertura | molla, ω (fit, RMS) | 13,3 (0,008) | 13,7 (0,002) | 13,8 (0,002) | 13,6 (0,002) |
| apertura | 99 % della misura dall'avvio | 499 ms | ≈ 503 ms | ≈ 502 ms | ≈ 504 ms |
| apertura | colore contenitore a +33 / +67 / +100 / +133 ms (0 = colore pulsante, 255 = bianco) | 49 % / 76 % / 89 % / 97 % | 37 % / 68 % / 84 % / 92 % (1 fotogramma di sonda in ritardo) | idem | idem |
| apertura | contenuto 5 % / 50 % / 95 % dall'avvio | ~100 / 116 / ~185 ms | 104 / 120 / 186 ms | 103 / 119 / 186 ms | 104 / 121 / 187 ms |
| successo | molla, ω | 14,3 (0,005) | ≈ 14 (stessa molla, `SizeMorph`) | — | — |
| successo | vecchio contenuto via / nuovo dentro | sfocato in ~60 ms / da +100 ms, pulsanti +166 | sfocato in 60 ms / da +100 ms, pulsanti +166, spunta +250 | — | — |
| chiusura | molla, ω | 13,7 (0,003) | 13,9 (0,003) | 13,9 (0,004) | 14,0 (0,004) |
| chiusura | 99 % dall'avvio | 485 ms | ≈ 498 ms | ≈ 499 ms | ≈ 497 ms |
| chiusura | colore verso il pulsante a +16 / +33 / +67 / +100 ms dal clic | 55 % / 70 % / 84 % / 91 % | 34 % / 58 % / 82 % / 92 % | 34 % / 58 % / 82 % / 95 % | 34 % / 58 % / 82 % / 92 % |
| chiusura | contenuto < 50 % / < 5 % | < 16 / ~55 ms | 31 / 65 ms | 32 / 65 ms | 14 / 64 ms |
| chiusura | etichetta del pulsante ricompare | +80 → +120 ms | +80 → +120 ms | idem | idem |
| pressione | scala | nessuna (< 0,5 %) | nessuna; hover #0a0a0a → #262626 | | |
| pulsante → pagina (Sala live, andata / ritorno) | molla | — (non nel video) | ω 13,9 / 14,0, RMS 0,004 | | |

Fotogrammi affiancati agli stessi millisecondi: `fotogrammi/confronto-apertura.png`, `confronto-chiusura.png`, `confronto-successo.png`, `confronto-modale.png`; transizione verso pagina: `tako-pagina-andata.png`, `tako-pagina-ritorno.png`.

Retargeting (scenario `retarget`): Esc a 60 ms dall'apertura → il contenitore continua per inerzia ~40 ms, si inverte senza salti e torna verso il pulsante; nuovo clic a 420 ms (non ancora chiuso) → riparte dalla misura corrente (136 px) e apre. Nessuna coda, nessun blocco.
Ridotto movimento (`prefers-reduced-motion`): niente contenitore, dissolvenza 120 ms in entrata e in uscita; il pulsante resta visibile.

## 4. Flussi con API mockate

| scenario | atteso | esito |
|---|---|---|
| Nuovo conto: tavolo, coperti, «Apri conto» | «Invio…» con rotellina; card solo dopo la risposta | `POST /api/bills {tableNumber:"QA1",covers:2}`; durante l'attesa «Invio…» (focus resta sul pulsante); card «Conto aperto · Tavolo QA1» con «Vai alla cassa» + «Fatto» (focus su «Fatto»); «Fatto» chiude nel pulsante e il focus torna a «Nuovo conto» |
| Comanda: tavolo, piatto × 2, «Invia in cucina · 2» | card con «Annulla» reale | 1 `POST /api/orders` con `idempotencyKey`; card «Inviata in cucina · Tavolo QA1 · 2 piatti · €24» |
| doppio clic sull'invio | una sola richiesta | 1 sola `POST /api/orders` |
| «Annulla» nella card | annullamento con API esistente | `PATCH /api/orders/mock-order-1/cancel`; il riquadro torna al modulo con i piatti e la nota «Comanda … annullata» |
| errore di rete (Comanda e Nuovo conto) | messaggio, nessuna card | «Connessione non riuscita. Controlla la rete e riprova.» (`role=alert`), nessuna card di successo, pulsante di nuovo attivo e focalizzato |
| Esc | chiude e restituisce il focus | chiuso, focus su «Comanda» / «Nuovo conto» |
| modale Cassa: Tab × 6 | il focus non esce dal riquadro | resta dentro (`focusAfterTabs: true`); Esc chiude, focus sul pulsante |
| telefono: tocco sullo sfondo | chiude | chiuso, focus restituito |
| errori di pagina in console | nessuno | nessun `pageerror`; unico `console.error` un 404 di risorsa già presente nel codice 091663a |

Nuovo conto non ha «Annulla»: nel server non esiste un'API per eliminare o annullare un conto (`/bills` ha solo POST, PATCH sconto/coperti, pagamenti), quindi la card offre «Vai alla cassa».

## 5. Test

- `npx vitest run`: 118 test verdi, 13 file rossi (gli stessi della baseline: vogliono Postgres su :5432).
- `node --test tests/web/*.test.mjs deploy/render/gateway.test.mjs`: 54/54 (aggiornato `staff-build.test.mjs`: 19 sorgenti).
- `tsc --noEmit` server e web: 0 errori.
- Build staff: ok (`release/local-web/staff`), servita dalla webapp in esecuzione.

## 6. Differenze rimaste (non è identico al 100 %)

1. **Latenza d'avvio**: 18–26 ms dal clic al primo fotogramma (video ~16 ms).
2. **Colore in chiusura nei primi due fotogrammi**: 34–58 % contro 55–70 % del video (in parte la sonda legge un fotogramma dopo); da +67 ms coincide.
3. **Volo dell'avatar** dalla griglia all'etichetta (selezione persona, ~230 ms) non c'è: le etichette dei piatti entrano con dissolvenza, sfocatura e leggera scala.
4. **Struttura del riquadro**: il video ha un unico pannello grigio con due righe e separatore; i riquadri Tako hanno due pannelli separati (Tavolo, Coperti) e contenuti propri del gestionale.
5. **Card di successo**: al posto dei tre avatar c'è un disco col numero del tavolo + spunta verde; i pulsanti sono «Vai alla cassa»/«Annulla» e «Fatto».
6. **Velo dello sfondo**: Tako 4 % di nero (serve a staccare il riquadro da una dashboard piena); il video non ne ha.
7. **Pagina che rientra nel pulsante**: il contenuto della pagina sparisce subito (coperto dal contenitore), non con la sfocatura di 60 ms.
8. **Pagine del gestionale**: corpi tipografici di Tako (13–15 px) e non quelli del video (11,5–15); pulsanti e controlli scritti a mano con raggio inline (voci delle Impostazioni, tessere dei tavoli, campi con raggio 11) non diventano pillole: passano a pillola solo quelli che usano `Btn`/`IconBtn`/`Badge`/`.seg` e i nuovi componenti.
9. **Anello di focus** nero da 2 px sui chip selezionati quando il focus arriva da tastiera (assente nel video, che non mostra la tastiera).
10. Velocità della rotellina (0,75 s/giro) stimata, non misurata.
11. «Copia → ✓ Copiato» è applicato al «Copia link» delle schede QR (unico punto di copia con pulsante dedicato); il resto delle copie usa ancora il toast.

## 7. Domande aperte

- Va bene la preferenza solo locale (per utente e per dispositivo)? Per seguire l'utente su più dispositivi serve un campo preferenze nel server (fuori perimetro: nessun endpoint inventato).
- Si vuole un endpoint di annullamento del conto appena aperto, così anche «Nuovo conto» può offrire «Annulla» come il video?
- Il velo del 4 % dietro i riquadri si toglie del tutto, come nel video?
