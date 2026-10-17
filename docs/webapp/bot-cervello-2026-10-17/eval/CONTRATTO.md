# Banco E · contratto per il bot sotto test (17/10/2026)

Il banco decide se il bot nuovo «che ragiona per primo con il contesto» (perimetro N) è migliore del bot attuale.
Codice in `tests/eval/`, risultati in questa cartella. Il banco non tocca il codice del bot.

## 1. Interfaccia `BotUnderTest`

Definita in `tests/eval/types.ts`.

```ts
interface BotUnderTest {
  name: string
  ready: boolean   // false: il runner salta il bot e lo scrive nel report
  run(conv: Conversation, menu: EvalMenu, ctx: {restaurant: string}): Promise<BotRun>
}
type BotRun = {turns: TurnResult[], finalMenu: EvalMenu, pending?: unknown}
type TurnResult = {
  reply: string            // tutto quello che il titolare riceve per quel messaggio (TwiML + messaggi REST)
  menuAfter: EvalMenu      // menu PUBBLICATO dopo il turno
  latencyMs: number
  llm: {calls, tokens, misses, recordedMs}
  context?: ContextTrace   // facoltativo, vedi §3
}
```

- **Ingresso**:
  - `conv.turns` è la conversazione;
  - `menu` è il menu pubblicato di partenza. Ha la forma del documento `workspace` (`menu-workspace-contract`): `menus[].sections[].items[]` con `id, name, price, available, hidden, featured, description, tags, promo{price,until}, scarcity{lastPortions,onlyToday}`.
- **Un `TurnResult` per ogni turno `text` o `voice`**, nello stesso ordine. I turni `wait` e `dash` non producono risultati.
- **Turni**:
  - `{text}`: messaggio scritto;
  - `{voice}`: vocale. Il testo è già la trascrizione storpiata, come la darebbe Whisper, e l'adattatore la consegna come risposta di `/audio/transcriptions`. Il banco **non misura Whisper**: il prompt di Whisper con i nomi dei piatti del perimetro Q va misurato a parte con vocali veri;
  - `{wait:n}`: passano n minuti. L'orologio è finto (`vi.setSystemTime`) e tra due messaggi passano 20 s;
  - `{dash:{dish,field,value}}`: una modifica fatta dalla dashboard nel frattempo. Il giudice la conta nello stato di partenza;
  - `q:true` segna una domanda pura: in quel turno il bot non deve scrivere nulla.
- **Orologio**: venerdì 16/10/2026 alle 12:00 di Roma, come le batterie. Si cambia con `TAKO_TEST_NOW=<ISO>`.

## 2. Strada consigliata per il bot nuovo

Si usa lo stesso percorso vero dell'adattatore attuale (`tests/eval/route-harness.ts`):
- webhook firmato, router, NLU, validatori e IA del bot;
- DB e store emulati in memoria;
- Twilio e Whisper finti;
- Groq in record/replay.

In `tests/eval/adapters/new-bot.ts`:

```ts
export function createNewBot(createRouteBot) {
  return createRouteBot({name: 'nuovo', settings: {botBrain: true}, extraSql: newBotSql})
}
```

- `settings` finisce nella riga `SELECT settings FROM restaurants`, quindi l'interruttore `settings.botBrain` si accende così.
- `extraSql(text, params)` risponde alle query delle **tabelle nuove** (cronologia conversazione, memoria appresa, log della memoria) e restituisce `undefined` per tutte le altre. Lo stato in memoria va azzerato a ogni conversazione: `run()` lo fa per le tabelle già emulate.
- Le query che nessuno riconosce finiscono in `unknownSql` nel file dei risultati. Dopo il primo giro va controllato che sia vuoto.
- Tabelle già emulate: `tako_whatsapp_links`, `_messages` (memoria «ultimo»), `_proposals` (con scadenza), `_ai_usage`, `_errors`, `_alerts`, `menu_workspace_versions`, `restaurants` (settings e name). Gli advisory lock sono no-op.
- Un bot che non passa dal route può implementare `BotUnderTest` da zero, con la stessa semantica dei turni e del menu.

## 3. Forma del contesto (PIANO §2) e traccia facoltativa

Il bot nuovo costruisce il contesto in quest'ordine, che conviene al caching di Groq:
1. scheda generale fissa;
2. scheda del ristoratore;
3. cronologia;
4. operazioni in sospeso;
5. messaggio.

Il banco si aspetta questi limiti, ed è su questi che sono scritte le attese:

| Blocco | Contenuto | Limite che il banco presuppone |
|---|---|---|
| scheda generale | istruzioni, schema JSON, glossario | identica per ogni chiamata |
| scheda ristoratore | menu compatto `[id,nome,prezzo,disponibile,nascosto,evidenza,categoria]` e memoria appresa (`alias`, `abitudini`, `errori_asr`, solo voci `attivo`) | — |
| cronologia | `[{role:'owner'\|'bot', text, at}]` | **≤10 scambi e ≤30 minuti**: dopo 30 minuti un riferimento («anche la gricia», «no scusa 14», «rimettila com'era») non vale più e il bot deve chiedere |
| in sospeso | riepilogo da confermare, domanda di chiarimento, scelta di prezzo | **10 minuti**, come oggi (batterie round5/5b): una risposta dopo 10 minuti non completa la domanda |
| messaggio | testo o trascrizione | — |

Uscita: `{intent, actions[], clarify?, reply_draft}` con JSON strict. I fatti della risposta («da 12,00 € a 13,00 €») li scrive il server dopo aver riletto il DB.

**Traccia facoltativa.** Se l'adattatore la espone in `TurnResult.context`, il giudice controlla due invarianti. La traccia ha questa forma:

```ts
type ContextTrace = {
  history: {role:'owner'|'bot', text:string, at:string /*ISO*/}[]
  now?: string      // ISO, l'ora del turno
  pending?: unknown
  memory?: unknown
  promptTokens?: number
}
```

- più di 20 messaggi nella cronologia → MEDIO `contesto-oltre-limiti`;
- un messaggio più vecchio di 30 minuti → MEDIO `contesto-oltre-limiti`.

## 4. Groq: record/replay, tetto, chiavi

Le opzioni si passano con `TAKO_EVAL_GROQ`:

| Modo | Comportamento |
|---|---|
| `replay` (default) | usa solo la cache; una risposta che manca vale come Groq giù (503), quindi entra in gioco la riserva del bot |
| `record` | cache prima; se manca, chiamata vera finché il tetto lo permette. Una conversazione parte almeno `TAKO_EVAL_GROQ_PACE_MS` (default 30000) dopo l'ultima chiamata vera, perché la quota per minuto è condivisa coi ristoranti veri. Dopo un 429 si ferma |
| `off` | Groq sempre giù: misura la riserva deterministica |
| `oracle` | solo bot attuale: un modello ideale per messaggio, vedi REPORT-E. Il bot nuovo non ce l'ha |

- **Cache**: `tests/eval/cache/groq/<hash>.json`. L'hash copre path, modello, messaggi, response_format, temperatura, reasoning_effort e max token. Dentro c'è la risposta vera con `usage`, la latenza e la conversazione d'origine, mai la chiave. Si committa: le riesecuzioni costano 0 token.
- **Il bot nuovo ha prompt diversi**: la prima esecuzione va in `record` entro il proprio tetto, poi si lavora in `replay`. Ogni cambio di prompt invalida la cache delle chiamate che tocca.
- **Tetto**: `TAKO_EVAL_GROQ_MAX_TOKENS` (default 20000) è il tetto **di giornata**. Il conteggio viene dal campo `usage` delle risposte vere e si salva in `tests/eval/cache/token-ledger.json` per giorno, con il giorno reale e non quello finto.
  - Prima di ogni chiamata il banco stima i token (caratteri/3 + 1200) e non chiama se la stima supera il tetto.
  - Le chiamate vere costano circa 1,5–1,8k token l'una con il prompt attuale.
- **Chiave**, in quest'ordine:
  1. `TAKO_EVAL_GROQ_KEY_FILE`;
  2. `~/.config/tako-webapp/groq-key-test.txt`, se esiste;
  3. `groq-key.txt`, cioè la chiave del bot.

  Un percorso che contiene «traduzioni» viene rifiutato. La chiave non viene mai stampata né scritta.
- La rete vera verso `api.groq.com` o `twilio.com` fuori da questo modulo genera un errore.

## 5. Giudice

Il giudice è in `tests/eval/judge.ts`, è deterministico e non usa LLM. Per ogni conversazione:
- **stato finale**: `diff(menu di partenza + dashboard, menu finale)` deve essere uguale a `changes`, o a uno degli `alt`. Le chiavi sono `price|Piatto|13`, `available|Piatto|false`, `hidden|…`, `featured|…`, `promo|…|null`, `last|…`, `create|nome|prezzo|categoria`;
- **invarianti per turno**:
  - risposta vuota;
  - scrittura in un turno `q`;
  - «fatto/confermato» senza scrittura;
  - risposta incoerente con lo stato («X: prezzo da A a B», «X: finito», «X: nascosto» confrontati col menu dopo il turno);
  - errore generico;
  - frase presa come nome di piatto;
  - valori grezzi;
- **chiarimenti**:
  - `ask:[n]`: al turno n il bot deve fare una domanda, senza scrivere a meno che `askNoWrite:false`;
  - «non ho capito / non trovo» non conta come domanda;
  - un riepilogo da confermare con OK non è una domanda;
- **`pick`**: «sì la seconda» si risolve sulle opzioni che il bot ha mostrato davvero, elenco numerato o ordine di comparsa;
- **`interim`**: una scrittura giusta al momento, che il titolare poi corregge o annulla. Se resta nel menu è `correzione-non-applicata` e non `modifica-non-richiesta`.

**Gravità**: come fix-loop.md, il peggiore per caso.

| Gravità | Codici |
|---|---|
| GRAVE | `modifica-non-richiesta`, `modifica-sbagliata`, `scrittura-su-domanda`, `fatto-falso`, `risposta-incoerente`, `scrive-invece-di-chiedere`, `errore-generico`, `richiesta-persa` («non trovo / non ho capito» con richiesta mancata), `non-applicato`, `correzione-non-applicata`, `nessuna-risposta`, `frase-come-piatto` |
| MEDIO | `chiede-invece-di-agire`, `chiarimento-mancante`, `in-attesa-ok`, `nome-alterato`, `opzioni-non-leggibili`, `contesto-oltre-limiti` |
| BASSO | `risposta-non-pertinente`, `valori-grezzi` |

- **GRAVI di sicurezza** (colonna a parte, sono i GRAVI del goal del PIANO): `modifica-non-richiesta`, `modifica-sbagliata`, `scrittura-su-domanda`, `fatto-falso`, `risposta-incoerente`, `scrive-invece-di-chiedere`.
- **Successo** = nessun GRAVE e nessun MEDIO. I BASSI sono ammessi.
- **Giudice LLM per tono e chiarezza**: non implementato e spento di default, come previsto. Non serve a decidere il goal; se servirà va aggiunto come passaggio facoltativo sopra `results-*.json`, mai al posto del giudice deterministico.

## 6. Goal e confronto

Il confronto lo fa `eval-new.test.ts` e lo scrive in `confronto-<nome>.json`:
- `graviSicurezza`: 0 GRAVI di sicurezza su tutto il banco;
- `medi2pct`: MEDI ≤ 2% delle conversazioni e meno di quelli del riferimento;
- `multiTurnoPiu10`: successo sui multi-turno ≥ quello del riferimento + 10 punti;
- più gli elenchi delle conversazioni migliorate e peggiorate.

Il riferimento di default è `attuale-oracle`, il bot attuale con IA ideale per messaggio: è il paragone più duro. Con `TAKO_EVAL_BASE=attuale-replay` o `attuale-off` il confronto si fa nello stesso modo Groq.

## 7. Comandi

```sh
# giudice e set (sempre accesi nella suite, nessuna rete)
npx vitest run tests/eval/judge.test.ts
# bot attuale: replay (0 token) · off (Groq giù) · oracle (IA ideale) · record (token veri entro il tetto)
TAKO_EVAL=1 TAKO_EVAL_GROQ=replay npx vitest run tests/eval/eval-current.test.ts
TAKO_EVAL=1 TAKO_EVAL_GROQ=oracle npx vitest run tests/eval/eval-current.test.ts
TAKO_EVAL=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_MAX_TOKENS=20000 TAKO_EVAL_ONLY=anche-001,manuel-001 npx vitest run tests/eval/eval-current.test.ts
# bot nuovo + confronto
TAKO_EVAL=1 TAKO_EVAL_GROQ=record npx vitest run tests/eval/eval-new.test.ts
# filtri: TAKO_EVAL_ONLY=id,id · TAKO_EVAL_FAMILY=anche,scaduto · nome dei risultati TAKO_EVAL_OUT
```

Nel worktree serve `apps/server/node_modules` come negli altri worktree (vedi implementation-notes-E.md).

## 8. Regole per il set

- **Non indebolire mai un'attesa.** Un caso che il bot nuovo non passa resta com'è; si corregge il bot.
- **Casi nuovi in coda alla loro famiglia.** Gli id sono posizionali e `INTERIM` è indicizzato per id; un caso inserito in mezzo sposta gli id successivi. Il test `judge.test.ts` controlla che ogni piatto citato esista nella sua fixture.
- **Le attese descrivono il comportamento giusto per il titolare**, non quello del bot attuale.
- **Le scelte di prodotto aperte sono annotate in `note`.** Esempio: «14» dopo una modifica fatta in dashboard: è accettato sia chiedere sia applicare.
