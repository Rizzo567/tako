# Banco E · note e deviazioni (17/10/2026)

1. **Finestra del contesto.**
   - Le attese seguono il PIANO §2: la cronologia vale ≤30 minuti, quindi «anche la gricia» dopo 15–25 minuti si applica.
   - La batteria round2 `memoria-01` (11 minuti → niente correzione) segue la vecchia regola dei 10 minuti. L'ho esclusa dalle conversioni invece di cambiarle l'attesa: le batterie restano com'erano.
   - Le domande in sospeso (chiarimento, scelta di prezzo) restano a **10 minuti**, come round5/5b: nessuna attesa indebolita.
2. **Gravità.** Ho preso quella di fix-loop e ho aggiunto:
   - `correzione-non-applicata` (GRAVE), per una modifica giusta al momento e poi corretta o annullata dal titolare. Senza questo codice le 28 correzioni mancate sarebbero contate come «modifiche non richieste», cioè come GRAVI di sicurezza falsi;
   - `scrittura-su-domanda`, `fatto-falso`, `risposta-incoerente`, `scrive-invece-di-chiedere`, raccolti nei «GRAVI di sicurezza» del PIANO.
   - «Non riesco ad ascoltare il vocale», che compare quando l'IA fallisce, conta come `errore-generico`, come `copy.failed` nelle batterie.
   - «Non ho capito / Non trovo» non conta come domanda di chiarimento.
3. **Oracolo per il bot attuale** (`adapters/current-oracle.ts`). Con 20k token si registrano circa 10 chiamate, mentre le conversazioni che passano dall'IA sono 142 (156 chiamate). Per misurare tutto a 0 token ho aggiunto un modello ideale per messaggio, sul modello del `modelReply` delle batterie, con due differenze: non risolve le ambiguità, perché le chiede, e riconosce le parole storpiate dal dialetto. Nel report è dichiarato come tetto superiore, non come resa reale.
4. **Conversioni delle batterie, due adattamenti:**
   - lunga-02 usa «pasta alla norma» invece di «pasta al ragù», che nella fixture `mario` esiste già come piatto del QA;
   - mem60-16, dopo una modifica fatta in dashboard: è accettato sia lasciare 15 (o chiedere) sia applicare 14. La batteria non lo verifica in modo stretto, e resta una scelta di prodotto.
5. **Caso di Manuel.** Non ho trovato la trascrizione esatta in nessun file. Ho usato «il tiramisù a 6 euro e tojibo» seguito da «no, togli bo» → tiramisù a 6 e boh nascosto, più 4 varianti: a voce, «intendevo nascondi boh», il solo primo vocale (deve chiedere di «tojibo»), poi «rimetti boh com'era».
6. **Ambiente.** Il worktree non aveva `apps/server/node_modules` né `packages/db/node_modules`. Li ho copiati da Tako-bot-quick con `cp -a` (link relativi pnpm). Non sono committati: sono ignorati da git.
7. **Suite.** `tests/eval/judge.test.ts` è sempre acceso: 11 prove, nessuna rete. `eval-current` ed `eval-new` partono solo con `TAKO_EVAL=1`, così la suite resta senza rossi nuovi e i file dei risultati non vengono riscritti.
8. **Groq.**
   - Dopo un 429 nel primo giro di record ho aggiunto la pausa tra le conversazioni. Una pausa dentro la richiesta faceva scadere il tempo massimo del bot (risposta «C'è stato un problema»), per questo la pausa sta fuori.
   - Il tetto si conta sul giorno reale: Date nei test è finto.
