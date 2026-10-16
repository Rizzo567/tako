# Contratto movimento — Preset settimanali (Feature 2, barra «Piatti»)

Prototipo standalone, dati finti, 16/10/2026. Fonti: `brain/design/menusmart/DESIGN.md`, `motion.tokens.json` (copiato 1:1 in `motion-tokens.js`), `AGENTS.md` del repo. Aspetto da `13-menu-workspace.js` e `menu-workspace.css` (`.mw-studio-toolbar`, `.mw-menu-picker`, `.mw-studio-toolbuttons`, `.mw-catalog-*`).

## Reference e primitive
- **M06 surface-expand:** il vassoio dei preset e la lista sono un'unica superficie persistente. La lista scende di `tray-h + 12px` solo con `transform` (surface 340, easing `out`). Il contenuto (i chip) entra dopo +60ms. In chiusura escono prima i chip (exit 220, easing `exit`), poi la lista risale (surface 340, +60ms).
- **M01 mode-switch:** l'etichetta del pulsante («Preset» → «Lunedì») cambia con un fade di 140ms a +40ms e un blur di 3px solo durante lo scambio. A riposo il testo resta nitido.
- **M09/M03:** chip con stato `aria-current` e roving tabindex. Stagger dei chip di 24ms, limitato ai primi 5.
- **M02:** dropdown del selettore Menu (apertura con micro/standard, chiusura con exit).
- **M06 per il dialogo «Salva o scarta»:** in entrata prima la superficie (surface) e poi il contenuto (micro, +60ms). In uscita prima il contenuto (micro) e poi la superficie (exit, +60ms).
- **M05 async-action:** «Salva» mostra un pending reale (`aria-busy`). Il successo arriva solo dopo la risposta del backend simulato.
- **Token usati:** press 90, micro 140, standard 280, surface 340, exit 220, data 600 (rotazione dello spinner); easing `out`/`exit`; distanze micro 6 e panel 12; stagger 24. Non c'è nessuna durata locale. I ritardi +60/+40 vengono dalle ricette M06/M01 di DESIGN.md e sono dichiarati in `recipeDelayMs`.
- **Primitive:** il prototipo usa CSS transitions e WAAPI. Per l'integrazione vanno usati `window.TakoMenuMotion` (già letto dalla dashboard) e il pattern FLIP già presente in `13-menu-workspace.js`.

## Stati
| Stato | Comportamento | Token/ricetta | Verifica |
|---|---|---|---|
| Entrata (tap Preset) | `aria-expanded=true`; la lista scivola in basso; entra il contenitore grigio e poi i chip Lun–Dom, «Venerdì pesce», «+ Nuovo», «Menu attuale». Ven ha il segno «oggi», Gio ha «● online» | surface 340; chip micro/standard +60, stagger 24 | Video + check «apertura», «segni oggi/online» |
| Aggiornamento (scelta giorno) | I chip non scelti escono, quello scelto resta finché la lista lo ricopre. Il pulsante diventa «Lunedì ▾» e il contenuto cambia con un crossfade del solo contenuto: il contenitore della lista non sparisce mai | exit 220; surface 340 +60; M01 140 +40 | Check «scelta Lunedì», fotogrammi a 10 fps |
| Riapertura / Esc / tap fuori | Si riapre dal pulsante. Esc o un tap fuori chiudono senza cambiare. Con Esc il focus torna al pulsante | come sopra | Check «Esc», «tap fuori» |
| Tap rapidi | Nessun lock e nessuna coda: ogni gesto cambia subito lo stato e la transizione riparte dal valore corrente. Se la chiusura interrompe un'apertura, il ritardo di +60 viene annullato e l'inversione è immediata | CSS transition retarget | Prova diretta: a ogni tap, primo keyframe della nuova CSSTransition = valore corrente (es. 20,7→20,7; 124,1→124,1) |
| Pending | «Salva» → spinner + «Salvo…», `aria-busy`, nessun doppio invio | M05; data 600 per lo spinner | Check «pending reale» |
| Success | Solo dopo la risposta: chiude il dialogo, toast «Salvato…» e poi esegue il cambio di preset richiesto | M06 uscita, M12 toast | Check «Salva → Giovedì» |
| Error | `?fail=1`: il primo salvataggio fallisce. Compare il messaggio `role=alert`, il dialogo resta aperto, la bozza è conservata e il secondo tentativo riesce | — | Video tastiera, check «errore» e «riprova» |
| Salva o scarta | Con modifiche non salvate, il cambio di preset (o di menu) apre il dialogo. Scarta butta la bozza e procede. Annulla/Esc non cambia nulla e il focus torna al chip | M06 | Check dedicati |
| Reduced motion | Nessuno scorrimento, nessun blur e nessuno stagger: stato finale immediato. Durate a 0 tramite token (spinner statico) | `reducedMotion` dei token | Check: lista a fine corsa già dopo 40ms |
| Vuoto | «Domenica» vuota: testo esplicito, nessun reveal | — | Check «preset vuoto» |
| Menu unico (Drinks) | Il pulsante Preset non c'è. Tornando a Pranzo ricompare e la vista scelta è conservata | micro | Check dedicati |

Stato non applicabile: **drag e riordino dei chip**, perché la spec non lo prevede per i preset.

## Verifica
- [x] Registrazione del ciclo reale: 6 mp4 H.264 a 30 fps (Chrome headless, puppeteer-core). I check automatici sono in `video/*-checks.json`, in totale 108/108 PASS
- [x] Tastiera, focus ed Escape: Tab, Invio, frecce, Home/End, Freccia giù per aprire, Esc, Tab che esce dal vassoio e lo chiude, dialogo con focus su Salva ed Esc = Annulla
- [~] Touch/mobile: viewport 500×900 con touch **emulato** da CDP (`touchscreen.tap`). Nessun dispositivo reale
- [x] Reduced motion (emulato con `prefers-reduced-motion: reduce`)
- [~] Click rapidi e retargeting: provato con la lettura dei keyframe sul desktop (2 tap a metà corsa). Su mobile, con i tap touch più lenti, è stato catturato solo 1 campione in volo
- [~] Errore e conservazione dei dati: verificati. **Rete lenta** non provata oltre i 700ms di latenza simulata
- [~] Resize e testo lungo: «Venerdì pesce» va a capo bene e l'etichetta del pulsante ha l'ellissi. Il resize a pannello aperto non è stato registrato (`--tray-h` si aggiorna con ResizeObserver, ma non è verificato in video)
- [x] Nessun blur a riposo e nessuno scroll orizzontale (check `scrollWidth`)
- [ ] Performance: non misurata. La traccia headless è rada (fotogrammi a 30–50ms durante lo screencast), quindi non è una misura del budget 16,7ms
- [x] Cleanup: callback obsolete scartate con contatori di epoca, animazioni annullate prima di ripartire, nessun processo residuo dopo i test

## Limiti e deviazioni
- **Prototipo, non integrazione:** non tocca `apps/`. Non comprende rinomina/eliminazione, scelta «vuoto / copia di un giorno» su «+ Nuovo» (oggi crea una copia del menu attuale), interruttore dell'automatico né «Rendi settimanale».
- Ritardo di chiusura adattivo (+60ms solo se il vassoio era fermo aperto): è un'estensione della regola «contenuto prima del collasso», necessaria perché il ritardo non assorba il retargeting.
- L'etichetta «Preset» indica che si sta guardando il menu attuale, come da spec. Valutare «Menu attuale ▾» se in test con i titolari crea dubbi.
- Il contenitore della lista cambia altezza in modo istantaneo quando il preset ha un numero di piatti diverso, oppure è vuoto. Non c'è un FLIP dell'altezza: da aggiungere all'integrazione con il pattern FLIP esistente.
- Il cerchio blu nei video è un overlay del test che mostra il punto del tap. Non fa parte del prodotto.
