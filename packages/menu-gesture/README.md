# Menu gesture — consegna autonoma

- `index.ts`: unico modulo vanilla TypeScript, DOM puro, API e firme richieste, nessun import e nessuna dipendenza runtime.
- `demo.html`: demo completa con JavaScript compilato inline. Si apre anche senza server. Quattro Menu, sette Sottomenu, tre Sezioni, 4–5 piatti per Sezione. Controllo opzionale per sessanta elementi, movimento ridotto, distruzione/riattivazione, ri-render e iframe mobile da390 px.
- `MISURE.md`: misure osservate e parametri applicati.
- `verifica/`: test e risultati. JSDOM è usato soltanto dai test di sviluppo, non dal modulo né dalla demo.

## Uso

```ts
import {createMenuGesture} from './index'
const gesture = createMenuGesture({
  root: document.querySelector<HTMLElement>('#menu-editor')!,
  itemSelector: '[data-edit-id]',
  canDrop: (item, toGroup) => canMove(item.id, item.kind, toGroup),
  onDrop: drop => { updateModel(drop); render(); gesture.refresh() },
  onModeChange: active => { doneButton.hidden = !active },
  onTap: id => selectItem(id),
})
doneButton.onclick = () => gesture.exitEditMode()
// Allo smontaggio: gesture.destroy()
```

Ogni elemento usa `data-edit-id` univoco, `data-edit-kind` e `data-edit-group`; ogni contenitore usa `data-edit-group-id` e `data-edit-axis`. I contenitori rimangono presenti quando sono vuoti. Gli elementi sono preferibilmente figli diretti del loro gruppo; se ci sono wrapper, l’inserimento preview si ancora al figlio del gruppo che contiene la destinazione.

Durante il drag il modulo cambia temporaneamente l’ordine DOM per FLIP e il gruppo dell’elemento. Non salva dati: chiama onDrop una volta al rilascio solo se la posizione cambia. `toIndex` è l’indice finale, senza includere due volte l’elemento spostato. Escape/pointercancel ripristinano il DOM iniziale senza onDrop. Il chiamante aggiorna il modello e richiama refresh dopo il proprio render. Non usare la copia dell’elemento trascinato come dato applicativo: il ghost è aria-hidden/inert e privato al modulo.

Tastiera: Spazio prende, frecce spostano, Spazio/Invio posa, Escape annulla; una seconda Escape esce dalla modalità. Ai bordi di una sezione le frecce verticali trasferiscono un piatto alla sezione successiva/precedente compatibile. Un tocco breve seleziona via onTap.

## Verifica

Typecheck: `tsc --strict --noEmit --target ES2020 --lib ES2020,DOM index.ts`.

I test DOM richiedono Node e jsdom26 nell’ambiente di sviluppo: `node verifica/dom.test.cjs`. Nessuna chiamata a servizi esterni e nessun dato dei ristoranti.

Non modificati l’editor in parallelo, il backend o la produzione Takomenu. La demo è il deliverable da approvare/provare prima dell’integrazione nel progetto.
