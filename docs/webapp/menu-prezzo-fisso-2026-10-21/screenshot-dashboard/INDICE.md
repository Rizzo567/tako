# Screenshot dashboard — Menu a prezzo fisso e PDF multipli (21/10/2026)

Generati da `node scripts/verify-fixed-menu-dashboard.mjs`: componenti veri della dashboard, ruolo **titolare (owner)**, API finta in memoria con le forme del CONTRATTO §7, anteprima cliente = renderer vero di `apps/web` compilato. Chrome headless, 1280×900 e 375×812, reduced motion. Giro correzioni del 21/10 sera: «Sottomenu» al posto di «categoria» (sottocategoria = «Sezione»), scelta Alla carta/Prezzo fisso solo nel riquadro, un solo sistema PDF, fixture come Victoria Cena, una notifica per volta.

| File | Viewport | Stato |
|---|---|---|
| [desktop-01-scelta-carta-fisso.png](desktop-01-scelta-carta-fisso.png) | 1280 | Impostazioni menu: scelta «Alla carta / Prezzo fisso» |
| [desktop-02-riga-prezzi-conservati.png](desktop-02-riga-prezzi-conservati.png) | 1280 | Prezzo fisso scelto: la scelta e la riga «I prezzi dei piatti restano salvati» solo nel riquadro Prezzo fisso |
| [desktop-03-stato-vuoto.png](desktop-03-stato-vuoto.png) | 1280 | Menu fisso senza opzioni: invito ad aggiungere la prima |
| [desktop-04-piatti-senza-prezzo.png](desktop-04-piatti-senza-prezzo.png) | 1280 | Elenco piatti del menu fisso: nessun prezzo |
| [desktop-05-opzioni-compilate.png](desktop-05-opzioni-compilate.png) | 1280 | Tre opzioni (come Victoria Cena), «Comprende» = Sottomenu compresi: Completo = Primi+Secondi+Contorni, Solo primo, Solo secondo; nota solo dove scritta |
| [desktop-06-compreso.png](desktop-06-compreso.png) | 1280 | Campo «Compreso» compilato |
| [desktop-07-riordino.png](desktop-07-riordino.png) | 1280 | Riordino: «Completo» spostato dopo «Solo primo» |
| [desktop-08-sostituisci-incolla.png](desktop-08-sostituisci-incolla.png) | 1280 | Sostituisci i piatti: lista incollata |
| [desktop-09-sostituisci-riepilogo.png](desktop-09-sostituisci-riepilogo.png) | 1280 | Riepilogo: restano 2 (uno torna visibile), nuovo 1, nascosto 1 |
| [desktop-09b-sostituisci-premi-salva.png](desktop-09b-sostituisci-premi-salva.png) | 1280 | Dopo «Conferma»: una sola riga «Piatti sostituiti: premi Salva.» nel riquadro, nessun toast |
| [desktop-10-dopo-sostituzione.png](desktop-10-dopo-sostituzione.png) | 1280 | Dopo la sostituzione e il salvataggio: Lasagna nascosta, Gnocchi nuovo senza prezzo |
| [desktop-11-anteprima-cliente.png](desktop-11-anteprima-cliente.png) | 1280 | Anteprima cliente (renderer vero di apps/web): schede come Victoria (Completo, Primi, Secondi) |
| [desktop-12-tornato-alla-carta.png](desktop-12-tornato-alla-carta.png) | 1280 | Rimesso «Alla carta»: i prezzi tornano; il piatto nuovo mostra «Senza prezzo», non «€ 0» |
| [desktop-13-nuovo-menu-fisso.png](desktop-13-nuovo-menu-fisso.png) | 1280 | Nuovo menu (scelte: Sottomenu / Piatto / Menu): scelto «Prezzo fisso» alla creazione |
| [desktop-14-nuovo-menu-fisso-vuoto.png](desktop-14-nuovo-menu-fisso-vuoto.png) | 1280 | Menu nuovo a prezzo fisso: stato vuoto |
| [desktop-20-pdf-predefinito.png](desktop-20-pdf-predefinito.png) | 1280 | PDF: nessun documento salvato → «PDF predefinito» |
| [desktop-21-pdf-nuovo.png](desktop-21-pdf-nuovo.png) | 1280 | Nuovo PDF: nome, menu inclusi, grafica |
| [desktop-22-pdf-scelta-ordine-menu.png](desktop-22-pdf-scelta-ordine-menu.png) | 1280 | Menu inclusi e loro ordine (Cena prima di Pranzo) |
| [desktop-23-pdf-grafica.png](desktop-23-pdf-grafica.png) | 1280 | Grafica propria: controlli del PDF esistenti, etichette in italiano |
| [desktop-24-pdf-lista.png](desktop-24-pdf-lista.png) | 1280 | Lista dei PDF: PDF predefinito sempre in cima + PDF salvato |
| [desktop-25-pdf-elimina-conferma.png](desktop-25-pdf-elimina-conferma.png) | 1280 | Conferma eliminazione di un PDF |
| [desktop-26-link-da-creare.png](desktop-26-link-da-creare.png) | 1280 | Link fisso: spiegazione + «Crea link fisso» |
| [desktop-27-link-creato.png](desktop-27-link-creato.png) | 1280 | Link fisso creato |
| [desktop-28-link-copiato.png](desktop-28-link-copiato.png) | 1280 | Link copiato negli appunti |
| [desktop-29-link-rigenera-conferma.png](desktop-29-link-rigenera-conferma.png) | 1280 | Rigenera: conferma (il vecchio link smette di funzionare) |
| [desktop-30-link-revocato.png](desktop-30-link-revocato.png) | 1280 | Link revocato: si può crearne uno nuovo |
| [desktop-31-pdf-scheda-pdf.png](desktop-31-pdf-scheda-pdf.png) | 1280 | Scheda PDF aperta da «PDF predefinito → Modifica»: solo le impostazioni del PDF predefinito, anteprima vera (Pagina 1 di 1) |
| [mobile-01-scelta-carta-fisso.png](mobile-01-scelta-carta-fisso.png) | 375 | Impostazioni menu: scelta «Alla carta / Prezzo fisso» |
| [mobile-02-riga-prezzi-conservati.png](mobile-02-riga-prezzi-conservati.png) | 375 | Prezzo fisso scelto: la scelta e la riga «I prezzi dei piatti restano salvati» solo nel riquadro Prezzo fisso |
| [mobile-03-stato-vuoto.png](mobile-03-stato-vuoto.png) | 375 | Menu fisso senza opzioni: invito ad aggiungere la prima |
| [mobile-04-piatti-senza-prezzo.png](mobile-04-piatti-senza-prezzo.png) | 375 | Elenco piatti del menu fisso: nessun prezzo |
| [mobile-05-opzioni-compilate.png](mobile-05-opzioni-compilate.png) | 375 | Tre opzioni (come Victoria Cena), «Comprende» = Sottomenu compresi: Completo = Primi+Secondi+Contorni, Solo primo, Solo secondo; nota solo dove scritta |
| [mobile-06-compreso.png](mobile-06-compreso.png) | 375 | Campo «Compreso» compilato |
| [mobile-07-riordino.png](mobile-07-riordino.png) | 375 | Riordino: «Completo» spostato dopo «Solo primo» |
| [mobile-08-sostituisci-incolla.png](mobile-08-sostituisci-incolla.png) | 375 | Sostituisci i piatti: lista incollata |
| [mobile-09-sostituisci-riepilogo.png](mobile-09-sostituisci-riepilogo.png) | 375 | Riepilogo: restano 2 (uno torna visibile), nuovo 1, nascosto 1 |
| [mobile-09b-sostituisci-premi-salva.png](mobile-09b-sostituisci-premi-salva.png) | 375 | Dopo «Conferma»: una sola riga «Piatti sostituiti: premi Salva.» nel riquadro, nessun toast |
| [mobile-10-dopo-sostituzione.png](mobile-10-dopo-sostituzione.png) | 375 | Dopo la sostituzione e il salvataggio: Lasagna nascosta, Gnocchi nuovo senza prezzo |
| [mobile-11-anteprima-cliente.png](mobile-11-anteprima-cliente.png) | 375 | Anteprima cliente (renderer vero di apps/web): schede come Victoria (Completo, Primi, Secondi) |
| [mobile-12-tornato-alla-carta.png](mobile-12-tornato-alla-carta.png) | 375 | Rimesso «Alla carta»: i prezzi tornano; il piatto nuovo mostra «Senza prezzo», non «€ 0» |
| [mobile-13-nuovo-menu-fisso.png](mobile-13-nuovo-menu-fisso.png) | 375 | Nuovo menu (scelte: Sottomenu / Piatto / Menu): scelto «Prezzo fisso» alla creazione |
| [mobile-14-nuovo-menu-fisso-vuoto.png](mobile-14-nuovo-menu-fisso-vuoto.png) | 375 | Menu nuovo a prezzo fisso: stato vuoto |
| [mobile-20-pdf-predefinito.png](mobile-20-pdf-predefinito.png) | 375 | PDF: nessun documento salvato → «PDF predefinito» |
| [mobile-21-pdf-nuovo.png](mobile-21-pdf-nuovo.png) | 375 | Nuovo PDF: nome, menu inclusi, grafica |
| [mobile-22-pdf-scelta-ordine-menu.png](mobile-22-pdf-scelta-ordine-menu.png) | 375 | Menu inclusi e loro ordine (Cena prima di Pranzo) |
| [mobile-23-pdf-grafica.png](mobile-23-pdf-grafica.png) | 375 | Grafica propria: controlli del PDF esistenti, etichette in italiano |
| [mobile-24-pdf-lista.png](mobile-24-pdf-lista.png) | 375 | Lista dei PDF: PDF predefinito sempre in cima + PDF salvato |
| [mobile-25-pdf-elimina-conferma.png](mobile-25-pdf-elimina-conferma.png) | 375 | Conferma eliminazione di un PDF |
| [mobile-26-link-da-creare.png](mobile-26-link-da-creare.png) | 375 | Link fisso: spiegazione + «Crea link fisso» |
| [mobile-27-link-creato.png](mobile-27-link-creato.png) | 375 | Link fisso creato |
| [mobile-28-link-copiato.png](mobile-28-link-copiato.png) | 375 | Link copiato negli appunti |
| [mobile-29-link-rigenera-conferma.png](mobile-29-link-rigenera-conferma.png) | 375 | Rigenera: conferma (il vecchio link smette di funzionare) |
| [mobile-30-link-revocato.png](mobile-30-link-revocato.png) | 375 | Link revocato: si può crearne uno nuovo |
| [mobile-31-pdf-scheda-pdf.png](mobile-31-pdf-scheda-pdf.png) | 375 | Scheda PDF aperta da «PDF predefinito → Modifica»: solo le impostazioni del PDF predefinito |

## Verifiche automatiche

- desktop: Impostazioni menu: scelta «Alla carta / Prezzo fisso»
- desktop: freccia sulla scelta passa a Prezzo fisso; la scelta resta solo nel riquadro Prezzo fisso e il focus la segue
- desktop: Prezzo fisso scelto: la scelta e la riga «I prezzi dei piatti restano salvati» solo nel riquadro Prezzo fisso
- desktop: Menu fisso senza opzioni: invito ad aggiungere la prima
- desktop: Elenco piatti del menu fisso: nessun prezzo
- desktop: «Tutto il menu» selezionato quando nessun sottomenu è scelto; sceglierlo azzera la scelta
- desktop: Tre opzioni (come Victoria Cena), «Comprende» = Sottomenu compresi: Completo = Primi+Secondi+Contorni, Solo primo, Solo secondo; nota solo dove scritta
- desktop: Campo «Compreso» compilato
- desktop: Riordino: «Completo» spostato dopo «Solo primo»
- desktop: Sostituisci i piatti: lista incollata
- desktop: Riepilogo: restano 2 (uno torna visibile), nuovo 1, nascosto 1
- desktop: conferma applica nella bozza; «premi Salva» resta nel riquadro, niente toast
- desktop: Dopo «Conferma»: una sola riga «Piatti sostituiti: premi Salva.» nel riquadro, nessun toast
- desktop: salvato nel formato del contratto (pricing, formulas con sectionIds, included; piatti nascosti, prezzi intatti)
- desktop: dopo Salva una sola notifica («Menu salvato»)
- desktop: Dopo la sostituzione e il salvataggio: Lasagna nascosta, Gnocchi nuovo senza prezzo
- desktop: Anteprima cliente (renderer vero di apps/web): schede come Victoria (Completo, Primi, Secondi)
- desktop: Rimesso «Alla carta»: i prezzi tornano; il piatto nuovo mostra «Senza prezzo», non «€ 0»
- desktop: carta↔fisso conserva i prezzi
- desktop: Nuovo menu (scelte: Sottomenu / Piatto / Menu): scelto «Prezzo fisso» alla creazione
- desktop: Menu nuovo a prezzo fisso: stato vuoto
- desktop: tutti i prezzi originali intatti dopo fisso→carta e sostituzione
- desktop: PDF: nessun documento salvato → «PDF predefinito»
- desktop: Nuovo PDF: nome, menu inclusi, grafica
- desktop: Esc chiude l’editor PDF e rende il focus a «Nuovo PDF»
- desktop: Menu inclusi e loro ordine (Cena prima di Pranzo)
- desktop: Grafica propria: controlli del PDF esistenti, etichette in italiano
- desktop: grafica PDF in italiano, «Ogni sottomenu su una pagina nuova»
- desktop: PUT {documents:[{name,menuIds,config}]} senza id per il nuovo
- desktop: dopo il salvataggio il PDF predefinito resta in lista; una sola conferma nel riquadro
- desktop: Lista dei PDF: PDF predefinito sempre in cima + PDF salvato
- desktop: crea e rinomina
- desktop: Conferma eliminazione di un PDF
- desktop: elimina con conferma
- desktop: Scarica usa GET …/:id/pdf
- desktop: Link fisso: spiegazione + «Crea link fisso»
- desktop: Link fisso creato
- desktop: Link copiato negli appunti
- desktop: Rigenera: conferma (il vecchio link smette di funzionare)
- desktop: rigenera → token nuovo
- desktop: Link revocato: si può crearne uno nuovo
- desktop: Esc chiude il link fisso e rende il focus
- desktop: Scheda PDF aperta da «PDF predefinito → Modifica»: solo le impostazioni del PDF predefinito, anteprima vera (Pagina 1 di 1)
- desktop: scheda PDF con un solo sistema (impostazioni del PDF predefinito)
- mobile: Impostazioni menu: scelta «Alla carta / Prezzo fisso»
- mobile: freccia sulla scelta passa a Prezzo fisso; la scelta resta solo nel riquadro Prezzo fisso e il focus la segue
- mobile: Prezzo fisso scelto: la scelta e la riga «I prezzi dei piatti restano salvati» solo nel riquadro Prezzo fisso
- mobile: Menu fisso senza opzioni: invito ad aggiungere la prima
- mobile: Elenco piatti del menu fisso: nessun prezzo
- mobile: «Tutto il menu» selezionato quando nessun sottomenu è scelto; sceglierlo azzera la scelta
- mobile: Tre opzioni (come Victoria Cena), «Comprende» = Sottomenu compresi: Completo = Primi+Secondi+Contorni, Solo primo, Solo secondo; nota solo dove scritta
- mobile: Campo «Compreso» compilato
- mobile: Riordino: «Completo» spostato dopo «Solo primo»
- mobile: Sostituisci i piatti: lista incollata
- mobile: Riepilogo: restano 2 (uno torna visibile), nuovo 1, nascosto 1
- mobile: conferma applica nella bozza; «premi Salva» resta nel riquadro, niente toast
- mobile: Dopo «Conferma»: una sola riga «Piatti sostituiti: premi Salva.» nel riquadro, nessun toast
- mobile: salvato nel formato del contratto (pricing, formulas con sectionIds, included; piatti nascosti, prezzi intatti)
- mobile: dopo Salva una sola notifica («Menu salvato»)
- mobile: Dopo la sostituzione e il salvataggio: Lasagna nascosta, Gnocchi nuovo senza prezzo
- mobile: Anteprima cliente (renderer vero di apps/web): schede come Victoria (Completo, Primi, Secondi)
- mobile: Esc chiude l’anteprima e rende il focus
- mobile: Rimesso «Alla carta»: i prezzi tornano; il piatto nuovo mostra «Senza prezzo», non «€ 0»
- mobile: carta↔fisso conserva i prezzi
- mobile: Nuovo menu (scelte: Sottomenu / Piatto / Menu): scelto «Prezzo fisso» alla creazione
- mobile: Menu nuovo a prezzo fisso: stato vuoto
- mobile: tutti i prezzi originali intatti dopo fisso→carta e sostituzione
- mobile: PDF: nessun documento salvato → «PDF predefinito»
- mobile: Nuovo PDF: nome, menu inclusi, grafica
- mobile: Esc chiude l’editor PDF e rende il focus a «Nuovo PDF»
- mobile: Menu inclusi e loro ordine (Cena prima di Pranzo)
- mobile: Grafica propria: controlli del PDF esistenti, etichette in italiano
- mobile: grafica PDF in italiano, «Ogni sottomenu su una pagina nuova»
- mobile: PUT {documents:[{name,menuIds,config}]} senza id per il nuovo
- mobile: dopo il salvataggio il PDF predefinito resta in lista; una sola conferma nel riquadro
- mobile: Lista dei PDF: PDF predefinito sempre in cima + PDF salvato
- mobile: crea e rinomina
- mobile: Conferma eliminazione di un PDF
- mobile: elimina con conferma
- mobile: Scarica usa GET …/:id/pdf
- mobile: Link fisso: spiegazione + «Crea link fisso»
- mobile: Link fisso creato
- mobile: Link copiato negli appunti
- mobile: Rigenera: conferma (il vecchio link smette di funzionare)
- mobile: rigenera → token nuovo
- mobile: Link revocato: si può crearne uno nuovo
- mobile: Esc chiude il link fisso e rende il focus
- mobile: Scheda PDF aperta da «PDF predefinito → Modifica»: solo le impostazioni del PDF predefinito
- mobile: scheda PDF con un solo sistema (impostazioni del PDF predefinito)
- nessun errore nel browser
