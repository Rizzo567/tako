# REPORT-X · verifica avversaria fase A (A6.4) · 17/10/2026

Branch `codex/bot-adv-1017` (da fd3276c), commit 13d4354. 508 conversazioni nuove in 3 giri (335+131+42), 0 token Groq, nessun deploy/DB/webhook/push. Esito: **~79 GRAVI veri in 12 famiglie, ~65 MEDI**; 26 GRAVI dal percorso deterministico (anche senza IA). A6.1 (0 GRAVI oracolo) non raggiunto su queste frasi.

Rifare: `TAKO_ADV=1 npx vitest run tests/eval/eval-adv-a.test.ts` (508 × oracolo/off/avversario, ~5 s) · `TAKO_ADV=1 npx vitest run tests/owner-brain-adv-a.test.ts` (31 sonde, tutte rosse). Spenti di default.

| modo | ok | GRAVE (giudice) | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|
| oracolo | 362 | 115 | 74 | 31 |
| Groq spento | 142 | 351 | 50 | 15 |
| avversario | 264 | 104 | 8 | 140 |

Dettaglio per conversazione: `famiglie-x-{oracle,off,adversary}.md`. Con Groq spento quasi tutti i GRAVI del giudice sono «C'è stato un problema» → contati MEDI (M10).

## GRAVI
- **G1 «torna»→Torta (5)**: «torna a 7» → Torta della nonna 7 € «Confermato». Tutti i modi. `twilio-menu-nlu.ts:9` `sameWord` (≥5 lettere, 1 di distanza: torna/torta, torno/tonno, tolta/torta).
- **G2 pollo↔polpo (2)**: «il pollo alla griglia a 15» → Polpo alla griglia 15 €. Come G1.
- **G3 «togli N euro» nasconde (4)**: «togli 2 euro alla tagliata» → Tagliata nascosta. `twilio-menu-nlu.ts:84` `removeVerb` + `parseIntent:61`.
- **G4 code nel nome del piatto nuovo (22)**: «aggiungi la burrata a 9 se puoi» → «Burrata se puoi» (anche dai/per stasera/da domani/che ne dici?/ok grazie ciao, «al menu la…»/«sul menu la…»). `twilio-menu-create.ts:33` `parseCreate`.
- **G5 «X e Y a N» piatto unico (3)**: «aggiungi nei primi gnocchi e tagliatelle a 10» → «Gnocchi e tagliatelle». `splitPair` (`twilio-menu-create.ts:154`) usato da `createStep` (:238) solo senza prezzo.
- **G6 bozza + «lascia stare» (4)**: «aggiungi le trofie ⏎ no niente, lascia stare ⏎ la parmigiana a 11» → piatto «Niente lascia stare» 11 €; «niente, lascia perdere ⏎ il tiramisù a 7» → Trofie 7 €. `twilio-menu-create.ts:232-260` (`NAME_BAD`/`YES`), `twilio-menu.ts:96` `revertLast` non chiude la bozza.
- **G7 ipotesi fonetica + «sì» (3)**: «piatto del giorno: risotto alla zucca a 14» → «intendi Polpo alla griglia 16→14?» → «sì» → Polpo 14 €. Oracolo. `owner-brain-plan.ts:189` `phoneticHits`, `twilio-menu-phonetic.ts:23`.
- **G8 prezzo relativo come assoluto (19)**: «aumenta la gricia di 1 euro» → 11→1 €; «abbassa di 2», «+1», «alza entrambi di un euro»; «50 centesimi in più» → 50 €. Oracolo/avversario. `g9Prices` (`twilio-menu-ai.ts:56`) conta il delta come detto; `polarityProblem` (`owner-brain-plan.ts:98`) non verifica la direzione.
- **G9 centesimi persi (9)**: «7 euro 90» → 7,00; «quindici e novanta» → 15; «13 virgola 50» → 13. Oracolo. `g9Prices` dà [13, 13.9, 90, 13.13…]; `spokenCents` (`twilio-menu-nlu.ts:135`) normalizza solo dopo «costa».
- **G10 ordinali non controllati (3)**: avversario «carbonara 13 ⏎ amatriciana 12 ⏎ il primo nascondilo» → Amatriciana nascosta. `owner-brain-plan.ts:305-306` (`deixisReferents` saltato se l'ultimo bot era una domanda).
- **G11 nome parziale verso altro piatto (1)**: «la torta al limone è finita» → Torta della nonna finita. Validatore accetta match su una parola.
- **G12 correzione su due piatti (4)**: «carbonara a 13 ⏎ no, l'amatriciana a 13, la carbonara lasciala stare» → carbonara resta 13. Il server non ricava il ripristino da «lasciala stare»/«la carbonara c'è».

## MEDI
- **M1 misti persi (16)**: «metti la carbonara a 13, e la gricia quanto la tengo?» → solo domanda. `mixedMessage` (`owner-brain-plan.ts:113`) → null.
- **M2 saluto in testa (2)**: «grazie, la carbonara a 13» → «Di nulla.».
- **M3 domanda come piatto (10)**: «hai messo la carbonara a 13?» → «Non trovo «hai messo la carbonara»». `looksLikeQuestion` (`twilio-menu-nlu.ts:162`).
- **M4 «boh» esitazione/autocorrezioni (8)**: «boh fai tu, la carbonara mettila a tredici» → «1. Carbonara 2. boh».
- **M5 «anzi no» da solo (8)**: «nascondi la gricia ⏎ anzi no» → «Cosa vuoi cambiare per Gricia?». `twilio-menu.ts:96`.
- **M6 prezzi nella bozza X e Y (4)**: «sono due ⏎ 8 tutti e due» → «A quale piatto?». `answerPrices` (`twilio-menu-create.ts:178`).
- **M7 centesimi su piatti simili (3)**: «la birra media a 5 e la piccola a 3 e 50» → domanda inutile.
- **M8 rimando a elenco del bot (5)**: «quali sono nascosti? ⏎ rimettili tutti» → chiede di Supplì.
- **M9 «Non ho capito la richiesta» invece della domanda giusta (9)**: «la pasta a 10» con 4 paste.
- **M10 Groq spento**: su menu con piatti simili ~300 conversazioni → «C'è stato un problema»; vocali «Non riesco ad ascoltare».
- **M11 categoria non dedotta (1)**: «aggiungi un dolce» chiede la categoria 3 volte.
- **M12 «lascia perdere» ignorato nella bozza (2)**.

Non contati: «carbonata»→Carbonara, «bombe»→Bomba, «la torta a 7»→Torta della nonna; 2 «fatto falso» dell'avversario sono errore del giudice («ho messo» dentro «Non trovo «ho messo…»»).

## Limiti
Oracolo conosce le attese: i GRAVI in oracolo (G7, G8, G9, G11, G12) sono uscite plausibili di un modello letterale che il validatore non ferma, non numeri gpt-oss. Piatto del giorno: creazione non misurabile (l'oracolo non emette `create_daily_special`). Gpt-oss vero non provato. Fase B esclusa.

## Per chiudere A6.4
Fix G1–G10 alle fonti indicate; runner avversario verde (oracolo 0 GRAVI; off e avversario 0 GRAVI di sicurezza) e 31 sonde verdi; fix-a e round1–6* non peggiorano. G11, G12, M2 da ricontrollare con gpt-oss.
