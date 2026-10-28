# Mappa dei testi fissi · fase R (R0.2, 17/10/2026)

Fonte: `apps/server/src/lib/twilio-menu-copy.ts` (`copy`, `line`), `twilio-menu-ai.ts` (`proposalText`, `planText`,
`capabilityText`, `readText`, `appliedMenuText`), `twilio-menu-hold.ts` (`holdQuestion`, `undoText`), `owner-brain-plan.ts`
(`composeReply`), testi scritti a mano nel route. **Vale solo col cervello acceso**: col cervello spento (clienti) ogni testo
resta quello di v112, nessuna stringa di `copy` cambia.

## I 2 testi fissi ammessi
| testo | dove |
|---|---|
| `aiDisclosure` «Sono l'assistente automatico di Takomenu…» | primo messaggio per numero (AI Act art. 50), invariato |
| «Sono momentaneamente non disponibile, riprova tra un minuto.» (nuovo `copy.brainDown`) | Groq giù / 429 / timeout / JSON non valido dopo il ripiego 20b, senza nessuna modifica |

## Fatti del server (non sono frasi del bot: dati riletti dal DB, in coda alla bozza del modello)
| fatto | forma |
|---|---|
| modifiche scritte e rilette | `line.*` / `describeAction`: «*X*: prezzo da A € a *B €*», «*X*: *finito*», «*X*: *nascosto* dal menu»… |
| modifica non salvata | «Non salvato: …» con la riga dell'azione |
| in attesa di conferma | righe `describeAction` della proposta, sotto «In attesa della tua conferma:» |
| candidati di una domanda | elenco numerato «1. *X*» (serve alla risposta «la seconda») |
| letture | `readText` (scheda del piatto, elenchi finiti/nascosti) |
| annullamento | righe «*X*: com'era prima» / «*X*: tolto (era stato aggiunto)» |
| nessuna modifica | «Non ho cambiato nulla.» quando il turno non scrive e la bozza del modello non c'è |
| stato del menu | `menuChanged`, `notPublished`, `dashboardPending`, `undoConflict`, `undoExpired` (ridotti al fatto, senza istruzioni) |

## Spariscono a cervello acceso (li scrive il modello in `reply_draft`)
`help`, `welcome`*, `proposal` (testata e piè di pagina), `typedOk`, `applied`, «*Confermato.* Ho aggiornato il menu.»
(`composeReply`), `nothingToCancel`, `cancelled`, `nothingToConfirm`, `notUnderstood`, `choosePrice*`, `chooseInvalid`,
`chooseAgain`, `choose`, `chooseFirst`, `negatedOnly`, `whichDish`, `dishNotFound`, `sameName`, `createMissing`,
`createCategories`, `alreadyExists`, `notVerbatim`, `unreadAsk`, `aiDown`, `noAi`, `failed`, `thanks`, `wait`, `busy`,
`noMatch`, `notFoundNamed`, `capabilityYes/No` e `capabilityText`, `brainWhatFor`, `brainNoContext`, `brainWhichRecent`,
`noChanges` (diventa il fatto «Non ho cambiato nulla.»), `pendingEmpty`, `hold*` (tutti), `deleteAsk`, `draftDropped`,
`batchStill`, `pendingStill`, `deleteUndoHint`, `sectionAsk`, `sectionExists`, `hiddenNotDeleted*`, `undoDone` (testata
«*Annullato.*»), `holdRestUnclear`, `holdDropped`, testi a mano nel route («Va bene, non cambio nulla.», «Non ho una modifica
recente su…», «La richiesta è *troppo lunga*…»).

\* `welcome` resta solo al collegamento col codice (non è la risposta a un messaggio del titolare).

## Restano (fuori perimetro R, flussi separati)
Foto (`photo*`), menu intero (`fullMenuCopy`), preset, `codeInvalid`, `voiceEmpty` (vocale senza parole: va al modello con il
segnaposto «[vocale senza parole]»), `voiceFailed` e `jobTimeout` → sostituiti dal testo ammesso «non disponibile».
`usageWarning` va solo al numero tecnico, non al titolare.

## Verifica (R3.2)
`tests/owner-brain-r-texts.test.ts` scansiona tutte le risposte delle batterie col cervello acceso: nessun frammento (≥ 18
caratteri tra i segnaposto) dei testi della sezione «Spariscono», salvo i 2 ammessi e i fatti.
