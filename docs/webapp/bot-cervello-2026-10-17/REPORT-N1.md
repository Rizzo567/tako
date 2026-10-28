# REPORT N1 — cervello del bot titolare, fase 1 (costruzione) · 17/10/2026

Branch `codex/bot-brain-1017` (base origin/main 3bd75b5). Nessun deploy, nessun SQL applicato, nessun file esistente modificato (route e lib di Q intatti). Scoperta: `UNKNOWNS-N.md`. Deviazioni: `implementation-notes-N.md`. Consumo: `token-log.md`.

## Architettura

```
messaggio ─► owner-brain-context  scheda generale fissa (regole, sicurezza, tono, schema, glossario ~150 voci) ← identica per tutti (cache)
             (puro, Deno-safe)    scheda ristoratore: menu compatto p1/c1 + memoria ATTIVA
                                  cronologia ≤10 scambi / ≤30 min (turni user/assistant)
                                  IN SOSPESO (proposta non confermata, chiarimento aperto + messaggio che l'ha causato)
                                  MESSAGGIO
          ─► owner-brain-plan     1 chiamata Groq json_schema strict {intent, actions[], read, item_refs, capability_ids,
                                  clarify, alias_used, reply_draft}; 120b → 20b di riserva; budget 8 s
                                  validatore: codici→id · price_ref («stesso prezzo di X») riletto dal menu · price_delta
                                  («aumenta di N») → assoluto e riverificato · validateMenuPlan attuale (G9, piatti non
                                  nominati, prezzi detti, completezza, esclusioni) · negazioni (negatedClauses + coda)
                                  · domande = zero scritture · piatto ambiguo → chiarimento · memoria attiva = piatto nominato
                                  → MenuPlan identico a quello di oggi  |  {path:'fallback'} se Groq giù/quota/JSON/timeout
          ─► turnFor (esistente)  G6 prezzi implausibili, >3 azioni → riepilogo, scrittura, pubblicazione
          ─► composeReply         fatti SOLO da verifyApplied sul menu riletto; bozza del modello solo per chiarimenti/chat
                                  e solo se senza parole d'esito né prezzi
dopo la risposta ─► owner-brain-memory  segnali certi → consolidate (candidato→attivo con 2 conferme/3 usi; correzione/annulla
                                  → revisione; alias solo verso piatti esistenti, collisioni bloccate; giudice LLM piccolo solo
                                  per voci nuove non già capite dal G9) · «dimentica X» · «cosa hai imparato?» · reconcile
                                  (piatto eliminato/rinominato) · cronologia TTL 30 min · log append-only senza messaggi
interruttore ─► owner-brain-switch  settings.botBrain===true (default spento) · TAKO_BOT_BRAIN_OFF=1 spegne tutto
banco E ─► owner-brain-eval      createBrainEvalBot (stato in memoria) + brainBotUnderTest (forma BotUnderTest di E)
```

File: `apps/server/src/lib/owner-brain-{context,plan,memory,switch,eval}.ts`; SQL `sql/up.sql` (3 tabelle: memoria, log, cronologia; RLS + grant `takomenu_runtime`, log solo INSERT/SELECT) e `sql/rollback.sql`.
Test: `tests/owner-brain.test.ts` (38, Groq finto), `tests/owner-brain-battery.test.ts` (batteria avversaria 310 frasi, modello ostile che propone sempre una scrittura: 0 violazioni), `tests/owner-brain-measure.ts` (token offline), `tests/owner-brain-live.ts` (giro reale con tetto). 43/43 verdi; suite bot esistenti senza nuovi rossi (`twilio-menu-sales.test.ts` fallisce già sulla base in questo worktree: manca `@tako/db` nei node_modules).

## Token per messaggio (misurati su Groq, gpt-oss)

| caso | prompt reale | completion | stima offline |
|---|---|---|---|
| tipico 48 piatti, senza cronologia | 3.053–3.127 | 109–302 | 3.040 |
| tipico con 10 scambi di cronologia + proposta | — (non speso) | — | 3.567 |
| grande 324 piatti, 3 menu (compressione 3, tutti i nomi) | 6.285 | 553 | 6.050 |

Scheda generale ≈ 2.200 token (fissa, cacheabile), scheda ristoratore ≈ 500 (tipico) / ≈ 3.400 (324 piatti). Tipico ≤ 4k ✓; i menu da 300+ piatti stanno a ~6,3k.
**Cache Groq: non verificata.** In 6 chiamate con prefisso identico Groq non ha mai restituito `prompt_tokens_details.cached_tokens` (il campo manca proprio). L'ordine del contesto è già quello giusto; resta da controllare in console / piano Developer.

## Latenza della chiamata (rete inclusa)

590–1.114 ms sul menu tipico (p50 ≈ 0,9 s), 1.650 ms sul menu grande, 419 ms su gpt-oss-20b. JSON strict: 6/6 validi, 0 `json_validate_failed` (campione piccolo).
Esiti del giro reale: «carbonara finita + amatriciana allo stesso prezzo della cacio e pepe» → esaurita + 11 € riletti ✓; «quanto costa la tagliata?» → chiarimento manzo/tonno ✓ (120b) — con il 20b lettura della sola manzo, ora bloccata dalla guardia «piatto ambiguo»; multi-turno «quella di tonno, a 21» dopo il chiarimento → prezzo sulla tonno ✓; dialetto «nun ce sta cchiù 'a parmigiana, e 'o babà costa sette euri» → esaurita + 7 € ✓; grande «linguine alle vongole 15 + trofie al pesto finite» ✓.
Consumo: 23.263 token (tetto 25k), chiave del bot (non esiste `groq-key-test.txt`).

## Piano di integrazione nel route (fase 2, DOPO il merge di Q)

Punti in `apps/server/src/routes/twilio-menu.ts` (righe sulla base 3bd75b5):
1. **Riga 241, `resolveTurn`** — al posto di `groqMenuPlan`/`groqPendingMenuPlan` quando `readBotBrain(db,ctx.tenant)`: `planOwnerMessage({refs,sections,memory,history,pending:{proposal:pending,clarify},pendingActions:pending,message:text,restaurantName},key,ai)` con `memory/history` da `sqlBrainStore(db)`. `path==='brain'` → `plan=decision.plan`, `exclude=[...exclude,...decision.exclude]`, poi `turnFor(...planned...)` invariato (G6, esclusioni, riepilogo, scrittura, testo dai fatti). `path==='fallback'` → il codice di oggi, identico. Per `intent==='chat'`/`clarify` con bozza sicura usare `composeReply` invece di `copy.notUnderstood`.
2. **Righe 108–178, `menuTurnCore`** («capisce per primo»): con interruttore acceso, dopo conferma/annulla/foto/scelte in sospeso (righe 77–107) e dopo il solo controllo «annulla l'ultima modifica» (`readLast`/`revertTarget`, righe 108–126), restituire `{llm:true}` saltando `followUp`, `createStep`, bulk, vendite e `parseIntent` (righe 126–178). Riserva: se il cervello rinuncia, `resolveTurn` richiama `menuTurn` con una nuova opzione `brainOff:true` → percorso deterministico completo di oggi.
3. **Riga 264, `jobMessage`** — dopo la risposta: `inBackground(appendHistory(...))` e, se ci sono azioni scritte, `consolidate(store,tenant,signalsFromTurn(...),{refs,sections,judge:groqMemoryJudge(key,{meter:recordUsage})})` in background (fuori dal percorso critico, quota contata in `recordUsage`).
4. **Chiarimento aperto**: la proposta `kind:'choice'` in `tako_whatsapp_proposals` dà gli `itemIds`; `source` = ultimo messaggio del titolare in cronologia prima della domanda del bot.
5. **Comandi memoria** (`memoryCommand`: «dimentica X», «cosa hai imparato?») prima di tutto, accanto a `helpWords`.
6. **Riuso client**: esportare `withRateLimit` da `twilio-menu-ai.ts` e far usare quello a `callBrain` (stessa politica); `meter:recordUsage` passa già da `GroqOptions`.
7. **Banco E**: `createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql})` con le 3 tabelle emulate (tutte le query sono in `sqlBrainStore`). Fino ad allora `brainBotUnderTest` misura il cervello da solo (con `fallback` per passare al bot attuale i turni in cui rinuncia).
8. SQL `up.sql` sul DB (tabelle additive) solo col via di Manuel; interruttore acceso solo sul QA 26050ecd.

## Rischi

- **Quota free (critico)**: 8k TPM su gpt-oss-120b = ~2 messaggi/minuto in tutto con il menu tipico, 1/minuto con un menu da 300 piatti; nello spike il 120b è andato in 429 due volte e ha risposto il 20b. 200k TPD ≈ 60 messaggi/giorno in totale. Conferma la decisione 8: clienti solo con il piano Developer.
- **Riserva 20b**: capisce peggio (ha scelto da solo tra due tagliate). Coperto da guardia «piatto ambiguo» + G9, ma va misurato a parte sul banco E.
- **Cache non dimostrata**: se i token in cache non sono scontati né esclusi dai limiti, il costo resta pieno (~3k per messaggio).
- **«Capisce per primo»** salta rami deterministici: le batterie round1–5c cambiano comportamento col cervello acceso; servono riserva esplicita (`brainOff`) e banco E prima di accendere anche il QA.
- **Memoria**: soglie 2 conferme / 3 usi non tarate; il giudice LLM costa ~400 token, solo per voci nuove.
- **Doppio client Groq** finché `withRateLimit` non è esportato.
- **JSON strict**: campione piccolo (6); il tasso reale di `json_validate_failed` va misurato su 200 messaggi.
