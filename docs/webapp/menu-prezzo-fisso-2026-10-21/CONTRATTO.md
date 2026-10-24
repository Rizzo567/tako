# Contratto — Menu «a prezzo fisso» (21/10/2026)

Decisione: `brain/decisioni/2026-10-21-takomenu-menu-a-prezzo-fisso.md` + aggiunte self-service di Manuel (ripetibile da ogni ristoratore dalla sua dashboard).

## 1. Dati (`apps/server/src/lib/menu-workspace-contract.ts`, retro-compatibile)
```ts
menu.pricing: 'carta' | 'fisso'            // default 'carta' (documenti vecchi = carta)
menu.formulas: Formula[]                   // default [] ; ordine = ordine mostrato
menu.included: string | null               // default null ; «¼ di vino oppure ½ l d'acqua + caffè»
type Formula = { id: uuid, name: string(1..120), price: number(0..100000), note: string|null (≤300), sectionIds?: uuid[] /* Sottomenu compresi */, translations: Record<lang,{name, description?}> }
menu.translations[lang].included?: string  // traduzione di «Compreso»
```
- **Piatti in un menu fisso**: il campo `price` resta com'è (numero ≥ 0). NON si azzera mai: passando da carta a fisso i prezzi restano salvati e nascosti, e tornano rimettendo «Alla carta». Un piatto creato in un menu fisso nasce con `price: 0`. È l'opzione più retro-compatibile (DB relazionale `menu_items.price NOT NULL`, ordini, PDF, export).
- **Regola di visualizzazione unica**: `priceHidden = menu.pricing === 'fisso'` → in pagina pubblica, PDF e editor il prezzo del piatto non si mostra né si chiede.
- `formulas` con `pricing:'carta'` si conservano (non si cancellano) ma non si mostrano.
- Helper condivisi in `apps/server/src/lib/menu-fixed-price.ts`: `isFixed(menu)`, `formulaLabel(f)` («Completo · 12,00 €»), `visibleFormulas(menu)` (solo se fisso, nome non vuoto).

## 2. Pagina pubblica e PDF (perimetro F: `apps/web/**`, `packages/types`, `published-menu.ts` projection, `menu-workspace-pdf.ts`)
- `PublicMenu` aggiunge `pricing?`, `formulas?: {id,name,price,note?}[]`, `included?` (tradotti con lo stesso meccanismo di nome/descrizione).
- Menu fisso: riquadro sobrio in cima con le opzioni (nome · prezzo · nota) e «Compreso: …»; sotto i sottomenu con piatti SENZA prezzo. Nessuna opzione → nessun riquadro vuoto.
- PDF: stessa struttura.

## 3. Dashboard (perimetro D: `apps/dashboard/**`, route `menu-workspace` solo se serve un permesso)
- Disponibile all'account TITOLARE (creato dal flusso WhatsApp) oltre a staff/agenzia: verificare permessi e provare con un account titolare.
- Editor del Menu: scelta «Alla carta / Prezzo fisso»; righe opzioni (aggiungi, modifica, riordina, togli: nome, prezzo, nota) + campo «Compreso»; riga «I prezzi dei piatti restano salvati: tornano se rimetti Alla carta»; stato vuoto «Aggiungi la prima opzione di prezzo»; anteprima cliente; nei menu fissi il campo prezzo del piatto non si mostra; «Sostituisci i piatti» di un sottomenu incollando una lista (una riga = un piatto; i piatti con lo stesso nome conservano descrizione/foto/allergeni).
- Creare un Menu nuovo già a prezzo fisso.
- UI ultra semplice, stile Sobrio, 375 px, tastiera/focus. Screenshot headless di TUTTI gli stati PRIMA del deploy.

## 4. Bot (perimetro coordinatore: `owner-brain-*`, `twilio-menu*`, `routes/twilio-menu.ts`)
- Azioni nuove: `set_formula_price(menu, name, price)`, `create_formula(menu, name, price, text=nota)`, `delete_formula(menu, name)` (conferma), `replace_section_items(section, menu, names[])` (sostituzione giornaliera, subito con riepilogo e annulla 10 min: i piatti nominati che esistono già in quel sottomenu, anche nascosti, tornano visibili con i loro dati (foto, descrizione, allergeni); quelli nuovi si creano; quelli non nominati si NASCONDONO, mai eliminati — così domani tornano col nome senza perdere nulla), `set_menu_pricing(menu, 'fisso'|'carta')`.
- Validatore: in un menu fisso niente prezzi per piatto (create_item senza prezzo, mai chiedere il prezzo); prezzi delle formule solo se detti.

## 5. Migrazione Victoria (coordinatore): stesso formato che produrrebbe la UI; backup, dry-run con diff, piatti deduplicati, nessun piatto perso; solo dopo deploy verde.


## 6. Resa del menu fisso (aggiornata 21/10 pomeriggio: la pagina di Victoria deve restare visivamente IDENTICA)
- Se le opzioni hanno `sectionIds`: per ogni opzione, nell'ordine, un blocco «NOME · prezzo» + nota (come oggi i sottomenu COMPLETO/PRIMO/SECONDO con prezzo nella descrizione), e sotto i Sottomenu che comprende (ripetuti se più opzioni li comprendono: si ripete la VISTA, non i dati). Poi i Sottomenu non compresi da nessuna opzione. «Compreso: …» sotto ogni opzione (o una volta in cima se le opzioni sono senza `sectionIds`).
- Se nessuna opzione ha `sectionIds`: riquadro opzioni in cima + tutti i Sottomenu.
- Riferimento visivo: la pagina pubblica ATTUALE di Victoria (Menu pranzo, Menu cena) — screenshot prima/dopo, desktop e mobile.

## 7. PDF multipli (decisione `brain/decisioni/2026-10-21-takomenu-pdf-multipli-sempre-aggiornati.md`)
- Dati in `restaurants.settings.pdfDocuments` (niente tabella nuova): `[{ id: uuid, name: string(1..80), menuIds: uuid[] (ordine = ordine nel PDF), config?: Partial<pdfConfig> (grafica; assente = quella del locale), shareToken: string (32+ caratteri casuali) | null, updatedAt: iso }]`, max 12.
- Nessun documento salvato → la UI mostra un «PDF predefinito» con tutti i Menu attivi (calcolato, non salvato).
- API (account con permesso di modifica del menu: owner/manager/menu_editor; route in `apps/server/src/routes/menu-workspace.ts`):
  - `GET /api/menu-workspace/pdf-documents` → `{documents, default:{name,menuIds}}`
  - `PUT /api/menu-workspace/pdf-documents` body `{documents:[{id?,name,menuIds,config?}]}` → salva (mantiene i token esistenti per id)
  - `POST /api/menu-workspace/pdf-documents/:id/link` → genera/rigenera `shareToken` (il vecchio link smette di funzionare); `DELETE …/:id/link` → revoca
  - `GET /api/menu-workspace/pdf-documents/:id/pdf` (auth) → PDF dal menu PUBBLICATO
  - pubblico: `GET /api/public/menu-pdf/:token` → PDF dal menu pubblicato del momento, `Cache-Control` legato alla revisione pubblicata (ETag = revisione+hash config); token sconosciuto/revocato → 404
- `supplied-menu-pdf.ts` (PDF fisso di Victoria) resta com'è finché Manuel non approva il confronto: i documenti salvati di Victoria si generano col sistema nuovo (link fisso e download dal pannello); il download predefinito di oggi non cambia.
