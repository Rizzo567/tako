# 28/10/2026 — Manuel — rilascio bot v189

## Cosa è online
**v189** di `tako-operational-candidate` (ACTIVE dalle 13:10 ora italiana, ezbr `7409e1f8…`), deploy autorizzato da Manuel «adesso» alle 13:09 (durante il pranzo, scelta sua). Ramo `codex/manuel-bot-rilascio-1028`, commit `5dcbaa94`.

Contiene:
- le 15 correzioni sostituzioni del 24/10 (`fix/bot-sostituzioni-1024`);
- il PDF del menu in chat (`docs/sessions/2026-10-28-manuel-bot-invia-pdf.md`);
- correzioni 28/10: «la cotoletta mettila a 5» dopo una domanda in sospeso → spiegazione del prezzo fisso; «anzi no la X nn la mettere» dopo un «si si»; sostituzioni «metti Y al posto di / invece di X», «via A e via B, metti C e D», Y di 3 parole intero, omonimi risolti col Menu degli altri piatti;
- generatore password identico alla v188 (delta credenziali del 27/10).

## Base e prova di provenienza
- Base prima del deploy: v188, ezbr `4459b197…` (ricevuta del 27/10), ricontrollata subito prima del comando.
- Build di `9ad0cd41` = v187 byte per byte (salvo il nome di una cartella temporanea). v188 = v187 + sola funzione password, portata nel sorgente con la stessa logica. Diff sorgente v187 → v189: solo bot, PDF, password.
- Rollback pronto: `~/.config/tako-webapp/rollback-edge-20261028/rollback-v188.ts` (SHA `d5d3a19c…`, uguale alla ricevuta) + `magick-wasm-0.0.44.js`. Copia del rilascio: `candidate-rilascio-1028.ts` (SHA `8324bd54…`).

## Verifiche
- Batterie (route vero, Haiku): sostituzioni 143/143, scoperta2 31/31, frasi nuove 35/42 (v187 online prima: 5/42; i 3 gravi rimasti — 017, 019, 027 — falliscono anche sulla v187), giornata Luisa: restano solo 2 «risposte vuote» che sono un effetto dei tempi del banco (la risposta arriva in ritardo, in ordine).
- Vitest: stessi rossi della base (279), nessun nuovo; test password aggiornati al formato v188.
- Build candidate PASS, avvio Deno PASS; dopo il deploy edge pronta in 68 s; `GET /api/public/whatsapp-pdf/...` con token falso → 404 «PDF non trovato» dal codice nuovo.
- **Non fatte**: prove dal vivo sul QA (il token Management condiviso dà 401, quello privato non legge il DB: impossibile verificare quale numero finto è collegato al QA). Prova reale proposta: Manuel scrive dal suo numero (collegato a Victoria) «mandami il menu giorno» — sola lettura.

## Rollback (se serve)
```
cd release/serverless/candidate-deploy && cp ~/.config/tako-webapp/rollback-edge-20261028/rollback-v188.ts supabase/functions/tako-operational-candidate/index.ts && cp ~/.config/tako-webapp/rollback-edge-20261028/magick-wasm-0.0.44.js supabase/functions/tako-operational-candidate/ && SUPABASE_ACCESS_TOKEN=<token valido> pnpm dlx supabase functions deploy tako-operational-candidate --project-ref tcfccmvpycivxuxkoqpw --no-verify-jwt
```

## Da fare
- Rinnovare `~/.config/tako-webapp/supabase-management.env` (401).
- Frasi 017/019/027 («al suo posto», «toglila e metti», «non togliere X, aggiungi Y»).

## Aggiornamento 13:23 — v190
Richiesta Manuel: «mandami il menu» deve dare il PDF (chiede quale se più Menu); il link del menu digitale solo con «mandami il link» (o «link/indirizzo del menu», «menu digitale», «qr»). Commit `9c7f83a7`, deploy **v190** (ezbr `2cdbc936…`) da base v189 verificata; edge pronta in 69 s. Vitest: stessi 279 rossi della base; batterie 143/143 e 31/31. Copia: `rollback-edge-20261028/candidate-rilascio-1028b.ts`. Rollback a v188 invariato.

## Aggiornamento 14:57 — v191
Segnalazione Manuel: a lui il PDF arriva, a Luisa (…7791, sempre Victoria) no. Causa: Luisa scrive «Mandami menù giorno» con l'accento; il filtro iniziale di `pdfTurn` usava `\b` dopo «ù», che in JavaScript non è una lettera, quindi il messaggio non arrivava mai a `pdfIntent` e finiva al flusso modifiche («Ecco il *Menu Giorno*: …» a parole). Correzione: filtro sul testo senza accenti (`normalizeMenuText`). Commit `c6f3ab87`; test e2e con le frasi di Luisa (rosso senza correzione, verde con). Vitest: stessi 279 rossi della base. Build: unica differenza dalla v190 la riga corretta. Deploy **v191** (ezbr `3411c11b…`) da base v190 verificata; edge pronta in 70 s. Copia: `rollback-edge-20261028/candidate-rilascio-1028c.ts`.
