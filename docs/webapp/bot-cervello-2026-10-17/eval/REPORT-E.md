# Banco E · baseline del bot attuale (17/10/2026)

Branch `codex/bot-eval-1017`, base `origin/main` 3bd75b5, cioè l'edge v108. Non ho toccato il codice del bot, né l'online, né il QA.

## Il banco
- **318 conversazioni** su 5 menu di prova, 207 delle quali multi-turno (da 1 a 6 turni).
  - I menu: trattoria romana, pizzeria napoletana, bar, trattoria di pesce siciliana, più `mario`, cioè la fixture delle batterie round5 con i piatti del QA.
  - Ci sono testo e vocali trascritti male; romanesco, napoletano e siciliano; refusi; numeri scritti in lettere.
- **Giudice deterministico** sullo stato finale del menu, più le invarianti per turno. Classifica come fix-loop, con in più i «GRAVI di sicurezza» del PIANO. Il contratto è in `CONTRATTO.md`.
- **Runner** con l'interfaccia `BotUnderTest`, due adattatori e record/replay di Groq:
  - **attuale**: il route vero, con DB e store in memoria;
  - **nuovo**: per ora uno stub, `ready:false`.

| Famiglia | Conv. | Cosa copre |
|---|---|---|
| anche | 34 | «fallo anche con la parmigiana e mettila allo stesso prezzo», «e il tiramisù uguale», «mettila a 13» dopo una domanda |
| correzione | 29 | «no, intendevo…», «no scusa 14», «anzi», autocorrezioni a voce |
| ripristino | 24 | «rimettila com'era», «annulla», «torna come prima», «togli l'evidenza» |
| chiarimento | 31 | il bot chiede e il titolare risponde: nome, «sì la seconda», «tutti e due», «annulla» |
| multipla | 18 | più richieste in un messaggio, una incerta |
| scaduto | 18 | riferimenti dopo 30 minuti (non valgono) e tra 12 e 25 minuti (valgono) |
| domanda | 25 | domande pure, mai scrivere |
| negazione | 21 | «non toccare X», «X no», «tranne», «nun cagnà», «nun è fernuta» |
| ambiguita | 20 | deve chiedere: «il supplì», «lo spritz», «13 o 14» |
| togli | 17 | «togli» vuol dire nascondi; «togli la promo / l'evidenza / le ultime porzioni» toglie solo quella cosa |
| vocale | 32 | dettature storpiate e dialetto |
| qa1710 | 8 | i 4 casi del collaudo WhatsApp del 17/10 e varianti |
| manuel | 5 | il vocale «…il tiramisù a 6 euro e tojibo» seguito da «no, togli bo» |
| batterie | 36 | conversioni dei casi multi-turno più duri dei round 1–5c |

## Baseline: bot attuale in tre modi
- **Groq giù** (`off`): solo la riserva deterministica.
- **Replay**: le 10 risposte vere di gpt-oss-120b registrate oggi (9 conversazioni). Il resto vale come Groq giù.
- **Oracolo**: il bot attuale con un modello *ideale per messaggio*, come il `modelReply` delle batterie. È un tetto superiore dell'architettura attuale, non un modello vero.

Successo = nessun GRAVE e nessun MEDIO.

| Famiglia | Conv. | Groq giù | Replay | **Oracolo** | G/M/B oracolo | G/M/B replay | Chiarimenti/turni (oracolo) |
|---|---|---|---|---|---|---|---|
| anche | 34 | 41,2% | 41,2% | **47,1%** | 17/1/0 | 20/0/0 | 1,5% |
| correzione | 29 | 62,1% | 62,1% | **65,5%** | 9/1/0 | 11/0/0 | 0% |
| ripristino | 24 | 25% | 25% | **25%** | 18/0/0 | 18/0/0 | 9,8% |
| chiarimento | 31 | 83,9% | 83,9% | **90,3%** | 0/3/0 | 2/3/0 | 50,8% |
| multipla | 18 | 0% | 0% | **22,2%** | 13/1/0 | 17/1/0 | 36,1% |
| scaduto | 18 | 16,7% | 16,7% | **44,4%** | 3/7/0 | 14/1/0 | 13,9% |
| domanda | 25 | 68% | 68% | **100%** | 0/0/1 | 8/0/0 | 7,4% |
| negazione | 21 | 57,1% | 57,1% | **95,2%** | 1/0/0 | 8/1/0 | 4,3% |
| ambiguita | 20 | 80% | 80% | **85%** | 0/3/0 | 3/1/0 | 75% |
| togli | 17 | 47,1% | 47,1% | **94,1%** | 1/0/0 | 9/0/0 | 0% |
| vocale | 32 | 28,1% | 28,1% | **81,3%** | 5/1/0 | 23/0/0 | 2,9% |
| qa1710 | 8 | 100% | 100% | **100%** | 0/0/0 | 0/0/0 | 25% |
| manuel | 5 | 0% | 0% | **20%** | 3/1/0 | 3/2/0 | 0% |
| batterie | 36 | 75% | 75% | **97,2%** | 0/1/0 | 9/0/0 | 22,1% |
| **multi-turno** | 207 | 50,7% | 50,7% | **61,8%** | 65/14/0 | 96/6/0 | 18,1% |
| **TOTALE** | 318 | 51,6% | 51,6% | **72,0%** | 70/19/1 | 145/9/0 | 17,9% |

### Lettura
- **GRAVI di sicurezza: 0 in tutti e tre i modi.** Il bot attuale non scrive su una domanda, non dichiara «fatto» se non ha fatto, non cambia un piatto non nominato. I validatori G9 e le negazioni reggono, anche con il modello vero: con «u pisci spada nun si tocca, u tunnu a diciottu» gpt-oss ha risposto «pesce spada finito» e il server l'ha fermato con un chiarimento.
- **Il punto debole è il contesto, anche con un modello perfetto.** Con l'oracolo i GRAVI sono:
  - 39 `richiesta-persa`, per esempio «e la gricia uguale» → «Non ho capito cosa cambiare per Gricia»;
  - 28 `correzione-non-applicata`, per esempio «rimettila com'era», «no ho sbagliato, 20», «annulla» dopo una modifica già pubblicata;
  - 9 `non-applicato`, cioè richieste multiple perse dopo un chiarimento.

  Le famiglie peggiori: ripristino 25%, multipla 22%, manuel 20%, scaduto 44%, anche 47%.
- **Quello che con l'oracolo funziona già**: domande 100%, negazioni 95%, «togli» 94%, batterie 97%, i 4 casi del QA 100% (tutti deterministici). Il bot nuovo non deve peggiorarli.
- **Groq giù → 156 «C'è stato un problema»** (`errore-generico`). Nessuno è un danno sul menu, ma la riserva copre solo 176 conversazioni su 318: quelle deterministiche, che riescono al 93% (164/176).
- **Caso di Manuel.**
  - Primo vocale: il tiramisù va a 6 e «tojibo» viene **ignorato in silenzio**, senza nessuna domanda (`chiarimento-mancante`).
  - «no, togli bo»: con il modello vero il bot chiede «Quale piatto intendi: Che ne sacc, boh, pasta al ragù?»; con l'oracolo risponde «Non ho capito». Il bot attuale non lo risolve in nessun modo.
- **Campione con il modello vero**: 10 chiamate, 9 conversazioni, tutte fallite in replay; con l'oracolo falliscono le stesse 9. Due esiti dicono qualcosa di più:
  - `vocale-010` («'a marinara mettimmela a cinche euro e cinquanta»): gpt-oss capisce 5,50, ma il validatore G9 lo scarta perché «cinche» non è un numero che conosce. Il blocco è il server, non il modello;
  - `multipla-001`: gpt-oss sceglie «Supplì classico» da solo, senza chiedere quale dei due supplì. Lo stato finale è giusto, ma è un'ambiguità indovinata (MEDIO `chiarimento-mancante`).
- **Chiarimenti**: 17,9% dei turni con l'oracolo, 29 dei quali non attesi.
  - Esempi: «il caffè macchiato a uno e quaranta» → «Quale: Caffè macchiato / Caffè?»; «pure lo spritz campari uguale» → domanda tra Aperol e Campari.
  - «sì la seconda» o «sì la prima» non vengono capiti: il bot accetta solo «2», «il secondo» o il nome (3 MEDI).

### Latenza
- **Percorso deterministico** nel processo, senza rete né DB: p50 1,2 ms, p95 3 ms per turno. Misura solo il costo del codice del bot, non il webhook→commit reale (per quello: live-latenza, REPORT-A).
- **Groq vero**, dalle 10 chiamate registrate: p50 circa 600 ms (da 277 a 787 ms) per chiamata, da 1,5k a 1,8k token (1,4–1,6k di prompt). Nel replay la latenza registrata si somma a quella del turno (campi `recordedLlmMs` nei risultati).

### Limiti dichiarati
- **L'oracolo non è gpt-oss.** Vede solo il messaggio corrente e conosce le attese della conversazione:
  - riconosce i piatti per parola o per scheletro di consonanti («pisci» → «pesce»);
  - non sceglie mai un piatto ambiguo.

  I numeri «oracolo» sono un tetto superiore del bot attuale, non la sua resa reale.
- **Il replay copre solo le 9 conversazioni registrate.** Per le altre 133 che passano dall'IA, il numero «replay» coincide con «Groq giù».
- Whisper non è nel banco: il testo del vocale entra già trascritto.
- La latenza harness esclude rete, DB e Twilio.

## File
- `results-attuale-{off,replay,oracle}.json`: verdetti per conversazione (risposte, stato atteso e ottenuto, fallimenti). Accanto ci sono i `summary-attuale-*.md`.
- `CONTRATTO.md` (interfaccia, contesto, giudice, Groq), `token-log.md`, `implementation-notes-E.md`.
- Il codice è in `tests/eval/`:
  - `types.ts`, `fixtures/menus.ts`, `conversations.ts`, `judge.ts`, `runner.ts`, `groq-cache.ts`, `route-harness.ts`;
  - `adapters/current-oracle.ts` e `adapters/new-bot.ts` (lo stub);
  - `judge.test.ts`, sempre acceso: 11 prove;
  - `eval-current.test.ts` e `eval-new.test.ts`, accesi con `TAKO_EVAL=1`;
  - `cache/groq/` (10 risposte vere) e `cache/token-ledger.json`.

## Come lanciare
```sh
npx vitest run tests/eval/judge.test.ts                                           # set + giudice, 0 rete
TAKO_EVAL=1 TAKO_EVAL_GROQ=replay npx vitest run tests/eval/eval-current.test.ts   # bot attuale, 0 token
TAKO_EVAL=1 TAKO_EVAL_GROQ=oracle npx vitest run tests/eval/eval-current.test.ts   # tetto architettura attuale
TAKO_EVAL=1 npx vitest run tests/eval/eval-new.test.ts                             # bot nuovo + confronto (quando ready)
```
Determinismo: due esecuzioni di fila in `oracle` hanno dato 0 differenze su 318 verdetti (risposte, stato, fallimenti). Una run completa dura circa 1,5 s.

## Token
**16.905 token** con la chiave del bot (non esiste `groq-key-test.txt`), 10 chiamate, tetto 20.000. Il dettaglio è in `token-log.md`. Le riesecuzioni in replay costano 0.

## Per N (prossimo passo)
1. Implementare `adapters/new-bot.ts` con `createRouteBot({settings:{botBrain:true}, extraSql})`.
2. Fare un giro in `record` entro il proprio tetto, poi lavorare in `replay`.
3. Il goal è nel `confronto-*.json`, contro `attuale-oracle`: 0 GRAVI di sicurezza, MEDI ≤ 2% (6 su 318) e sotto il riferimento (19), multi-turno ≥ 71,8% (61,8% + 10).
