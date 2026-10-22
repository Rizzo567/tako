# implementation-notes — dashboard editor 22/10

Deviazioni dal piano (opzione conservativa) e note di lavoro. Ogni perimetro scrive in `notes/<perimetro>.md`; qui la sintesi dell'orchestratore.

## Orchestratore
- 22/10 mattina: cambio di perimetro deciso da Manuel — motore del gesto + animazioni + registrazioni video del gesto → altro agente (`packages/menu-gesture/`, branch `feat/menu-gesto-1022`, `CONTRATTO-GESTO.md`). Qui: data-attribute, onDrop/onTap, «Fine», stub con la stessa firma. Le soglie §6 (fluidità, V1–V14) sono quindi verificate dall'altro agente; qui si verifica la logica dati del riordino.
- Il piano diceva base `codex/bot-anthropic-1019` e ramo `codex/dashboard-editor-1022`: si è partiti da `fix/foto-whatsapp-1022` (75b22667 = v151 + fix foto) con ramo `feat/dashboard-editor-1022`, per istruzione esplicita. Il vincolo «T3 dopo il fix foto» è quindi già soddisfatto.
- Ordine manuale (addendum 1): migrazione **pigra senza SQL** invece di una migrazione dati di tutti i locali. Motivo: «ogni locale parte con l'ordine che vede oggi» è garantito senza scrivere sul DB remoto; il locale passa a `design.manualOrder=true` al primo riordino. Nota: l'ordine dei Menu oggi dipende dall'ora del telefono del cliente (`orderDayMenus`): lo snapshot fotografa l'ordine dell'ora in cui il ristoratore riordina la prima volta.
- Per evitare conflitti, i perimetri hanno file di note separati in `notes/`.
- 22/10 (correzione di metodo di Manuel, vincolante): durante la costruzione solo typecheck/build; test ed e2e scritti ma eseguiti in UN giro finale (suite + e2e locale + verifica avversariale), max 3 giri finali finché ci sono rossi. Domande aperte → default consigliato, annotato. Inoltrato a tutti i perimetri.
