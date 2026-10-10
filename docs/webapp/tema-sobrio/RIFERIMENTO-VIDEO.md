# Tema «Sobrio» — misure dal video di riferimento

Fonte: `ScreenRecording_10-10-2026 20-01-48_1.MP4` (1290×2796, 60 fps nominali, 15,6 s; registrazione iPhone di un post X, demo «Share "Q3 launch plan"»).
Zona utile ritagliata: x 0–1290, y 467–2080 del frame originale. Fotogrammi estratti tutti (920) con `/opt/homebrew/bin/ffmpeg -fps_mode passthrough`; tempi reali letti dai PTS (la registrazione ha qualche frame doppio, ~33 ms, intorno a 3,0–4,0 s).

Le misure in pixel sono in «px video». **Scala: 1 px CSS ≈ 2,6 px video**, ricavata dai bordi da 1 px (3 px video) e dalla coerenza delle altezze (pulsante principale 104 → 40 px, secondari 92 → 36 px, Copy 77 → 30 px, chip 74 → 28 px).
Avvertenza: la metà inferiore del riquadro è scurita dal gradiente del player di X (fino a −10/−30 livelli sotto y≈1000). I colori sono campionati nella metà alta, o corretti per il gradiente dove indicato.

Fotogrammi chiave in `fotogrammi/`:

| file | contenuto |
|---|---|
| `share-riposo.png` | pulsante «Share» a riposo |
| `apertura-3.64-4.22s.png` | apertura, 16 fotogrammi |
| `card-completa.png` | riquadro aperto, 3 persone selezionate |
| `copia-copiato-5.09-5.39s.png` | Copy → ✓ Copied |
| `selezione-etichetta-6.79-7.09s.png` | selezione persona: etichetta + «Send to 1 person» |
| `invio-sending-10.23-10.46s.png` | «Send to 3 people» → «Sending» con rotellina |
| `successo-11.22-11.89s.png` | il riquadro si restringe nella card di successo |
| `card-successo.png` | card «Sent to Marcus, Jasmine, and 1 other» |
| `chiusura-12.86-13.56s.png` | la card si scurisce e rientra nel pulsante |

## 1. Sequenza del video

| t (s) | evento |
|---|---|
| 0,24–0,60 | (loop del post) riquadro già aperto, conteggio «Send to 2 → 3 people» con la cifra che scorre in verticale |
| 3,65 | clic su «Share» (il cursore era già sopra: colore hover) |
| 3,737 | inizio apertura (≈85 ms dopo la pressione = rilascio del clic) |
| 4,95 / 5,20 | clic «Copy» → «✓ Copied» (verde), rientra in «Copy» a ≈7,10 (≈1,9 s) |
| 6,80 | selezione Marcus: etichetta, «Send» grigio → «Send to 1 person» nero |
| 7,84 / 9,00 | Jasmine (2), Chloe (3) |
| 10,25 / 10,34 | clic invio → «Sending» con rotellina (≈0,9 s di attesa) |
| 11,242 | risposta: il riquadro si restringe nella card di successo |
| 12,79 / 12,877 | clic «Done» → chiusura nel pulsante «Share» |
| ≈13,40 | chiusura ferma |

## 2. Movimento

### 2.1 Curva: molla a smorzamento critico, nessun rimbalzo
Fit ai minimi quadrati di `p(t) = 1 − (1 + ωt)·e^(−ωt)` sui fotogrammi:

| transizione | grandezza misurata | ω (rad/s) | k = ω² | c = 2ω | 99 % a | errore RMS |
|---|---|---|---|---|---|---|
| apertura (pulsante → riquadro) | larghezza 217 → 1000 px | 13,3 | 177 | 26,6 | 499 ms | 0,008 |
| successo (riquadro → card) | bordo superiore 127 → 400 px | 14,3 | 204 | 28,6 | 464 ms | 0,005 |
| chiusura (card → pulsante) | larghezza 712 → 210 px | 13,7 | 188 | 27,4 | 485 ms | 0,003 |

Nessun superamento del valore finale in nessuna delle tre (la larghezza si ferma a 1000–1005 e resta lì). La partenza ha velocità quasi nulla (leggero ease-in nei primi 2–3 fotogrammi), poi una lunga decelerazione. Valore adottato: **ω = 13,8 (massa 1, rigidità 190, smorzamento 27,6)**, durata percepita ≈ 420 ms, quiete a ≈ 480 ms.

### 2.2 Apertura (3,737 → 4,22 s)
1. **Pressione**: nessuna scala apprezzabile (riquadro del pulsante 211×84 px invariato su 4 fotogrammi, < 0,5 %). Unico feedback: hover #0a0a0a → #232323.
2. **+0 ms**: l'etichetta del pulsante (icona + «Share») sparisce in 1–2 fotogrammi; il pulsante diventa il contenitore.
3. **Contenitore**: parte dal rettangolo del pulsante (forma a pillola) e cresce con la molla verso il rettangolo finale. Il centro si sposta dal centro del pulsante (y 624) a quello del riquadro (y ≈ 650): interpolazione del rettangolo, non scala.
4. **Colore del contenitore**: dal colore del pulsante al bianco, curva esponenziale **τ ≈ 48 ms** (49 % a 33 ms, 76 % a 67 ms, 89 % a 100 ms, 97 % a 133 ms). Il contenitore è quindi grigio e vuoto per ~100 ms.
5. **Contenuto**: impaginato già nella posizione finale e rivelato dal contenitore che si allarga (ritaglio, nessuna scala del contenuto). Dissolvenza in entrata da **+100 ms a +200 ms** (50 % a +116 ms, 90 % a +166 ms), senza sfocatura visibile.
6. Ombra presente fin dal primo fotogramma del contenitore.

### 2.3 Successo (11,242 → 11,70 s)
1. Il vecchio contenuto esce **con sfocatura (~4 px CSS) e dissolvenza in ≈ 60 ms**.
2. Il contenitore (stessa card, stesso raggio) si restringe con la molla verso la misura della card di successo, **restando centrato** (centro 654 → 652 px).
3. Il nuovo contenuto entra **sfocato → nitido** con dissolvenza: avatar + titolo da +100 ms (≈ 70 ms), riga secondaria subito dopo, pulsanti da **+166 ms** (≈ 70 ms); passo ≈ 65 ms.
4. Il badge verde ✓ sull'ultimo avatar entra per ultimo (+250 → +320 ms) con dissolvenza e leggera sfocatura.
5. Avviene solo dopo «Sending» (≈ 0,9 s): è la risposta reale che lo innesca.

### 2.4 Chiusura (12,877 → 13,40 s)
1. **+0 ms**: il contenuto si sfoca e sparisce in ≈ 60 ms; contemporaneamente il fondo del contenitore va verso il colore del pulsante (255 → 15) con **τ ≈ 35–45 ms** (55 % a 16 ms, 78 % a 50 ms, 91 % a 100 ms).
2. Il contenitore si ritira con la molla nel rettangolo del pulsante, forma a pillola.
3. L'etichetta «Share» ricompare dentro il contenitore scuro **da +80 a +120 ms**.
4. A riposo il pulsante torna quello di prima (il contenitore è il pulsante).
Nota: il contenuto non sparisce «prima» e poi il colore cambia: le due cose partono insieme, ma il contenuto finisce in 60 ms mentre il ritiro dura ~450 ms, quindi a occhio la sequenza è «contenuto via → contenitore scuro che si ritira».

### 2.5 Microinterazioni
- **Copy → ✓ Copied** (5,20–5,29 s, ≈ 90 ms): la vecchia etichetta sale e si sfoca uscendo, la nuova arriva dal basso sfocata → nitida; il pulsante si allarga alla nuova larghezza. Torna a «Copy» dopo ≈ 1,9 s.
- **Selezione**: l'etichetta del nome appare con dissolvenza+sfocatura (≈ 60 ms), l'avatar «vola» dalla griglia all'etichetta (≈ 230 ms), il fondo dell'etichetta compare alla fine; anello viola e spunta sull'avatar scelto.
- **Pulsante principale**: «Send» (disabilitato, grigio) → «Send to 1 person» (nero): stesso scambio verticale con sfocatura, ≈ 60–80 ms; il fondo passa da grigio a nero nello stesso tempo.
- **Conteggio**: la cifra («2» → «3») scorre in verticale (≈ 0,39–0,46 s nel loop iniziale).
- **Sending**: scambio verticale «Send to 3 people» → «◌ Sending» (≈ 80 ms); rotellina = arco di cerchio che gira (~0,75 s/giro). Il fondo del pulsante resta scuro (#222 corretto, cioè hover).

## 3. Stile

### 3.1 Colori (campionati, scala neutra tipo Tailwind «neutral»)
| ruolo | misurato | token adottato |
|---|---|---|
| fondo pagina | #ffffff | #ffffff |
| fondo card | #ffffff | #ffffff |
| pannello interno (link, permessi) | #f9f9f9 | #fafafa |
| fondo etichetta persona / voce selezionata | #ece9ea (tinta dall'avatar) / #f1f1f1 | #f5f5f5 |
| bordo 1 px (antialias su bianco) | 233–241 → | #e5e5e5 |
| testo principale (titolo, nomi, pulsanti) | #0a0a0a | #0a0a0a |
| testo secondario («Can view and comment», ✕, link) | #4b4b4b–#505050 | #525252 |
| testo terziario («Send to», icone neutre, chevron) | #707070–#727272 | #737373 |
| pulsante primario / «Share» | #0c0c0c–#0e0e0e | #0a0a0a |
| pulsante primario hover / «Sending» | #232323 / #222 | #262626 |
| pulsante disabilitato | ≈ #e5e5e5, testo #737373 (corretto per il gradiente) | #e5e5e5 / #737373 |
| «✓ Copied» | #277649 | #15803d |
| badge ✓ del successo | #006c2c | #15803d (badge pieno, spunta bianca) |
| anello di selezione / icona Email | #6a3cfd / #744ef1 | viola solo nelle icone: in Tako la selezione è nera |

Il colore compare solo nelle icone (Slack, Email, X) e nella spunta verde.

### 3.2 Raggi
| elemento | misurato (px video) | px CSS |
|---|---|---|
| card / riquadro | r ≈ 64 (fit su profilo dell'angolo) | **24** |
| pannello interno | r ≈ 40 | **16** |
| pulsanti (Share, Email, Copy, Send, Undo, Done) | r = metà altezza | **pillola** |
| etichette persona | metà altezza | **pillola** |
| campo di input | non c'è un input libero; il «campo» link è il pannello da 16 | 12 (estrapolato) |

### 3.3 Misure (px CSS)
- Riquadro: 347 × 406. Rientro dei blocchi dal bordo: ~7 px; titolo a ~15 px dal bordo.
- Altezze: «Share» 32; primario («Send») 40; secondari (Email/Slack/X, Undo/Done) 36; Copy 30; etichette 28; avatar 37.
- Card successo: 274 × 195; pulsanti 36 a pillola, affiancati a tutta larghezza.
- Spaziature verticali principali: header 51; pannello 90 (due righe 43 + 46, separatore 1 px); riga pulsanti 36; separatore a +13; etichetta «Send to» 12 → chip.

### 3.4 Ombre e bordi
- Bordo card 1 px #e5e5e5 (a volte appena visibile, sembra `0 0 0 1px rgba(0,0,0,.06)`).
- Ombra card molto morbida, ~35 px di diffusione: −17 livelli ai lati, −29 sotto con scostamento → `0 1px 2px rgba(0,0,0,.04), 0 12px 32px -6px rgba(0,0,0,.12)`.
- Pulsanti secondari: bordo 1 px #e5e5e5, nessuna ombra. Primario: nessuna ombra colorata.

### 3.5 Tipografia
Il carattere è **Inter** (forme di «a», «g», «Q», «3» riconoscibili). Altezze maiuscole → corpo:

| testo | cap height (px video) | corpo CSS | peso | colore |
|---|---|---|---|---|
| titolo «Share "Q3 launch plan"» | 28 | 15 | 500–600 | #0a0a0a |
| titolo successo «Sent to Marcus…» | 28 | 15 | 500 | #0a0a0a |
| righe principali («Anyone at Northwind», nomi etichette, pulsanti) | 24–25 | 13 | 500 | #0a0a0a |
| secondarie («Can view and comment», sottotitolo successo) | 21 | 11,5–12 | 400 | #525252 |
| etichette di sezione («Send to»), nomi sotto avatar | 20–21 | 11,5 | 400 | #737373 / #525252 |

In Tako i corpi del gestionale restano quelli attuali (13–15 px); i riquadri rapidi della Panoramica usano i corpi del video arrotondati in su a 12/13/15 px per leggibilità.

## 4. Cosa non si ricava dal video
- Stato di errore («Send fails» esiste nella demo ma non viene mostrato).
- Comportamento con tastiera, touch, ridimensionamento: nessun dato, si applicano le regole generali (focus trap, Esc, retargeting).
- Overlay/oscuramento dello sfondo: nel video non c'è velo; il fondo è il bianco della demo.
- Transizione «pulsante → pagina intera»: il video mostra solo pulsante → riquadro; per le pagine si estende la stessa primitiva.
