# REPORT N2 — cervello del bot titolare, fase 2 (integrazione) · 17/10/2026

Branch `codex/bot-brain-1017`. Contiene origin/main dc742e0 (Q, v110) e il banco E (codex/bot-eval-1017 03e4f48). **Edge online: v112**. Il cervello è **acceso solo sul QA** 26050ecd. Per tutti gli altri locali è spento, quindi lì vale il comportamento di oggi.
**Ho deployato io l'edge (v111 e poi v112).** Deviazioni e scelte: `implementation-notes-N.md` §11–17. Token: `token-log.md`.

## Cosa c'è
- **Route** (`routes/twilio-menu.ts` + `lib/owner-brain-route.ts`), dietro `settings.botBrain` e `TAKO_BOT_BRAIN_OFF=1`.
  - Il cervello prende per primo i messaggi con cronologia recente (≤30 min) che rimandano a prima, tutti quelli che oggi andavano all'IA e le scelte «quale?» del deterministico. La riserva è il turno di oggi (`brainOff`).
  - La cronologia è salvata per ogni turno. Ci sono i comandi «dimentica X» e «cosa hai imparato?».
  - «com'era» vale 30 minuti. La memoria appresa si consolida dopo la risposta.
- **Validatore**, con le regole attuali più:
  - contesto: piatti e prezzi del titolare presi dalla cronologia, mai i prezzi scritti dal bot;
  - `restore` per «no, intendevo X», con ripristino automatico se il modello lo dimentica;
  - piatto ambiguo o coperto da un altro → domanda «quale?» con l'azione già capita, mentre le parti chiare restano;
  - rimando incerto → domanda;
  - una domanda del bot scade dopo 10 minuti;
  - numeri in dialetto;
  - «anche X» dopo un prezzo = stesso prezzo;
  - domande = zero scritture.
- **Più parti incerte (regola di Manuel)**: le parti chiare restano in sospeso e c'è una domanda per ogni parte incerta, nello stesso messaggio.
  - Funziona sia nella riserva (`twilio-menu-hold`) sia nel cervello (campo `uncertain`).
  - Le risposte si possono dare per lettera, ordinale o nome. «No» pubblica le parti chiare, «annulla» non pubblica niente.
  - Batteria `tests/owner-bot-multi-uncertain.test.ts` (65 messaggi con le risposte, 328 asserzioni).
- **Client Groq unico**: `withRateLimit` è ora esportato. Ho portato in `negatedClauses` la negazione in coda («la carbonara lascia stare»).
- **Banco**: `tests/eval/adapters/new-bot.ts` (route vero, tabelle nuove emulate) e un oracolo del cervello con contesto. Le chiavi di test ruotano (test → test-2 al 429) con un tetto per chiave.
- **Copy cambiate**, valide anche a cervello spento (il giudice le leggeva come fatti): riepilogo della parte incerta numerato e «non ancora pubblicato»; «Nessuna modifica: il menu è già così».

## Numeri: attuale contro nuovo (banco E, 318 conversazioni)
| Bot · modo | Conv. | Successo | Multi-turno | GRAVI | MEDI | GRAVI sicurezza |
|---|---|---|---|---|---|---|
| attuale v108 · oracolo (riferimento di E) | 318 | 229 (72.0%) | 128/207 (61.8%) | 70 | 19 | 0 |
| attuale v110 · oracolo | 318 | 237 (74.5%) | 137/207 (66.2%) | 63 | 18 | 5 |
| attuale (questo ramo, cervello SPENTO) · oracolo | 318 | 240 (75.5%) | 140/207 (67.6%) | 59 | 19 | 0 |
| **nuovo (cervello acceso) · oracolo** | 318 | 294 (92.5%) | 189/207 (91.3%) | 18 | 6 | 0 |
| attuale · Groq giù | 318 | 164 (51.6%) | 105/207 (50.7%) | 150 | 4 | 0 |
| nuovo · Groq giù (riserva) | 318 | 180 (56.6%) | 118/207 (57.0%) | 132 | 6 | 0 |
| nuovo · gpt-oss vero, campione 38 · giro 1 | 38 | 25 (65.8%) | 18/29 (62.1%) | 7 | 6 | 0 |
| **nuovo · gpt-oss vero, campione 38 · giro 2 (replay finale)** | 38 | 34 (89.5%) | 26/29 (89.7%) | 2 | 2 | 0 |

- **Obiettivo, sull'oracolo**: 0 GRAVI di sicurezza ✓; MEDI 6 (≤6 e <19) ✓; multi-turno 91,3% (≥71,8%) ✓.
- **Con gpt-oss vero**, sulle stesse 38 conversazioni del campione: nuovo 34/38 contro attuale 23/38 in oracolo e 14/38 in replay. 0 GRAVI di sicurezza in entrambi i giri.
  - I 2 GRAVI del giro 2 sono errori generici di Groq non disponibile: richieste rifiutate perché le chiavi di test avevano raggiunto il tetto.
  - Restano 2 MEDI.
- **Groq giù**: nuovo 56,6% contro attuale 51,6%, 0 GRAVI di sicurezza.
- **Batterie** round1–6 (incluse 6b e 6-qa): 0/0/0.
- **Suite completa**: 3.146 test, **gli stessi 12 rossi della base** (owner-link 7, presentation 2, PDF 1, parity 2). tsc del server verde sui file toccati.

## Token e latenza
- **Chiavi di test**: test 148.043, test-2 146.499 (≤150k ciascuna).
- **Chiave del bot**: circa 6.900 token per la verifica dal vivo (tetto 12k). Oracolo e replay costano 0 token.
- **Prompt**: circa 3,1k token con il menu tipico, fino a ~4k con 10 scambi di cronologia, ~6,3k con un menu da 324 piatti.
- **Latenza Groq misurata**: p50 ~0,9 s per chiamata (registrata nel campione: p50 1,1 s, p95 2,6 s con la latenza Groq).

## Edge
- v110 (`3890471c…`) → v111 (`5d11a452…`), poi → **v112** (`0b9bf80e…`).
- **v112** apre la modalità sincrona del QA a qualunque numero col campo firmato `TakoSyncTest` (in v111 valeva solo il numero di prova, ma il QA permette un solo collegamento).
- Il bundle è v110 più il mio delta. Modifiche reali solo in `twilio-menu-copy/sales/clarify/alerts/hold`, `routes/twilio-menu` e nei 5 moduli nuovi `owner-brain-*`. Altre 53 sezioni cambiano solo per la numerazione dei nomi di esbuild (verificato normalizzando i suffissi). Ordine delle sezioni identico.
- check-active fatto prima di ogni deploy (110, poi 111).

## Verifica dal vivo (`live-N/verify-live-n.mjs`, v112): **4/4 PASS**
- Webhook firmato con il campo `TakoSyncTest=1`: sul QA anche i turni dell'IA rispondono **solo nel TwiML**, senza invii REST né avvisi.
- **Twilio: 0 messaggi in uscita verso il numero di Manuel durante la prova** (controllo prima e dopo sull'API Messages).
- Casi:
  - «tojibo» → «no, togli bo»: boh nascosto;
  - «il piatto di verifica a 14» → «fallo anche con la parmigiana e mettila allo stesso prezzo»: tutti e due a 14, passando dal cervello;
  - «rimettila com'era»: annullato;
  - «il piatto a 15» → «sì la seconda»: la seconda opzione mostrata a 15.
- **QA ripristinato per hash**: proposta e memorie del numero rimesse com'erano, cronologia e memoria del cervello del QA azzerate.

## Rollback
- **Edge**: `cp ~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v110-bot-quick.ts release/serverless/candidate/index.ts && cp ~/.config/tako-webapp/rollback-edge-20261017/magick-wasm-0.0.44.js release/serverless/candidate/ && node scripts/translations/deploy-projection.mjs` (da un worktree con `.env.web`; prima `check-active 112 0b9bf80e6ba5ce343bd7c2d177daf24886abb87dbc6a84736fa15529805f52d4`). Le copie v111 e v112 sono nella stessa cartella.
- **Interruttore**: `UPDATE restaurants SET settings=settings-'botBrain' WHERE id='26050ecd-2e55-4057-a4c5-bff2b449cd47'`. Per spegnerlo ovunque senza toccare i dati: secret `TAKO_BOT_BRAIN_OFF=1`.
- **SQL**: `sql/rollback.sql`. Toglie solo le 3 tabelle nuove. Le ho applicate con `sql/up.sql` (additivo).

## Cosa misurare domani col piano Developer
1. Banco completo con gpt-oss vero su tutte le 318 conversazioni (il prompt nuovo costa ~3,5–4k token per chiamata; ~220 conversazioni passano dal cervello).
2. Tasso di `json_validate_failed` e di ripiego sul 20b; latenza p50/p95 per chiamata e webhook→commit sul QA.
3. Cache Groq: `prompt_tokens_details.cached_tokens` sul piano Developer (oggi il campo non c'è).
4. Le 4 conversazioni che il campione non ha registrato per il tetto (manuel-005, batterie-001 e due turni di altre).

Comando esatto:
```sh
TAKO_EVAL=1 TAKO_EVAL_TIMEOUT_MS=10800000 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_MAX_TOKENS=1500000 TAKO_EVAL_GROQ_MAX_TOKENS_PER_KEY=1500000 TAKO_EVAL_GROQ_PACE_MS=5000 TAKO_EVAL_OUT=nuovo-record-completo TAKO_EVAL_BASE=attuale-oracle-n2 npx vitest run tests/eval/eval-new.test.ts
```
Usa `groq-key-test.txt` e al 429 `groq-key-test-2.txt`; per la chiave Developer: `TAKO_EVAL_GROQ_KEY_FILE=<file>`. Poi in replay, a 0 token: `TAKO_EVAL=1 TAKO_EVAL_GROQ=replay TAKO_EVAL_OUT=nuovo-replay npx vitest run tests/eval/eval-new.test.ts`.

## Rischi e limiti
- **Oracolo ≠ gpt-oss.** Il campione vero (38) è al livello dell'oracolo dopo due giri di correzioni, ma il banco completo vero va fatto domani.
- **MEDI residui sull'oracolo (6)**:
  - 2 sono scelte di Q: l'ipotesi «togliere X?» va confermata anche quando è l'unica parte;
  - 1 è «u tunnu» = tonno, che il G9 non riconosce;
  - 3 sono richieste multiple con un piatto generico («a pasta»).
- **La copia del riepilogo e «Nessuna modifica»** cambiano il testo anche per i clienti (cervello spento): più chiaro, nessun effetto sulle batterie.
- **Modalità sincrona del QA**: vale solo col campo firmato (serve il token Twilio). Le risposte lente dell'IA (>15 s) andrebbero in timeout del webhook Twilio vero, ma la modalità la usano solo i nostri script.
- **Quota free**: il cervello costa ~2× la chiamata attuale. Per i clienti va acceso col piano Developer (decisione 8).
