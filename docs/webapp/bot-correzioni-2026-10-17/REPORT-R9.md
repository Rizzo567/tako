# REPORT R9 — risposta breve a una domanda in sospeso, doppioni per somiglianza (agente R6, 18/10/2026)

**Esito: corretto e online su v115** (ezbr `b1830830603040aa7d51f4c70f1293550210386e11537ac7705ca3bdb514debf`). Dettagli: implementation-notes note 86–92.

## Diagnosi (QA, 12:30–12:34 UTC, route vero + menu rev 1820 + gpt-oss vero)
- 12:30: il server rifiuta giustamente la creazione di «pasta al ragù» (stesso nome). Nell'auto-correzione è il **modello** a dire «c'è già pasta al pesto» per «Pasta al pesto e lasagna», e il server lo accettava. Il ramo clarify perdeva le parti chiare (`brain_ask.actions = []`).
- 12:31 «Aggiornapure» (trascrizione vera): il modello rispondeva bene, ma il **validatore** lo rifiutava. Primo motivo: `scelta_non_detta` (due candidati aperti, nessun nome detto). Secondo motivo: i prezzi 10/8 non valevano, perché la richiesta originale non contava come «detta». Poi la seconda chiamata ha prodotto di nuovo una domanda, e la **stessa domanda è ripartita** perché nessun controllo la bloccava.
- 12:32 «Sì sì, aggiornali» e 12:33–34 «si»/«confermo»: stessa strada. Lì c'era anche `confirm_pending` su una domanda aperta, che il server rifiutava come «nessuna proposta».

## Fix
1. La domanda porta con sé la richiesta originale: i piatti con lo stesso nome (`twins`), i prezzi detti e le parti chiare. Il contesto le mostra con le opzioni. Il validatore accetta i nomi e i prezzi di quella richiesta. La risposta pubblica e la scelta resta al modello.
2. Domanda ripetuta sullo stesso sospeso: il server non la rimanda. Prima fa un'auto-correzione col motivo «il titolare ha già risposto: X», poi chiede una domanda diversa con le opzioni numerate. Al massimo 3 chiamate; se il modello ripete ancora, il server manda solo i fatti.
3. È un doppione solo se il nome è uguale dopo la normalizzazione. Un nome contenuto in un altro (pesto ≠ pesto e lasagna) è un piatto nuovo: le bozze e i piani che li confondono vengono rifiutati.
4. Un vocale breve mentre qualcosa è in sospeso aggiunge al contesto l'avviso «trascrizione forse errata».
5. `confirm_pending` su una domanda aperta torna al modello col motivo «scrivi le azioni della richiesta originale».

## Numeri
| batteria | esito |
|---|---|
| **R9 nuova** (185 conv.) | oracolo 185/185, 0 GRAVI, 0 MEDI; off 0 / avversario 0 GRAVI di sicurezza |
| test piani veri (`owner-brain-r9`) | 10/10; R8 6/6 |
| fix-a, fix-b, X, Y, Z, R8, banco E, banco vero, V | oracolo/off identici; avversario X e Y: 1 conversazione ciascuna da MEDIO a GRAVE non-applicato, non di sicurezza (nota 90) |
| suite | 14 rossi noti, round1–6* verdi |

## Deploy e live
v114 → v115 col diff per sezioni: cambiano solo i moduli del cervello e `routes/twilio-menu`. Il rollback v114 è salvato (nota 91). Prova live solo nel TwiML, col vocale vero delle 12:30: domanda solo sul ragù, pesto/carbonara/riso elencati come «Non ancora pubblicato», nessuna scrittura. Vocali 12:31–12:32 non inviati per il tetto di 15k (8.488 usati). Twilio 0→0, QA ripristinato per hash, errori 56→56.

## Aperti
- Risposta live ai vocali 2–3 da rifare quando ci sono token (o col Developer).
- La guardia contro la domanda ripetuta vale solo sui sospesi con un'operazione dentro; le domande generiche ripetute restano MEDIO (nota 88).
