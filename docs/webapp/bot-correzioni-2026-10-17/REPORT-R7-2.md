# REPORT R7.2 — deploy edge v113 (R4b, 18/10/2026)

**Esito: v113 ONLINE.** Il blocco del primo tentativo (note 71–72) è superato dalla decisione di Manuel del 18/10 (`brain/decisioni/2026-10-18-takomenu-clienti-ricevono-fasi-ab.md`): i 21 clienti ricevono anche le fasi A/B; criterio «clienti = HEAD a cervello spento» (round1–6* 1679/1679). Cervello (`settings.botBrain`) acceso solo sul QA «Tako · Verifica web».

## Deploy
- Prima: `check-active.mjs 112 0b9bf80e6ba5…` **passato** (08:35 UTC). Rollback v112: `~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v112-bot-brain.ts`.
- Bundle: build di 227ed34 (= HEAD d7be4b0 per il codice), index.ts sha256 `9f01e3e839fa…`, 1.440.406 byte + magick-wasm-0.0.44.js (sha `cf1db24f…`). `deploy-projection.mjs` PASS.
- Online: **v113, ezbr `6ed2c37112f8de6ce65a0bfa85ba559ba04b1f30eb87194cec4b315a08ae9e74`**. Candidato salvato come `candidate-index-v113-bot-r.ts`.
- Sezioni cambiate rispetto a v112 (diff della nota 71): owner-brain-context/plan/route/switch, owner-brain-r e owner-brain-price-checks (nuovi), twilio-menu-reading e twilio-menu-phonetic (nuovi), twilio-menu-ai, routes/twilio-menu, twilio-menu-structure (nuovo), twilio-menu-copy, twilio-menu-nlu, twilio-menu-create, twilio-menu-hold; altre sezioni solo rinumerazione esbuild. Unico `Buffer` globale (onboarding-owner-invite) identico in v112.
- Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v112-bot-brain.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`, prima `check-active.mjs 113 6ed2c37112f8de6ce65a0bfa85ba559ba04b1f30eb87194cec4b315a08ae9e74`.

## Clienti
- `botBrain` acceso: solo QA (altri 0, SQL sola lettura). Nessuna scrittura su clienti/Victoria.
- `tako_whatsapp_errors`: **56 prima → 56 dopo deploy → 56 a fine prova** (ultimo errore 16/10).

## Prova live sul QA (solo TwiML, webhook firmato + TakoSyncTest=1)
Script `live-R72/verify-live-r72.mjs`, risultati `live-R72/result-r72-*.json`. Vocali veri: MediaUrl dei messaggi Twilio originali di Manuel (15:27 UTC del 17/10), unico modo accettato dall'edge (solo URL api.twilio.com dell'account).

| Corsa | # | Messaggio | Atteso | Ottenuto | Scrittura | ms |
|---|---|---|---|---|---|---|
| 1 | 1 | Ciao, cosa sai fare? | riga AI + capacità, nessuna scrittura | Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona.  Posso gestire prezzi, disponibilità, nascondere o | no | 3514 |
| 1 | 2 | [vocale 15:27] Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro  | proposta, chiede conferma, non scrive | Elimino 'boh' dal menu? Rispondi sì.  1. *la parmigiana* (15,00 €) 2. *tiramisù* (15,00 €) 3. *boh* (20,00 €) | no | 6031 |
| 1 | 3 | va bene così | conferma = sì, scrive | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 2818 |
| 1 | 4 | [vocale 15:27] Ok, cambia i prezzi di quei due prodotti e mettili entr | proposta, chiede conferma, non scrive | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 3983 |
| 1 | 5 | sì | conferma, scrive | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 2119 |
| 1 | 6 | annulla | annulla l'ultima pubblicata | Operazione annullata. | no | 10809 |
| 1 | 7 | elimina Pasta al sugo | chiede il sì, non scrive | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 2377 |
| 1 | 8 | sì | conferma, scrive | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 2112 |
| 1 | 9 | la birra +10% | domanda, nessuna scrittura | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 2056 |
| 1 | 10 | la carbonara a tre dici | domanda, nessuna scrittura | Sono momentaneamente non disponibile, riprova tra un minuto. | no | 1823 |
| 2 | 1 | elimina Pasta al sugo | chiede il sì, non scrive | Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona.  Elimino Pasta al sugo dal menu? Rispondi sì.  Da  | no | 4190 |
| 2 | 2 | sì | conferma, scrive | *Pasta al sugo*: *eliminato* dal menu | delete|Pasta al sugo | 4881 |
| 2 | 3 | la birra +10% | domanda, nessuna scrittura | Quale birra vuoi aumentare del 10%? | no | 3715 |
| 2 | 4 | la carbonara a tre dici | domanda, nessuna scrittura | Quale birra vuoi aumentare del 10%? Quanto vuoi impostare per la carbonara? | no | 3212 |
- Corsa 1 (0,8 s tra i turni): dal 3º turno «non disponibile» = **rate limit Groq al minuto** (rate_limited 8 su 120b, 5 sul ripiego 20b). Nessuna scrittura sbagliata; l'«annulla» ha chiuso la proposta pendente.
- Corsa 2 (65 s tra i turni): tutto come atteso; fermata dal tetto token prima del 5º turno.
- **Latenza** webhook→risposta: p50 **4,2 s** sui 7 turni con risposta del modello (3,2–10,8 s); i «non disponibile» 1,8–4,0 s.
- Riga «assistente automatico»: solo al primo messaggio di ogni conversazione (2/2).
- **Non verificati** (tetto 40k + 429): «va bene così» = sì, «annulla» dopo modifica pubblicata, risposta al 2º vocale.
- **Divergenze non di sicurezza**: «togli bo» (vocale) letto come elimina (chiede il sì, non scrive; regola Q: togli = nascondi); risposta carbonara ripete la domanda pendente della birra.
- **Rischio da risolvere prima dell'accensione clienti**: col cervello acceso, due messaggi entro ~1 minuto superano il TPM della chiave gratuita (~3,6–7,8k token a turno).

| Controllo | Prima | Dopo |
|---|---|---|
| Messaggi Twilio in uscita verso il numero QA | 0 | 0 (entrambe le corse) |
| Hash QA draft/published | `df579269fbafc22b` | `df579269fbafc22b` |
| Hash items / menus / sections / translations / pubblico | `43502077…` / `43dd2c25…` / `49f7ca91…` / `4f53cda1…` / `86cf91eb…` | identici; 0 righe extra |
| Proposta pendente, memorie last:/undo:/ai:/brainundo:, turni e memoria cervello | salvate | ripristinate (verificato per hash) |
| tako_whatsapp_errors | 56 | 56 |

## Token
Chiave del bot, tetto 40k. Stima ~38k (10–11 turni × 3,6k). **Consumati 38.216** (15.660 + 22.556) + 2 trascrizioni Whisper. Dettaglio in `token-log.md`.
