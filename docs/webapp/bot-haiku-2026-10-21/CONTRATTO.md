# Contratto tra i perimetri T / B / E — run 21/10/2026 (coordinatore)

Base: `codex/bot-anthropic-1019` @ merge v119 (a037bb2). Piano: `PIANO.md` (copia di PIANO-FINALE), scarti in `implementation-notes.md`.

## 1. Client Haiku — `apps/server/src/lib/owner-brain-anthropic.ts` (perimetro T)

```ts
export const HAIKU_MODEL='claude-haiku-5-5'
export const ANTHROPIC_URL='https://api.anthropic.com/v1/messages'
export type HaikuOptions=BrainCallOptions&{effort?:'low'|'medium',maxTokens?:number,retryDelayMs?:number}
/** Stessa firma e stesso tipo di ritorno di callBrain (owner-brain-plan.ts). */
export async function callHaiku(ctx:BrainContext,key:string,opts?:HaikuOptions):Promise<BrainCall>
```
- `fetch` iniettabile via `opts.fetch` (default `globalThis.fetch`, così l'harness dei test lo intercetta).
- Richiesta: `POST ANTHROPIC_URL`, header `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
  Body: `{model:HAIKU_MODEL,max_tokens:3000,output_config:{effort:'low',format:{type:'json_schema',schema:BRAIN_SCHEMA.schema}},system:[...],messages:[...]}`.
  `system` = i messaggi `role:'system'` di `ctx.messages` come blocchi `{type:'text',text,cache_control:{type:'ephemeral'}}` (max 2 breakpoint);
  gli altri messaggi in ordine, ruoli `user|assistant` (messaggi consecutivi con lo stesso ruolo uniti con `\n\n`).
  VIETATI: `temperature`, `top_p`, prefill assistant finale, `tool_choice`.
- Risposta: testo = concatenazione dei blocchi `type==='text'` (saltare `thinking`). `usage` → `BrainUsage{model,prompt:input_tokens+cache_read+cache_creation,completion:output_tokens,cached:cache_read_input_tokens,latencyMs}`.
  Meter: `opts.meter?.({model:HAIKU_MODEL,prompt,completion,limited:false})`.
- Errori → `throw new BrainUnavailable(reason)`; reason ∈ `'no_key'|'busy'|'http'|'timeout'|'invalid_json'|'refusal'|'max_tokens'`
  (T estende l'unione in owner-brain-plan.ts). Timeout 10 s per chiamata; 1 retry dopo 1 s su 429/529/5xx/rete/timeout; nessun retry su 400/401/403.
  `stop_reason==='refusal'` → 'refusal'; `'max_tokens'` → 'max_tokens'; JSON non parsabile → 'invalid_json'.

## 2. Interruttore — `apps/server/src/lib/owner-brain-switch.ts` (perimetro T)

```ts
export type BotEngine='haiku'|'groq'
export function botEngineOf(settings:unknown,env?:Record<string,string|undefined>):BotEngine // settings.botEngine → env TAKO_BOT_ENGINE_DEFAULT → 'haiku'
export async function readBotEngine(tx:Exec,restaurantId:string):Promise<BotEngine>          // errore DB → botEngineOf(null)
export function engineKey(engine:BotEngine,env?:Record<string,string|undefined>):string       // haiku → ANTHROPIC_API_KEY, groq → GROQ_API_KEY
export const botEnginePatch=(engine:BotEngine)=>sql`UPDATE restaurants SET settings=jsonb_set(...,'{botEngine}',...)`
```
Valori sconosciuti di `settings.botEngine` → si ignorano (si passa all'env). `TAKO_BOT_BRAIN_OFF=1` resta il kill switch.

## 3. Pianificatore
`planOwnerMessage(input,key,opts&{engine?:BotEngine})`: `engine==='haiku'` → `callHaiku`, altrimenti `callBrain`. Default nella funzione = `'groq'`
(test esistenti invariati); il route passa SEMPRE l'engine letto da `readBotEngine`.
Con engine haiku il route usa `engineKey('haiku')` per il cervello e `GROQ_API_KEY` SOLO per Whisper (`transcribeAudio`).
Con engine haiku: `BrainFallback` / `BrainUnavailable` → `copy.brainDown` + `reportFailure({kind:'job_failed',detail:'haiku: <reason>'})`. Mai Groq.

## 4. Banco (perimetro B)
- Il route vero gira con `ANTHROPIC_API_KEY` = chiave letta da `~/.config/tako-webapp/anthropic-key.txt` (mai stampata) e `settings.botEngine='haiku'`.
- `installNet` intercetta `https://api.anthropic.com/v1/messages` → `anthropic-cache.ts` (record/replay/live, chiave = sha256 del body JSON canonico).
- Asserzione V4: qualsiasi richiesta a `api.groq.com/.../chat/completions` durante un turno haiku = errore del caso (contatore `net.groqChat`).
- Tetto di spesa: `TAKO_EVAL_ANTHROPIC_MAX_USD` (default 0,50 per giro), costo da `usage`: input 0,10 $/M, output 0,50 $/M, cache read 0,01 $/M, cache write 0,125 $/M.
- Registro costi: `tests/eval/cache/anthropic/ledger.json` (somma per giro), che il coordinatore copia in COSTI.md.

## 5. Edge (perimetro E)
Lista chiusa env: `ANTHROPIC_API_KEY` (secret `TAKO_CANDIDATE_ANTHROPIC_API_KEY`), `TAKO_BOT_ENGINE_DEFAULT` (secret `TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT`).

## Perimetri file (disgiunti)
- **T**: `apps/server/src/lib/owner-brain-anthropic.ts`(nuovo), `owner-brain-plan.ts`, `owner-brain-context.ts`, `owner-brain-switch.ts`, `owner-brain-memory.ts`,
  `owner-brain-route.ts`, `owner-brain-r.ts`, `routes/twilio-menu.ts`, `twilio-menu-copy.ts`, `onboarding-planner.ts`, `menu-full-extract.ts`,
  `tests/owner-brain-anthropic.test.ts`(nuovo), test esistenti di owner-brain-* solo se un'attesa cambia per decisione del piano (annotare).
- **B**: `tests/eval/adapters/anthropic-bot.ts`, `tests/eval/anthropic-cache.ts`(nuovo), `tests/eval/route-harness.ts`, `tests/eval/cases/{victoria-1019,parlato-sporco,playground-1020}.ts`(nuovi),
  `tests/eval/fixtures/menus.ts` (solo aggiunte), `tests/eval/eval-banco-vero.test.ts` (solo selettore), `tests/eval/sample-adv.ts`(nuovo), `tests/eval/eval-haiku.test.ts`(nuovo), `tests/eval/cache/anthropic/**`.
- **E**: `scripts/serverless/**`, `tests/owner-brain-texts-lexicon.test.ts`(nuovo), `tests/candidate-deploy-prepare.test.ts` (solo se la lista env lo richiede).
- **Coordinatore**: `docs/webapp/bot-haiku-2026-10-21/**`, commit, push.
