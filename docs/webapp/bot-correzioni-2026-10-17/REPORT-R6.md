# REPORT R6 — avversaria Z, fix del validatore (agente R3, 18/10/2026)

Worktree `Tako-bot-fix`, branch `codex/bot-fix-1017`. Batteria Z portata con cherry-pick (8bf278d → d5adecc, b1c1922 → 741986b). Un solo cervello rispettato: i fix sono **vincoli del validatore** (un piano incompatibile torna al modello, poi domanda), nessun percorso che decide, nessun testo fisso nuovo. 0 token Groq, nessun push/deploy/DB.

## Fix
- **Z1 numeri spezzati** (`owner-brain-price-checks.ts`, `splitNumbers`): «tre dici»=13, «dicia nove»=19, «quattro dici»=14, «venti due»=22: un prezzo uguale a un pezzo → `numero_spezzato`; salto oltre 3× o sotto 1/3 del prezzo attuale senza il numero intero detto → `prezzo_implausibile`.
- **Z2 percentuali**: con «%»/«per cento» il prezzo deve essere attuale ± x% (± 0,06; «al x%» accetta anche x% del prezzo), altrimenti `percentuale`.
- **Z3 verso del verbo per parte**: versi assegnati al piatto della parte (o all'ultimo nominato); «anzi» ritira i versi di prima; due versi opposti senza «anzi» o verso contrario al prezzo → `verso_del_prezzo`.
- Collegati in `validateBrainPlan` (`owner-brain-plan.ts`), motivi in `REASON` (`owner-brain-r.ts`) per l'auto-correzione.
- **M1** (`quantitiesRead`): «siamo in 3», «tavolo 7», «40 coperti», «alle/dalle 13», «4 stagioni» = Quattro stagioni. **M2**: parte ritirata con «no lascia / annulla / cancella questa / (no, lasciala)» e «…, la carbonara no», «no il babà niente» (lettore delle parti + completezza). M3 non toccato (2 MEDI categoria-fuori-ordine).
- Oracolo (`brain-oracle-r.ts`): «annulla grazie/subito/quello/per piacere» → undo_last; «mostralo/rimostralo/fallo vedere», «toglila/levalo dall'evidenza» → azione inversa sul piatto dell'ultima pubblicazione.
- 6 attese riclassificate in `adv-z.ts` (commento R6.1): il bot chiede senza scrivere per vincoli del server (undo solo da solo e con una parola che lo chiede: «annulla e mettilo finito», «rimettila dov'era»; rinomina/spostamento solo col piatto nominato: «rimettila negli antipasti», «rimetti il nome di prima», «anzi babà e basta») e z-lunghi-010 (40 ripetizioni, nessuna scrittura).

## Z per modo (408 conv.)
| modo | prima ok / GRAVE / GRAVE sic. / MEDIO | dopo ok / GRAVE / GRAVE sic. / MEDIO |
|---|---|---|
| oracolo | 360 / 24 / 9 / 24 | **392 / 0 / 0 / 16** |
| Groq spento | 143 / 195 / 0 / 70 | 143 / 195 / 0 / 70 (tutti aiDown) |
| avversario | 228 / 2 / 0 / 178 | 230 / 1 / 0 / 177 |

Il test oracolo del runner resta rosso solo per i MEDI (16 = 3,9% > 2%): dialetto/ASR («diece», «tira mi su», «en duja», «bacalà»), correzioni di un riepilogo in attesa (riepilogo-003/004), interruzioni a metà conferma, «alza, anzi abbassala di 1» (ora chiede: l'oracolo non si auto-corregge), «mostra e nascondi» (scrive invece di chiedere, non di sicurezza), 2 categoria-fuori-ordine (M3).

## Tutte le batterie dopo (oracolo)
| Batteria | Oracolo ok | GRAVI | GRAVI sic. | MEDI | Groq giù GRAVI sic. | Avversario GRAVI sic. |
|---|---|---|---|---|---|---|
| Y 558 | 530 | 0 | 0 | 28 | 0 | 0 |
| banco E 318 | 313 | 0 | 0 | 5 | 0 | — |
| V 143 | 129 | 0 | 0 | 14 | 0 | — |
| banco vero 92 | 80 | 0 | 0 | 12 | 0 | — |
| X 508 / fix-a 809 / fix-b 452 | verdi | 0 | 0 | ≤2% | 0 | 0 |

Identiche a REPORT-R5. Suite vitest: 14 test rossi = gli stessi noti di 6004b81; round1–6* (cervello spento) verdi nella suite.

## GRAVI rimasti
Nessuno di sicurezza in nessun modo. Avversario Z: 1 GRAVE non di sicurezza (era 2). Le 6 riclassificate vanno rimisurate con gpt-oss al gate Developer.
