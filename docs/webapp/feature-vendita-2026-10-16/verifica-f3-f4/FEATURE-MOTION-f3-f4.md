# Contratto movimento — F3 prezzo promo + F4 scarsità

## Reference e primitive
Pertinenti: M08 (interruttori «Ultime porzioni», «Solo oggi»: checkbox nativi come «Nascondi al cliente» nello stesso drawer, nessun thumb animato nuovo), M12 solo come nota di stato reale. Non pertinenti: M01–M07, M09–M15 (nessuna superficie che cambia forma). Token usato: `micro` 140ms `ease-out` per l'opacità della nota sotto il prezzo promo. Menu pubblico e PDF: **nessun movimento** (richiesta: etichette discrete, niente animazioni pulsanti).

## Stati
| Stato | Comportamento | Token/ricetta | Verifica |
|---|---|---|---|
| Entrata | Campi nel drawer già presenti, nessun reveal | — | registrazioni drawer-* |
| Aggiornamento | Il valore cambia al gesto; segni sulla riga aggiornati nello stesso render | instant | 9 → «Promo 9,00 €» |
| Uscita | Campo vuoto = promo tolta; interruttore spento = etichetta tolta | instant | «campo vuoto: promo tolta» |
| Pending | Non applicabile: il salvataggio resta quello del drawer (bottone esistente) | — | — |
| Success | Solo il salvataggio reale del drawer; nessun check finto | — | — |
| Error | Promo ≥ prezzo pieno o ≤ 0: `aria-invalid`, nota in `aria-live`, valore non scritto nel documento | micro 140ms | «13 su 12» |
| Reduced motion | Nota senza transizione | 0ms | drawer-reduced: `0s` |

## Verifica
- [x] Registrazione ciclo reale (fixture con il componente vero): `video/drawer-*.webm`, `video/pubblico-*.webm`, `video/pdf-*.webm`
- [x] Tastiera e focus (Tab, Spazio sugli interruttori; focus visibile). Escape: gestito dal drawer esistente, non toccato
- [x] Touch/mobile (viewport 500, tap)
- [x] Reduced motion
- [x] Input rapidi (cancella e riscrive senza attese) — ha trovato e fatto correggere un bug di riallineamento
- [x] Errore e conservazione dati (valore non valido non salvato, campo non svuotato)
- [x] Overflow orizzontale assente sul menu pubblico (desktop e 500px)
- [x] Nessun blur, nessuna animazione sulle etichette pubbliche (`getAnimations()` vuoto)
- [ ] Performance su macchina target: non misurata (componente statico, nessuna animazione continua)

## Limiti e deviazioni
Il drawer è registrato in una fixture (stesso file sorgente, stesso `updateItem`), non nella dashboard completa che richiede login. Viewport mobile 500px (minimo affidabile di Chrome headless).
