# Messa online F2 — Preset settimanali (ramo `codex/feat-preset-settimanali`, merge di `codex/release-1016`)

Niente è stato messo online da questo ramo. Stesso metodo di `deploy-2026-10-16.md`: base = versione online verificata, bundle = base + solo il delta F2.

## Ordine (obbligatorio)
1. **Migrazione DB** (prima di tutto, additiva, solo tabelle nuove): `scripts/serverless/menu-day-presets.sql`. Rollback: `scripts/serverless/menu-day-presets-rollback.sql`. Verifica dopo: le 5 tabelle `menu_day_presets`, `menu_day_preset_settings`, `menu_day_preset_runs`, `menu_owner_notices`, `menu_text_translations` esistono con RLS e grant a `takomenu_runtime`.
2. **Segreti dell'edge operativa** (Supabase, funzione `tako-operational-candidate`):
   - `TAKO_CANDIDATE_GROQ_TRANSLATION_API_KEY` = chiave Groq DEDICATA alle traduzioni (altro account; mai la chiave del bot). Arriva al server come `GROQ_TRANSLATION_API_KEY`.
   - `TAKO_CANDIDATE_TAKO_PRESET_CRON_SECRET` = stringa casuale ≥32 caratteri (arriva come `TAKO_PRESET_CRON_SECRET`; senza, la rotta del tick risponde 404).
3. **Edge operativa** (`tako-operational-candidate`), delta sul bundle online (v84):
   - nuovi: `apps/server/src/lib/menu-day-presets.ts`, `apps/server/src/lib/menu-text-translations.ts`, `apps/server/src/routes/menu-day-presets.ts`;
   - modificati: `apps/server/src/index.ts` (2 registrazioni: `/api/menu-workspace/day-presets`, `/api/day-presets-cron`), `apps/server/src/lib/menu-preset-target.ts` e `apps/server/src/lib/menu-translation-queue.ts` (stub F1 → implementazione F2), `apps/server/src/lib/menu-workspace-translate.ts` (chiave traduzioni dedicata: vale anche per dashboard e onboarding), `apps/server/src/routes/menu-workspace.ts` (stessa chiave per `/translate/*`), `apps/server/src/lib/supplied-menu-pdf.ts` (`hasSuppliedMenuPdf`), `scripts/serverless/candidate-entry.mjs` (passa `GROQ_TRANSLATION_API_KEY` e `TAKO_PRESET_CRON_SECRET`).
4. **Read-edge: NON serve.** La pagina pubblica legge `published` come prima; i preset la cambiano solo tramite `mutateWorkspace(publish)`.
5. **takomenu-web** (dashboard staff), delta solo `staff/`: `apps/dashboard/public/staff/src/13-menu-day-presets.js` (nuovo), `13-menu-workspace.js`, `menu-workspace.css`, `index.html` (script in più), ricostruiti con `scripts/build-staff-web.mjs`.
6. **takomenu-public: NON serve** (nessun cambio a pagina pubblica, Worker o snapshot).
7. **Worker cron nuovo** `takomenu-preset-cron` (`deploy/cloudflare/preset-cron.mjs`, config `deploy/cloudflare/wrangler-preset-cron.jsonc`, cron `*/5 * * * *`):
   - `npx wrangler secret put TAKO_GATEWAY_SECRET --config deploy/cloudflare/wrangler-preset-cron.jsonc` (stesso valore del gateway);
   - `npx wrangler secret put TAKO_PRESET_CRON_SECRET --config deploy/cloudflare/wrangler-preset-cron.jsonc` (stesso valore del punto 2);
   - `npx wrangler deploy --config deploy/cloudflare/wrangler-preset-cron.jsonc`.
   Ultimo passo: prima il backend deve rispondere al tick.

## Smoke test
- `POST {edge}/api/day-presets-cron/tick` senza segreto → 404; con segreto (header `x-tako-cron-secret` + header gateway) → 200 `{autopublish:[],translations:{…}}` (nessun locale ha ancora preset).
- Dashboard su locale di TEST: Piatti → «Preset» → «Attiva i preset» → scegli un giorno → modifica → «Pubblica questo preset adesso» → pagina pubblica aggiornata (live). Mai su menu reali di clienti.
- Log edge: niente `menu_translation_enqueue_failed`; se manca la chiave dedicata compare l'avviso «chiave Groq dedicata assente» e si vede l'italiano.

## Rollback
Edge/web: come `deploy-2026-10-16.md` (versioni v84 e 0022b969). Worker cron: `npx wrangler delete --config deploy/cloudflare/wrangler-preset-cron.jsonc`. DB: rollback SQL solo se necessario (cancella i preset salvati).

## Non incluso / limiti
- Comandi chat dei preset (`presetChatCommand`: «metti online il menu di martedì», «attiva/disattiva automatico», «cosa c'è lunedì») NON cablati: il bot salva i preset (F1 → `menuPresetTarget.save`), il resto si fa dalla dashboard.
- Avvisi al titolare solo in dashboard (`menu_owner_notices`), non via WhatsApp.
