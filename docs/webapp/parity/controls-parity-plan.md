# Controlli PDF e Aspetto: scoperta e piano

## UNKNOWNS
| Sappiamo | Non sappiamo | Ipotesi verificabile | Punti ciechi |
|---|---|---|---|
| PDFKit genera PDF reali, font liberi sono bundled; vecchi JSON hanno campi piatti | Tutti i dettagli proprietari Menumal oltre riferimenti osservati | Controlli osservati mappati a output misurabile tramite PDF.js | Tipografia araba/ebraica richiede fallback script; non dichiarare ogni lingua |
| Asset tenant già verificati in storage | Se font varianti serif/mono mancanti alterano il risultato | Usare font bundled; aggiungere vere varianti libere per bold/italic | Nessuna dichiarazione di compliance HACCP automatica |
| Renderer mobile è condiviso | Stili legacy non possono cambiare implicitamente | Nuovi oggetti opzionali mantengono fallback preesistenti | Spazi enormi possono superare una colonna: bounding e pagination |

## PLAN e gate
1. Schema additivo: `pdf.typography` per name/price/description/category/menu/footer/legend; `spaces` per menu/category/item/description/legend/logo; `verticalCentered`, `backgroundImageUrl/Opacity/Size`, `legends`, `logoBackground`. Oggetti nuovi opzionali, fallback vecchi campi invariato. Design concordato con navigation agent, oggetti di stile opzionali.
2. PDF reale applica font, peso, corsivo, sottolineatura, dimensione, colore/allineamento, logo con sfondo e clipping, sfondo immagine tenant-only, legende indipendenti, box spaces e centratura del contenuto per colonna.
3. Editor mostra stessi gruppi Documento/Temi e selettori dell’elemento/area. Anteprima rimane PDF.js del documento generato, save esplicito.
4. Test schema legacy e roundtrip; PDF.js verifica testo, pagine e posizionamento; immagini foreign tenant negate; rendering PNG per QA visiva. TSC e test mirati sono gate. Max tre pass di correzione prima di segnalare limite concreto; nessuna build runtime/deploy o chiamata provider.

## Limiti dichiarati
Cataloghi sono i cataloghi Tako verificabili, senza inventare cataloghi proprietari. Le dichiarazioni alimentari sono editate dal locale. La centratura riguarda il contenuto stampato, non aggiunge dati né cambia prezzi. Asset devono appartenere al tenant anche nei preset/versioni.

## Implementazione e validazione
Schema opzionale compatibile, font veri Noto/Poppins/Staatliches/Amaranth/Italiana. Per famiglie senza facce peso/corsivo, PDFKit applica tratto e inclinazione reali alla faccia disponibile. Elementi: menu, categoria, sottocategoria, nome, prezzo, descrizione, allergeni, caratteristiche, additivi, legenda, footer. Spazi distinti includono sottocategoria; margini pagina esistenti restano indipendenti. Logo ritagliato e sfondo colorato, asset PDF solo upload relativo del tenant anche nei preset.

Il renderer pianifica le operazioni prima di stampare: centratura per colonna, paginazione esplicita e area footer riservata in base alla sua altezza reale. Nome e prezzo sono disegnati con stili separati; parole lunghe e prezzi display vengono spezzati nelle larghezze assegnate. Le descrizioni multilinea restano multilinea.

Traduzioni: `translationActive` opzionale conserva il comportamento legacy; `false` usa lingua originale. `translationNamesPolicy:auto` mantiene il nome originale quando il piatto ha descrizione e usa le traduzioni salvate per altri testi. Non chiama provider durante render.

Gate: 16/16 test schema/output/contratto/PDF precedenti e TSC server; 5/5 test editor SSR e PDF.js reale. PDF demo renderizzato con Poppler e pagina ispezionata (margini, colonne, underline, serif bold italic, descrizioni, legende e footer). Test isolamento/persistenza separati QA agent. Nessun modello HACCP proprietario è stato verificato: il documento allergeni generato non viene presentato come certificazione o documento HACCP completo.
