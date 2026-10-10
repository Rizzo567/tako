# Menu cliente: ogni categoria è una pagina

Data: 2026-10-10. Renderer unico `apps/web/src/components/WorkspaceMenuRenderer.tsx`, usato da consultazione (`/r/:id/menu`), tavolo (`/r/:id/t/:token`), asporto (`/asporto/:id`) e anteprima editor (`/menu-preview/:id`).

## Comportamento
- Le pillole della barra «Categorie» mostrano solo le **categorie principali**. Toccandone una si vedono solo i piatti di quella categoria. Lo scroll verso la sezione è stato rimosso, insieme allo scroll-spy.
- Le **sottocategorie** restano nella pagina della categoria madre, anche quando sono annidate: compaiono come sezioni con il loro titolo, come prima. Una riga di pillole secondarie («Sottocategorie») sopra la lista porta alla sottosezione dentro la stessa pagina. Queste pillole sostituiscono quelle che prima stavano nella barra principale. Una sottocategoria orfana, o presa in un ciclo di genitori, diventa una categoria a sé.
- **Categoria iniziale**: la prima con almeno un piatto disponibile. Se non ce n'è nessuna, la prima con piatti; altrimenti la prima in assoluto.
- **Cambio categoria**: se l'utente era sceso nella pagina, la nuova lista riparte da sotto header e pillole (tiene conto dell'header sticky). Se era più in alto, la posizione resta quella.
- **Ricerca**: mostra i risultati di tutte le categorie, come prima. L'indicatore si nasconde e la pagina è marcata `data-category-page="search"`. Svuotando la ricerca si torna alla categoria selezionata. Toccare una pillola durante la ricerca svuota la ricerca e apre quella categoria.
- **Cambio menu** (tab): si torna alla prima categoria del nuovo menu e `?cat=` viene tolto. Il cambio di **lingua**, gli aggiornamenti live e il simulatore data/ora mantengono la categoria finché esiste ancora; se sparisce, si passa a quella iniziale.
- **URL**: `?cat=<id>` con `history.pushState`, senza ricaricare la pagina. Il tasto indietro del telefono torna alla categoria precedente. Nell'anteprima (`readOnly`, dentro un iframe) l'URL non viene toccato, così la cronologia della dashboard resta pulita.
- Carrello, dettaglio piatto (`onOpen`), filtri allergeni di MenuView e analytics funzionano come prima. `recordMenuEvent` è lato server e viene chiamato al GET del menu.

## Animazione
- La lista uscente fa **90 ms**: dissolvenza e spostamento di 12 px verso il lato opposto, curva `cubic-bezier(.4,0,1,1)`.
- La lista entrante fa **190 ms**: arriva da 28 px dal lato della categoria scelta (da destra se è più avanti nell'elenco, da sinistra se è prima), curva `cubic-bezier(.22,1,.36,1)`. In tutto sono circa 280 ms.
- L'**indicatore condiviso** (`[data-category-indicator]`) scorre e si ridimensiona da una pillola all'altra in 260 ms, con la stessa curva morbida. È una transizione CSS, quindi riparte dalla posizione corrente. Il testo della pillola scelta schiarisce con 100 ms di ritardo (130 ms), quella lasciata torna scura subito: niente testo chiaro su sfondo chiaro mentre l'indicatore viaggia.
- **Clic rapidi**: si usa WAAPI e un solo stato bersaglio, senza code. Un clic durante l'uscita aggiorna solo la destinazione. Un clic durante l'entrata riparte da opacità e traslazione correnti. Tornare alla categoria di partenza durante l'uscita inverte il movimento.
- **A riposo** non restano trasformazioni né sfocature: lista con `opacity:1` e `transform:none`, nessun `filter`.
- **`prefers-reduced-motion`**: il cambio è istantaneo, l'indicatore non ha transizione e non ci sono animazioni attive.
- Se la barra scorre orizzontalmente, la pillola attiva viene centrata con uno scroll della barra. Oggi la barra va a capo come prima, quindi questo scatta solo se un design futuro la rende scorrevole.

## Colore
- Il default del menu non è più l'arancione Tako. Quando `design.primary` manca, o vale `#ED7159`/`#ed725b` (i default che il server scrive quando il ristorante non sceglie), si usa il neutro scuro `#1d1d1f` (`apps/web/src/lib/menu-palette.ts`). Le altre scelte del ristorante restano invariate.
- La categoria attiva usa `categoryActiveStyle.background`, poi `categoryActiveBackground` (se non è l'arancio di default), poi il colore principale. Il testo attivo è `categoryActiveText`, oppure il colore leggibile calcolato sulla luminanza WCAG.
- Se lo sfondo delle pillole a riposo quasi coincide con quello attivo (distanza RGB < 48, per esempio il default `#242628` contro il neutro), le pillole a riposo diventano a contorno (sfondo trasparente, testo del menu, bordo tenue). Così l'attiva resta sempre riconoscibile.

## Verifiche (10/10/2026)
- `tsc --noEmit` di `apps/web`: ok. `next build` di `apps/web` in un worktree isolato: ok. Il `.next` della webapp accesa non è stato toccato.
- `node --test tests/web/*.test.mjs deploy/render/gateway.test.mjs`: 62/62 (54 esistenti + 8 nuovi in `tests/web/menu-category-pages.test.mjs`). Il test esistente del renderer riceve solo i due moduli `lib` nel contesto: nessuna asserzione cambiata.
- Vitest (`pnpm test`): 119 superati. I 13 file falliti sono test di integrazione che richiedono lo stack dev vivo (server e Postgres, vedi `vitest.config`). Nessuno tocca `apps/web`.
- Headless (`apps/web/docs/categorie-a-pagine.verify.mjs`, Chrome headless, desktop 1280 e mobile 390 emulato): 46/46, sia su `next dev` isolato (5142) sia su `next start` della build (5143). Le API cliente sono mockate e nessuna scrittura arriva al server. Il verifier controlla:
  - categoria iniziale, solo piatti della categoria, scroll che non salta;
  - `?cat=`, tasto indietro senza ricaricare;
  - direzione e durata (campionata sul `document.timeline`: lista ferma a ~283 ms dal clic, indicatore fermo prima);
  - clic rapidi, ricerca, cambio menu e lingua, riduzione del movimento;
  - nessun arancione nel renderer;
  - console pulita su consultazione, tavolo (API mockata), asporto e anteprima.
- Fotogrammi rallentati 10× di Primi → Antipasti → Primi, desktop e mobile: uscita, entrata e indicatore che scorre.

## Limiti noti
- Il server scrive ancora `#ed725b` come default nello schema design e `#ED7159` in `restaurants.primary_color`. Il client li tratta come «non scelto», quindi un ristorante che scegliesse proprio quell'arancione vedrebbe il neutro. La correzione completa sta nel server, fuori dal perimetro `apps/web`.
- Fuori dal renderer, la «cornice» dell'app tavolo e asporto (barra carrello, nav, `--brand` impostato da `restaurant.primaryColor`), il pulsante del dettaglio piatto (`design.primary || var(--brand)`) e `<meta name="theme-color">` in `app/layout.tsx` restano arancioni con i default attuali.
