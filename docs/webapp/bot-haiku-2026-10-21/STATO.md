# STATO — run notturna motore Haiku 5.5 (21/10/2026)

**In corso** (coordinatore Opus 5.5). Branch `codex/bot-anthropic-1019`.

- 01:00 prerequisiti P1 ok, P2 ok (deploy QA autorizzato, tetto 3 $), P3 ok (stash pre-haiku + owner-ai-facts-1019), P4 parziale (vedi note 4), P5 sleep disabilitato.
- 01:00 base v119 mergiata senza conflitti (a037bb2).
- 01:05 A0 verde (CHIAVI-OK.md). Contratto in CONTRATTO.md.
- 01:05 Baseline: `tsc --noEmit -p apps/server` pulito. Vitest 3.313 test: rossi = **i 14 noti nome per nome** (menu-controls-images-output 1, menu-workspace-presentation 2, agency-isolation 1, menu-controls-persistence 1, twilio-menu-ai-flow 1, twilio-menu-hold 1, twilio-owner-link 7) **+ 68 test che vogliono il server :3001** (copilot-owner, correctness, realtime, load-review-fixes, review-fixes, waiter-calls, takeaway, oggi-summary, reservations, shifts, simulation, stats-export, menu-availability): elenco esatto in `BASELINE-SUITE-ROSSI.txt`. Regola da qui: nessun rosso nuovo.
- 01:10 lanciati T (motore), B (banco), E (edge) in parallelo, model opus, perimetri disgiunti.
- 01:25 E consegnato (env, bot-engine.sql, check-active, DEPLOY-QA, test lessico). Scoperto: online v127, non v119.
- 01:36 T consegnato (Fase 1 verde 01:09, Fase 2 01:27, nessun taglio). 01:37 base v127 ricostruita (0fa42a6).
- 01:45 integrazione: commit motore 033476a, merge base v127 4377c76. V1 tsc pulito. V2 suite: nessun rosso nuovo del bot (restano eval-fix-a/b in correzione da B nell'harness; 3 rossi web-accounts della base email). V5 lessico verde. V9 build PASS + lazy boot PASS (sha eeb28b88…).
