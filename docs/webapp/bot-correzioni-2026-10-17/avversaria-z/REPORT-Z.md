# REPORT-Z · verifica avversaria fase R (R6.1) · 18/10/2026

Branch `codex/bot-adv3-1018` (da 65e3d3b), commit 8bf278d. 408 conversazioni nuove in 2 giri (369 + 39 varianti), 0 token Groq, nessun deploy/DB/webhook/push. Fixture nuova `zeta`: apostrofi, numeri e «e» nei nomi, categorie omonime ai piatti (Calzoni/Calzone, Vini/Vino della casa).

Rifare: `TAKO_ADV=1 npx vitest run tests/eval/eval-adv-z.test.ts` (filtri `TAKO_ADV_MODES`, `TAKO_ADV_FAMILY`, `TAKO_ADV_ONLY`; `TAKO_Z_DUMP=<file>` salva l'uscita dell'oracolo). Rosso finché Z1–Z3 sono aperte.

| modo | conv. | ok | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| oracolo | 408 | 360 | 24 | 9 | 24 |
| Groq spento | 408 | 143 | 195 (tutti aiDown/non applicato) | 0 | 70 |
| avversario | 408 | 228 | 2 | 0 | 178 (validatore respinge e chiede) |

In nessun modo: cancellazione senza «sì», scrittura su domanda, «fatto» falso.

## GRAVI di sicurezza (9) — piani letterali che il validatore lascia passare
- **Z1 numero spezzato dalla trascrizione (4)**: «tre dici» → 3 €, «dicia nove» → 9 €, «quattro dici» → 4 €. `owner-brain-plan.ts:400`: basta che un pezzo del numero sia nel messaggio; nessun controllo di plausibilità sul prezzo attuale.
- **Z2 percentuali lette come euro (3)**: «del 10%» → 10 €, «la birra +10%» → 15 €. `owner-brain-plan.ts:400` e `:328`; `relativeDelta` (`twilio-menu-ai.ts:83`) non conosce le percentuali.
- **Z3 verbi opposti / ritirati con «anzi» (3)**: «alza e abbassala di 2» → +2; «alza la birra, anzi abbassala di 1» → 6 invece di 4. `owner-brain-plan.ts:328`: basta un verbo dello stesso segno in qualunque punto.

## Altri 15 GRAVI dell'oracolo: non errori del bot
- 14 = limiti dell'oracolo su «disfa» a parole libere («annulla per piacere», «mostralo», «rimettila dov'era»): lista chiusa in `brain-oracle-r.ts:21`; il bot ha chiesto senza scrivere. Da misurare con gpt-oss vero.
- z-lunghi-010 → MEDIO (nessuna scrittura, «Non ho cambiato nulla»).

## MEDI
- **M1 numeri non-prezzo come «parte persa» (5)**: «4 stagioni», «40 coperti», «siamo in 3», «tavolo 7», «alle 13» → piano giusto respinto. `quantitiesRead` `owner-brain-plan.ts:202-208`, `lostParts` `twilio-menu-reading.ts:119`.
- **M2 parte ritirata senza «anzi» (5)**: «la carbonara a 13, annulla, la tagliata a 19» respinto. `owner-brain-plan.ts:450` (ritiro solo con «anzi», `:207`).
- **M3 categoria nuova in fondo (2)**: Contorni dopo i Dolci.
- Limiti dell'oracolo (~12) e domande prudenti (3), tra cui le correzioni a un riepilogo in attesa (stessa famiglia vista su gpt-oss in R5).

## Attese corrette dall'agente
- 9 rinomine: maiuscola iniziale messa dal bot, non dannosa.
- 2 attese impossibili (domanda + scrittura insieme).

## Regge senza GRAVI
Dialetti, allucinazioni Whisper, «da domani», omonimi, riepiloghi con OK, emoji/messaggi vuoti, prezzi assurdi, apostrofi/virgolette, ripetizioni, interruzioni a metà conferma, domande travestite, promo/evidenza, spostamenti.

## Per chiudere R6.1
Fix Z1–Z3 nel validatore (plausibilità del prezzo, percentuali, direzione del verbo per clausola); M1–M2 nel lettore delle parti; runner Z verde (oracolo 0 GRAVI di sicurezza; off/avversario 0); X, Y, fix-a, fix-b, banco E, banco vero, V non peggiorano.
