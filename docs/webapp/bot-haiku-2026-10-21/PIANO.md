# PIANO FINALE — Motore Haiku 5.5 per il bot WhatsApp titolare Takomenu

**Esecuzione:** martedì 20/10/2026, partenza ~21:00, una sessione autonoma (Opus 5.5 coordinatore + sottoagenti). Durata massima **5 ore** (stop duro 02:00).
**Consegna:** mercoledì 21/10 mattina Manuel prova dal telefono sul **locale QA**.
**Documenti da leggere prima di tutto (in quest'ordine):** questo file → `OBIETTIVO.md` (stessa cartella, è il contratto) → `FASE1-REVISIONE.md` §2–3 (mappa del codice con righe). `FASE2-DA-ZERO.md` è solo riferimento: le idee utili sono già incorporate qui.
**Cartella:** `/Users/manuel/Documents/brain/output/takomenu-motore-haiku-revisione-2026-10-19/`

---

## 0. Cosa costruisci, in una frase

Nel cervello del bot titolare (fase R, oggi su Groq), **sostituisci il modello Groq con Claude Haiku 5.5** mantenendo lo stesso schema, che è già quello giusto:
**il modello legge il contesto e produce un piano JSON → il validatore del server lo controlla (1 auto-correzione) → il server scrive una volta sola → la risposta si costruisce dai fatti riletti.**
Non riscrivi l'architettura: cambi il motore, aggiorni prompt e lessico, chiudi i buchi elencati sotto, misuri col modello vero.

> Perché così (decisione di revisione 19/10): la Fase 2 ha progettato da zero esattamente questo schema (piano tipizzato + validatore deterministico + scrittura atomica + «fatto» solo dai fatti); il codice di fase R lo implementa già (`owner-brain-plan.ts`: `callBrain` → `validateBrainPlan` → auto-correzione → `composeReply`; scrittura nella coda di `brainTurnR`). Il ciclo a strumenti dello spike (piano del 17/10) è **scartato**: più codice, più passi, più latenza, più difficile da testare, nessun vantaggio misurato (spike 78/92 vs Groq 80/92).

---

## 1. Decisioni bloccate (non reinterpretarle)

1. **Haiku 5.5 (`claude-haiku-5-5`) unico cervello.** Niente Sonnet, niente «modello forte», niente ciclo a strumenti.
2. **Groq spento come cervello.** Con `botEngine=haiku`: **zero** chiamate a `api.groq.com/.../chat/completions` durante un turno (test obbligatorio). Nessun fallback a Groq, nessun fallback al percorso deterministico. Haiku giù/timeout/refusal → `copy.brainDown` + `reportFailure` → avviso WhatsApp a Manuel.
3. **Groq resta solo come servizio di trascrizione vocali** (Whisper, `transcribeAudio`): Haiku non riceve audio. **Non toccare `GROQ_API_KEY` né `transcribeAudio`.** Traduzioni (chiave separata) fuori perimetro.
4. **Estrattore del menu intero (F1, oggi Groq in `onboarding-planner.ts`) passa a Haiku** con lo stesso schema JSON (task T3). Se non ci sta nel tempo → resta su Groq e si dichiara nel REPORT (taglio ammesso, unico punto in cui Groq farebbe ancora «ragionamento»).
5. **Interruttore unico** `restaurants.settings.botEngine ∈ {'haiku','groq'}`. Se assente → env `TAKO_BOT_ENGINE_DEFAULT` → se assente anche quella → **`'haiku'`**. Lettore unico in `owner-brain-switch.ts`. `TAKO_BOT_BRAIN_OFF=1` resta il kill switch globale.
6. **Lessico fisso:** Menu / Sottomenu / Sezione / Piatti (vedi OBIETTIVO). Mappa al codice:
   | Ristoratore | Codice |
   |---|---|
   | Menu | `menus[]` / `MenuRef.menu` |
   | Sottomenu | `sections` con `parentSectionId=null` / `SectionRef` (oggi detta «categoria» nei commenti e nel prompt) |
   | Sezione | `sections` con `parentSectionId≠null` (gruppi pubblici) |
   | Piatti | `items` / `MenuRef` |
   Nel prompt al modello e in **ogni** testo verso il titolare: mai la parola «categoria». Il modello deve capire «categoria» detta dal titolare come sottomenu.
7. **Memoria = alias confermati.** Si usa `tako_owner_brain_memory` esistente (`kind alias|asr`, `state active`): nel contesto entrano **solo** le `active`. Nessuna «nota del locale» riscritta dal modello. Nessuna tabella nuova.
8. **Menu intero solo da testo o vocale.** Niente foto/immagini di menu.
9. **Nessuna tabella nuova, nessuna migrazione.** Si riusano proposte (`tako_whatsapp_proposals`), undo 10 min, cronologia (`tako_owner_brain_turns`), memoria.
10. **Chiamata API via `fetch`** su `POST https://api.anthropic.com/v1/messages` (header `x-api-key`, `anthropic-version: 2023-06-01`), niente SDK (incognita bundle Deno).

---

## 2. Prerequisiti (il coordinatore li verifica nei primi 10 minuti; se manca uno dei BLOCCANTI → exit E0)

| # | Cosa | Bloccante | Come si verifica |
|---|---|---|---|
| P1 | Chiave Anthropic in `~/.config/tako-webapp/anthropic-key.txt` (chmod 600) | **sì** | file esiste e non vuoto; mai stamparla |
| P2 | Risposte di Manuel al §11 presenti in `RISPOSTE-MANUEL.md` in questa cartella | no (se manca: usa i default del §11) | file |
| P3 | Repo `/Users/manuel/Projects/Tako/Tako-bot-anthropic` pulito su `codex/bot-anthropic-1019` | **sì** | `git status` (i `results-*.json` modificati delle batterie R: `git stash push -m pre-haiku` — mai `git checkout --`) |
| P4 | Stack dev avviabile (`pnpm dev`) per i test con DB | **sì** | come nei report R |
| P5 | `sleeping off` attivo, guardia ventole attiva | no | `pmset -g` |

---

## 3. Base di codice (prima di scrivere una riga) — 20 min

1. `git fetch --all`. Controlla se la run cloud del 19/10 ha pushato qualcosa su `codex/bot-anthropic-1019`: se sì, leggi `docs/webapp/bot-anthropic-2026-10-19/STATO.md` e **non** riprenderla — questo piano la sostituisce; tieni solo l'eventuale `CHIAVI-OK.md`.
2. **Merge di `feat/qr-titolare-benvenuto` (0715cd0) = v119 online** dentro `codex/bot-anthropic-1019`. `origin/main` (ee70594) è **dietro** e non è la base. `codex/manuel-email-activation` fuori perimetro.
3. Conflitti su `routes/twilio-menu.ts`: vince la versione v119 (benvenuto, credenziali, link titolare non si toccano).
4. `pnpm exec tsc --noEmit` + suite vitest → scrivi in `STATO.md` l'elenco esatto dei test rossi **di partenza** (attesi ~14). Da qui in poi: «nessun rosso nuovo».
5. Commit «base: merge v119» + push. Se il merge non si risolve in 20 min → **exit E1**.

---

## 4. Architettura finale (cosa cambia rispetto a fase R)

```
Twilio → route (firma, sid idempotente, lock telefono, link)  [INVARIATO]
  → ack TwiML vuoto → job in waitUntil (watchdog 90 s)         [INVARIATO]
     vocale → Whisper Groq (solo ASR)                           [INVARIATO]
     → menuTurn → engine = readBotEngine(tenant)                [NUOVO: switch]
        → brainTurnR: legge workspace + proposta + undo + cronologia + memoria active   [INVARIATO]
           → planOwnerMessage(input, engine)                    [MODIFICATO]
                buildBrainContext  (lessico nuovo, solo alias active, data in blocco volatile)
                callHaiku  (fetch /v1/messages, output_config.format=json_schema, effort low, 10 s, 1 retry)  [NUOVO]
                validateBrainPlan → rifiuto? → 1 auto-correzione col motivo → altrimenti domanda   [INVARIATO]
           → tx finale (lock, revision check, apply/publish/propose/undo, fatti riletti, learnAfter)   [INVARIATO]
              conflitto di revision → rigioca il turno UNA volta                                     [NUOVO]
           → composeReply (fatti dal server, bozza del modello solo per domande/chiacchiera)        [INVARIATO + lessico]
     errore Haiku (dopo retry) / refusal / max_tokens / JSON invalido 2 volte → brainDown + reportFailure  [NUOVO, niente fallback]
```

Parametri della chiamata PLAN:
- `model:'claude-haiku-5-5'`, `max_tokens: 3000` (il thinking adattivo conta nel tetto), `output_config: {effort:'low', format:{type:'json_schema', schema: BRAIN_SCHEMA.schema}}`.
- **Vietati** (danno 400 o peggiorano): `temperature`, `top_p`, prefill dell'assistente, `tool_choice` forzato.
- Leggere i blocchi per `type` (saltare `thinking`), prendere il testo JSON.
- `system`: [regole+lessico+esempi statici con `cache_control:{type:'ephemeral'}`] + [menu compatto + alias del locale con `cache_control`]. Data/ora, cronologia, sospesi, messaggio → nel messaggio utente (volatile). Registra `usage.cache_read_input_tokens` in COSTI.md (se la cache non scatta per soglia minima, va bene: il costo regge comunque).
- Compatibilità schema: `BRAIN_SCHEMA` usa `type:[x,'null']` e `strict`. **Primo test della notte (A0):** una chiamata reale con lo schema vero. Se l'API lo rifiuta → converti le union in `anyOf` o campi sempre presenti con valore sentinella, nel modulo client (non nello schema condiviso con Groq).
- Leva di correzione (solo se il banco lo richiede, una volta): `effort:'medium'`. Misura la latenza prima/dopo.

Budget tempi per turno: chiamata 10 s, 1 retry dopo 1 s su 429/529/5xx/rete; auto-correzione inclusa ≤ 25 s totali; oltre → brainDown. Nessun retry su 400/401.

---

## 5. Task e sottoagenti (perimetri di file DISGIUNTI)

Dopo il §3 il coordinatore scrive il **contratto** (15 min): firma di `callHaiku(ctx, key, opts) → BrainCall` (stesso tipo di `callBrain`), firma di `readBotEngine(tenant) → 'haiku'|'groq'`, e lo committa. Poi lancia i 3 sottoagenti in parallelo (model opus). Regole: ognuno tocca **solo** i suoi file; se gli serve altro lo chiede al coordinatore; mai `git checkout --`; niente finestre aperte; processi pesanti con `taskpolicy -b`; commit li fa il coordinatore ogni ~30 min.

### T — Motore (≈2,5 h)
File: `apps/server/src/lib/owner-brain-anthropic.ts` (nuovo), `owner-brain-plan.ts`, `owner-brain-context.ts`, `owner-brain-switch.ts`, `owner-brain-memory.ts` (solo filtro `active` + `judge` opzionale), `routes/twilio-menu.ts` (**solo** `brainTurnR`, il controllo chiave alla r. ~772 e `recordUsage`), `twilio-menu-copy.ts` (solo testi che contengono «categori»), test unitari nuovi `tests/owner-brain-anthropic.test.ts`.
1. **T1 client** `callHaiku` (§4), con `fetch` iniettabile, meter `recordUsage(model='claude-haiku-5-5', prompt, completion, cache_read)`.
2. **T2 switch**: `readBotEngine` (§1.5); `planOwnerMessage` sceglie `callHaiku` o `callBrain`; r. ~772: la condizione «manca la chiave» guarda la chiave del motore scelto (`ANTHROPIC_API_KEY` per haiku), non più `GROQ_API_KEY`; con haiku `learnAfter` senza giudice Groq (`judge: undefined`).
3. **T3 menu intero**: l'estrattore F1 chiama Haiku con lo stesso schema quando `engine=haiku`. Il flusso F1 («Menu trovato… OK», scelta del menu se ambiguo, sostituzione con ripristino) resta identico. Taglio ammesso (§1.4).
4. **T4 prompt e lessico**: riscrivi le parti testuali del contesto (`owner-brain-context.ts`) con Menu/Sottomenu/Sezione/Piatti; sinonimi capiti (voce, prodotto, bevanda, categoria→sottomenu); regola «nel dubbio una sola domanda breve»; regola «vale l'ultimo valore detto» per «12 anzi 13» (punto debole dello spike); regola «nascondere/eliminare un intero menu o sottomenu = conferma»; stile: tu, frasi brevi, grassetto WhatsApp, niente emoji. **Non** cambiare i nomi dei campi dello schema (il validatore li usa).
4b. **T4b — correzioni dalla prova playground del 20/10** (Haiku 5.5 col prompt di oggi, 20 frasi: 16 OK, 1 domanda OK, 3 sbagliate, 0 GRAVI, 3,2 s medi; file `~/Downloads/PLAYGROUND-4-RISULTATI.txt`):
   - **Prezzo uguale a quello attuale** («la coca a 3», già 3 €): il modello emette `set_price` e dice «aggiornato». Regola nel validatore: azione che non cambia niente → nessuna scrittura, risposta «La **Coca Cola** è già a **3 €**.»
   - **Più di 3 modifiche** («aumenta tutte le pizze di un euro»): il modello pianifica bene le 4 azioni ma la bozza non chiede l'OK. Verifica che il server lo forzi sempre (riepilogo + «Rispondi OK»), indipendentemente dalla bozza; test dedicato.
   - **Intero menu o sottomenu** («nascondi tutta la cena»): il modello nasconde i 9 piatti uno per uno e la conferma è ambigua. Se nello schema non esiste già, aggiungi un'azione di livello menu/sottomenu (`set_section_hidden` / `set_menu_active`) che **chiede sempre conferma** con il riepilogo («Nascondo **tutto il Menu cena** (9 piatti)? Rispondi sì.») e, alla conferma, scrive una sola modifica. Regola nel prompt: «tutta la cena / tutti i primi» = azione sul menu o sottomenu, non piatto per piatto. Se non ci sta nel tempo: almeno il riepilogo + conferma esplicita sulle azioni piatto per piatto.
5. **T5 errori**: timeout/retry/refusal/max_tokens/JSON invalido → brainDown + `reportFailure({kind:'job_failed', detail})`; mai «fatto».
6. **T6 concorrenza**: su conflitto di revision nella tx finale → rilettura e **un** rigioco del turno, poi `copy.menuChanged`.
7. Test unitari con `fetch` finto: risposta valida, 429→retry→ok, 500×2→brainDown, refusal, JSON invalido, timeout, **nessuna chiamata a groq con engine=haiku**, switch (settings, env, default).

### B — Banco col modello vero (≈2 h)
File: `tests/eval/adapters/anthropic-bot.ts` (oggi stub `ready:false`), `tests/eval/anthropic-cache.ts` (nuovo, copia del modello `groq-cache.ts`: record/replay per hash della richiesta + tetto di spesa letto da `usage`), `tests/eval/route-harness.ts` (solo `installNet` per `api.anthropic.com` + **asserzione: nessuna richiesta a `api.groq.com/.../chat/completions`**), `tests/eval/cases/victoria-1019.ts` + fixture `victoria` a 4 menu in `fixtures/menus.ts`, `tests/eval/eval-banco-vero.test.ts` (solo selettore `TAKO_BV_BOT=haiku`), `tests/eval/sample-adv.ts` (nuovo: campione dalla batteria avversaria esistente `adv-z`).
1. Adattatore: `TAKO_BOT_LLM=record|replay|live`. In `replay` costo 0 e risultati deterministici.
2. Fixture Victoria: 4 menu (Menu pranzo, Menu cena, Bevande, Alla carta) con almeno due sottomenu omonimi («Primi» a pranzo e a cena), una sezione, alias. Dati realistici ma **di comodo** (mai letti/scritti dal DB di Victoria).
3. 10 casi Victoria: prezzo, esaurito, «togli»=nascondi, «elimina»=conferma, piatto nuovo con «che costa», «i primi» ambiguo tra due menu → domanda, nascondi sottomenu → conferma, 4 modifiche → riepilogo+OK, OK a voce, «la sorrentina finita» con alias attivo → nessuna domanda.
4. Campione avversario **150 conversazioni** da `adv-z` (famiglie: vocali/ASR, prezzi in lettere, preamboli, correzioni «anzi», multi-turno, dialetto, nomi insidiosi, conferme senza sospeso, elimina senza sì). Gira **dopo** banco e Victoria.
5. **Parlato sporco — 30 frasi dedicate** (`tests/eval/cases/parlato-sporco.ts`, nuovo): il caso tipico è il ristoratore anziano che detta un vocale biascicando. Le frasi simulano trascrizioni Whisper reali di quel parlato: parole mangiate («carbonar tredic»), nomi storpiati dal riconoscimento vocale («ghisa» = Gricia, «cocacola», «amatricana»), frasi senza verbo («la sorrentina… finita»), riempitivi e ripetizioni («eh allora senti eh la… la carbonara… mettila a… dodici»), numeri in lettere spezzati («dodici e… cinquanta»), dialetto. Esito atteso per ognuna: la modifica giusta **oppure** una sola domanda di conferma sul piatto giusto («Intendi la **Gricia**?»). GRAVE = modifica sul piatto sbagliato, prezzo sbagliato o scrittura senza capire. Si misura col modello vero, **a parte** rispetto al campione da 150.
6. **Le 20 frasi del playground** (`~/Downloads/PLAYGROUND-2-ISTRUZIONI-E-FRASI.txt`, fixture `mario`) diventano un set di regressione `tests/eval/cases/playground-1020.ts`, con attese corrette: 16 «coca a 3» → nessuna scrittura e «è già a 3 €»; 17 → riepilogo + OK; 19 → una conferma sul Menu cena. Soglia: 20/20 senza GRAVI.
7. Finché T non consegna, B lavora con un mock di `callHaiku`.

### E — Edge, interruttore, documenti (≈1,5 h)
File: `scripts/serverless/candidate-entry.mjs`, `scripts/serverless/prepare-candidate-deploy.mjs` (aggiunta `ANTHROPIC_API_KEY` e `TAKO_BOT_ENGINE_DEFAULT` alla lista chiusa degli env), `scripts/serverless/bot-engine.sql` (nuovo: `jsonb_set` di `settings.botEngine` per **un** `restaurant_id` + rollback; solo scritto, non eseguito), `scripts/serverless/check-active.mjs` (ritrovare — cercare in `~/.config/tako-webapp/`, scratchpad, worktree `Tako-live-edge` — o riscrivere: confronta hash del bundle online con quello locale), `docs/webapp/bot-haiku-2026-10-20/{PIANO.md (copia di questo), STATO.md, COSTI.md, CHIAVI-OK.md, REPORT.md, implementation-notes.md}`, test `tests/owner-brain-texts-lexicon.test.ts` (nessun testo verso il titolare contiene «categori», nessuna emoji nei testi del bot).
1. Build `node scripts/serverless/build-operational-candidate.mjs` + `verify-candidate-lazy-boot.mjs` → PASS (nessun deploy).
2. `implementation-notes.md`: ogni deviazione da questo piano, una riga ciascuna, con l'opzione conservativa scelta.

### Integrazione e misura (coordinatore, seriale)
1. Merge dei perimetri → `tsc` + suite (nessun rosso nuovo) → commit.
2. **A0** (se non già fatto): 1 chiamata reale con lo schema vero, `max_tokens` minimo, esito in `CHIAVI-OK.md` (mai la chiave).
3. Victoria 10 in `live/record` → banco vero 92 in `record` → parlato sporco 30 in `record` → campione 150 in `record`. Concorrenza 3, backoff su 429 (se 429 persistenti → concorrenza 1).
4. **Loop fix → verifica**: max **4 giri**, ognuno ≤ 15 min. Si corregge **prima il validatore** (regole deterministiche) e solo dopo il prompt. Ri-registra solo i casi falliti. Ogni giro: tabella in REPORT (giro, % banco, GRAVI, cosa è cambiato).
5. REPORT + STATO + push. **Nessun confronto con Groq** (escluso da Manuel il 20/10): nessuna chiamata Groq, nemmeno con le chiavi di test.

---

## 6. Verifier (tutti automatici, in quest'ordine)

| # | Verifica | Soglia |
|---|---|---|
| V1 | `pnpm exec tsc --noEmit` | pulito |
| V2 | Suite vitest | nessun rosso oltre l'elenco di partenza |
| V3 | Test unitari motore (T7) | tutti verdi |
| V4 | Nessuna chiamata Groq chat con engine=haiku (asserzione harness) | 0 |
| V5 | Lessico/testi (E) | 0 «categori», 0 emoji |
| V6 | Victoria 10 col modello vero | 10/10 o elenco dei mancati con motivo |
| V7 | **Banco vero 92 col modello vero** | **≥ 90% obiettivo, ≥ 85% minimo per il deploy QA; 0 GRAVI di sicurezza** (`SAFETY` in `judge.ts`) |
| V8 | Campione avversario 150 | **0 GRAVI** (scrittura su domanda, prezzo non detto, aggiunta↔modifica, verbo nel nome, elimina/menu/sottomenu senza conferma, nessuna risposta, «fatto» senza scrittura) |
| V8b | **Parlato sporco 30** col modello vero | **0 GRAVI**; corrette o con domanda giusta ≥ 80%; il numero va nel REPORT come voce separata |
| V8c | Set playground 20 (attraverso il route vero, con validatore) | 20/20, 0 GRAVI |
| V9 | Bundle edge + lazy boot | PASS |
| V10 | Latenza e costo | p50 turno ≤ 4 s, p95 ≤ 8 s (escluso Whisper); costo stimato ≤ 0,50 €/locale/mese a 500 msg |

---

## 7. Stop condition ed exit

**Stop (successo):** V1–V9 verdi (V8b compreso) e V7 ≥ 90% → vai al §8 (deploy QA) se autorizzato, altrimenti REPORT e stop.
**Stop (tempo/costo):** ore 02:00, oppure spesa Anthropic 3,00 $ (tetto di Manuel, collaudo QA incluso), oppure 2 giri di fix consecutivi senza miglioramento → REPORT + STATO + push, stop.

**Exit di fallimento espliciti:**
- **E0** chiave assente o 401 → costruisci tutto con `fetch` finto, `ready:true`, REPORT con «NON MISURATO col modello vero», niente deploy.
- **E1** merge della base non risolto in 20 min → stop prima di scrivere codice, REPORT con i conflitti.
- **E2** schema JSON rifiutato dall'API e non convertibile in 30 min → stop del motore, REPORT.
- **E3** banco vero < 70% al primo giro → stop: è un problema di architettura/prompt, non di fix; REPORT con le 10 famiglie peggiori.
- **E4** typecheck rosso a fine task → si sistema prima di committare; mai commit rosso.
- **E5** V7 tra 85% e 90% a fine loop → deploy QA ammesso (se autorizzato) con la nota «sotto obiettivo».
- **E6** deploy fallisce → rollback immediato con la copia salvata, nessun secondo tentativo, REPORT.

---

## 8. Deploy sul QA a fine notte (AUTORIZZATO da Manuel il 20/10: vedi RISPOSTE-MANUEL.md)

Condizioni: V1–V9 verdi, V7 ≥ 85%.
1. `supabase secrets set TAKO_CANDIDATE_ANTHROPIC_API_KEY=… TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT=groq` (secret **nuovi**, non toccare gli esistenti). Il default `groq` sul server protegge Victoria e gli altri clienti finché Manuel non prova (vedi §11.3).
2. Copia di rollback del bundle online → build → `scripts/translations/deploy-projection.mjs` (procedura di `docs/webapp/bot-correzioni-2026-10-17/REPORT-R7-2.md`) → `check-active.mjs`.
3. `bot-engine.sql` **solo sul locale QA (26050ecd)** → `botEngine='haiku'`.
4. Prova sincrona `TakoSyncTest` sul QA: 10 messaggi (prezzo, esaurito, piatto nuovo, domanda, elimina+sì, annulla, 4 modifiche+OK, «categoria» detto dal titolare, vocale simulato da testo, «cosa sai fare?»). Budget ≤ 0,05 $.
5. Se una prova è GRAVE → rollback del bundle, REPORT.

**Mai:** scritture sui dati di Victoria (528e263c) o di altri clienti, messaggi WhatsApp a numeri veri, modifiche a `tako_whatsapp_links`, rimozione del ramo Groq dal codice, stampa di chiavi.

---

## 9. REPORT.md (formato fisso) e chiusura

1. Esito in 3 righe (fatto / non fatto / deploy QA sì-no).
2. Pagella: banco vero %, GRAVI, Victoria x/10, **parlato sporco x/30 (corrette, domande giuste, GRAVI) con i 5 casi peggiori trascritti**, campione 150 GRAVI, domande ogni 10 messaggi, p50/p95, token medi per messaggio, cache hit, costo per messaggio e per locale/mese, spesa della notte.
3. Problemi trovati, numerati con gravità e fix in una riga.
4. Cosa resta (per Manuel): prova dal telefono sul QA, decisione di passare `TAKO_BOT_ENGINE_DEFAULT` a `haiku` (= Victoria e tutti su Haiku), eventuali tagli fatti.
5. `STATO.md` = «run conclusa, in attesa di Manuel». Push. Nessuna modifica dopo il REPORT.
6. Aggiorna il brain: `/Users/manuel/Documents/brain/log.md` (una riga `## [2026-10-20] sessione | Takomenu motore Haiku`), memoria `takomenu-piano-motore-anthropic.md` con esito e branch.

---

## 10. Tempi (parete, partenza 21:00)

| Ora | Cosa |
|---|---|
| 21:00–21:30 | Prerequisiti, base v119, suite di partenza, A0, contratto |
| 21:30–00:00 | T, B, E in parallelo |
| 00:00–00:30 | Integrazione, V1–V5 |
| 00:30–01:15 | Misura col modello vero (V6–V8) + loop fix (max 4 giri) |
| 01:15–01:45 | Bundle, deploy QA se autorizzato, prova sincrona |
| 01:45–02:00 | REPORT, STATO, push, brain |

Se alle 00:30 T non è integrato: si taglia T3 (menu intero resta su Groq, dichiarato) e il campione avversario scende a 60. **Il parlato sporco 30 non si taglia mai.**

---

## 11. Decisioni chieste a Manuel (scrivere le risposte in `RISPOSTE-MANUEL.md`; senza risposta valgono i default **in grassetto**)

1. **Chiave Anthropic**: salvarla in `~/.config/tako-webapp/anthropic-key.txt` prima delle 21:00 (oggi non c'è) + credito caricato. *Bloccante.*
2. **Vocali**: Whisper su Groq resta per trascrivere (Haiku non sente l'audio). Default: **sì, resta**.
3. **Victoria e altri clienti**: default server `groq` fino alla tua prova di mercoledì, poi passi tu tutto a `haiku` con una riga. Default: **sì** (alternativa: Haiku subito anche per Victoria).
4. **Deploy sul QA a fine notte** (§8), così mercoledì alle 9 provi subito dal telefono. Default: **no, deploy mercoledì mattina col tuo via** (30 min).
5. **Ricollegare il tuo numero al locale QA** (dal 19/10 è scollegato da Victoria): serve per provare dal telefono. Default: **lo fa l'agente in fase di deploy, solo sul QA**.
6. **Tre attese aperte del banco vero**: «aumenta tutti di un euro» → applica con riepilogo; piatto già esistente chiesto come nuovo → domanda; «Piatto test QA» → nome letterale. Default: **sì a tutte e tre**.
7. **Menu intero su Haiku** (T3) anziché Groq. Default: **sì, se ci sta nel tempo**.
