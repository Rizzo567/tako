# UNKNOWNS-R · fase R «un solo cervello» (agente R, 17/10/2026 notte)

Base: `codex/bot-fix-1017` 6004b81 (A8 WIP). Contratto: PIANO.md, sezione «FASE R».

## Contesto dichiarato
- Dominio: bot WhatsApp del titolare (modifiche al menu). Conosco il route (`routes/twilio-menu.ts`, 106 KB, quasi tutto
  interpretazione a regole), il cervello (`owner-brain-*.ts`: contesto, schema strict, validatore) e il banco (`tests/eval`).
- Cosa conta: (1) zero scritture sbagliate (validatore), (2) un solo decisore (il modello), (3) testi scritti dal modello,
  (4) clienti con `botBrain` spento = v112 identico.
- Cosa NON so misurare stanotte: la comprensione di gpt-oss (chiavi di test oltre tetto: vedi R5.2). L'oracolo è un modello
  ideale che conosce le attese: misura instradamento + contesto + strumenti + validatore, non il modello.

## Spike R0 (misurato, 0 token)
Interruttore temporaneo «cervello su tutto» nel `brainGate` (tolto dopo la misura), oracolo invariato:
| batteria | prima (6004b81) | cervello su tutto, senza strumenti nuovi |
|---|---|---|
| banco E oracolo | 298/318 | 281/318 (17 peggiorate: batterie 8, chiarimento 5, negazione 2…) |
| fix-a oracolo | 809/809 | 538/809 (123 GRAVI, 148 MEDI) |

Cause, lette sui casi (non ipotesi):
1. **Stati in sospeso invisibili o non risolvibili dal modello**: «aggiungi pasta al pesto e lasagna ⏎ 12 e 9» → il cervello
   non ha uno strumento per completare la bozza, risponde il modello di riserva del server («Cosa vuoi cambiare per *Piatto di
   verifica*?»). Stesso per scelte numerate, prezzi alternativi, conferme.
2. **Testi del server al posto del modello**: `brainWhatFor`, `notUnderstood` («Non ho capito la richiesta») scattano quando il
   piano è un chiarimento senza bozza: il giudice li legge come richiesta persa / chiarimento mancante.
3. **Oracolo non pensato per tutti i messaggi**: non sa rispondere a «sì», «no», «annulla», «12» dopo una domanda,
   «nei piatti di prova» come risposta alla categoria.
4. **Contesto sbagliato dopo una domanda in mezzo**: «aggiungi lasagna ⏎ ❓ quanto costa il tiramisù? ⏎ 20» → 20 sul
   tiramisù (il rimando va all'ultimo piatto nominato, non alla domanda aperta del bot).
Quindi il calo 97→58 di N non era gpt-oss: era architettura (stati e strumenti mancanti) + testi fissi + oracolo.

## Inventario
| Sappiamo | Sappiamo di non sapere | Ipotesi da verificare (come · cosa cambia se falsa) | Punti ciechi |
|---|---|---|---|
| Il validatore (G9, prezzi detti, quantità, polarità, rimandi, parti perse, ambiguità) ferma il modello avversario a 0 GRAVI di sicurezza su X/A/B | Resa di gpt-oss-120b sul nuovo schema (strumenti confirm/cancel/undo, bozza obbligatoria) | Il modello scrive domande decenti in `reply_draft` · banco oracolo con bozze + campione gpt-oss al gate · se falso: domanda del server con i fatti (lista candidati), mai testo inventato | Messaggi con foto/menu intero/preset: restano flussi separati (non toccati) |
| Con Groq giù oggi la riserva a regole scrive (aiDown, letture parziali) | Latenza con 2 chiamate (auto-correzione) | L'auto-correzione recupera la maggior parte dei rifiuti del validatore · contare `rifiuto→corretto` nel banco · se falso: domanda e basta (più chiarimenti) | Conferme a voce trascritte male («si» → «sì», «ok» → «okay») |
| Gli stati in sospeso stanno in `tako_whatsapp_proposals` (una riga per numero) | Quanti token aggiunge il blocco IN SOSPESO completo | Il prefisso fisso resta cacheabile (scheda generale invariata tra i turni) · misura stima token · se falso: si accorcia la scheda | Il giudice riconosce domande/esiti dal testo: testi nuovi possono confonderlo (lo dichiaro nei numeri) |
| Interruttore `settings.botBrain` per locale | — | Spento = v112: il percorso a regole non viene toccato · round1–6* col cervello spento + suite | Testi cambiati in `twilio-menu-copy.ts` valgono anche per i clienti: NON li tocco, li salto solo a cervello acceso |

## Percorso deterministico: interpretazione (via) e vincoli (restano nel validatore)
**Interpretazione — a cervello acceso non decide più nulla** (resta solo per i clienti col cervello spento):
conferme a regex («sì eliminalo», `replyIntent`, `confirmCleanup`), saluti/code tolti, prefissi «no, anzi», categoria in testa,
`politeCommand`/`spokenDecimals`/`spokenCents`, `holdAnswer`, «anzi no» = annulla, `isUndoRequest`, «al contrario» = scambio,
`negatedClauses` come lettura, `priceChoice`, bozza (`createStep`, `createQuestion`, `draftDropped`), «lascialo stare» dopo
un'aggiunta, `relativeDelta` nel route, `parseStructure` (elimina/rinomina/sposta/categorie), `movePick`, `brainGate`,
chiusura delle conferme (A8.2), `followUp`/`revertTarget`/«lascia stare X», `holdFromMessage`, `groupCommand`, comandi «tutti»,
elenchi di categoria, `clearChanges`, scelte (`resolveChoice`, `allOptions`, `looksLikeAnswer`), `parseMenuCommand`,
`parseIntent`/`compoundIntents`/`bareDish`, `isThanks`, vendite (`parseSalesText`/`salesTurn`), `capabilityFromText`, `unreadWords`.

**Vincoli — restano, come validatore del piano del modello o del server**:
piatto esistente e nominato (`g9DishMentioned`, memoria attiva, fonetica forte; debole → domanda), prezzo detto
(`g9Prices` lettore indipendente, `withoutQuantities`, differenze `relativeNumbers`, prezzi del contesto solo con rimando
esplicito), verso (`polarityProblem`, negazioni «non è finita»), prezzo nella parte del suo piatto (`priceClauseProblem`),
ambiguità (`rivalDishes`, `dominatedBy`, `foreignQualifier`), rimandi (`deixisReferents`), parti perse (`lostParts`),
domande = zero scritture (`looksLikeQuestion`, `priceAlternatives`), misti (azioni solo sulla parte di comando),
`negatedClauses` come esclusione, vendite (`salesActionProblem`), no-op (`effectiveMenuActions`), G6 prezzi implausibili →
conferma, >3 modifiche → OK scritto, elimina → «sì» al turno dopo, categoria implicita → conferma, doppioni di categoria,
ordine delle portate, annulla solo entro 10 minuti e solo l'ultima pubblicazione, revisione del menu, alias delle rinomine.

## Stati in sospeso oggi gestiti a copione → con R
| stato | oggi | con R |
|---|---|---|
| `batch` (riepilogo >3, G6, elimina, categoria nuova) | «OK»/«sì» a regex, testo `proposal`/`deleteAsk`/`sectionAsk` | nel contesto con il tipo; il modello sceglie `confirm_pending`/`cancel_pending` o corregge; il server verifica che il messaggio sia una conferma vera |
| `hold` (parti incerte) | `holdAnswer` a lettere/ordinali, `holdQuestion` | nel contesto (parti chiare + domande); il modello completa (`confirm_pending` + azioni nuove) |
| `choose` / `choose_price` | `resolveChoice`, `pickPrice`, copy `choose` | domanda aperta del modello nel contesto con i candidati; la risposta è un'azione normale validata |
| `create_draft` | `createStep`, `createQuestion` | idem: la bozza è nel contesto, i suoi nomi/prezzi valgono come detti |
| `undo:`/`brainundo:` | «annulla»/«anzi no» a regex | strumento `undo_last` (entro 10 min) e `restore`; il server rifiuta senza una richiesta di annullamento nel messaggio |
| `photo`, `fullmenu`, preset | flussi separati | invariati (fuori perimetro R, nota 49) |

## Decisioni ritoccabili (in testa al piano R)
Schema azioni (3 strumenti nuovi), formato dei fatti del server, auto-correzione una volta sola, cosa conta come «testo fisso».

## Stop della scoperta
Le domande aperte (gpt-oss, latenza) non cambiano architettura: goal, verifier e stop sono quelli del PIANO R.
